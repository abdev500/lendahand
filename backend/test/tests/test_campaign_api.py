from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.utils import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


def register_user(email, username, password="StrongPass123!"):
    client = APIClient()
    response = client.post(
        reverse("register"),
        {
            "email": email,
            "username": username,
            "password": password,
            "password2": password,
            "phone": "+123456789",
            "address": "123 Test Street",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    return response.data["token"], response.data["user"]


def make_client(token=None):
    client = APIClient()
    if token:
        client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
    return client


def list_results(response):
    data = response.data
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


def create_campaign(client, title, monkeypatch, stripe_ready=True):
    account = SimpleNamespace(is_ready=stripe_ready, stripe_account_id=f"acct_{title}")
    monkeypatch.setattr("donations.views.ensure_user_stripe_account", lambda _user: account)
    monkeypatch.setattr("donations.views.sync_user_stripe_account", lambda _account: account)

    response = client.post(
        reverse("campaign-list"),
        {
            "title": title,
            "short_description": f"Short description for {title}",
            "description": f"<p>Details for {title}</p>",
            "target_amount": "1000.00",
            "status": "pending",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED

    list_response = client.get(reverse("campaign-list"))
    for item in list_results(list_response):
        if item["title"] == title:
            return item
    raise AssertionError("Campaign not found after creation")


def promote_to_moderator(user_id):
    user_model = get_user_model()
    user_model.objects.filter(id=user_id).update(is_moderator=True, is_staff=True)


@pytest.mark.django_db
def test_campaign_create_sets_owner_and_stripe_ready(monkeypatch):
    token, user = register_user("owner@example.com", "owner")
    client = make_client(token)

    campaign = create_campaign(client, "CleanWater", monkeypatch, stripe_ready=True)
    assert campaign["created_by"]["email"] == user["email"]
    assert campaign["stripe_ready"] is True
    assert campaign["status"] == "pending"


@pytest.mark.django_db
def test_campaign_create_forces_draft_when_stripe_not_ready(monkeypatch):
    token, _ = register_user("owner2@example.com", "owner2")
    client = make_client(token)

    campaign = create_campaign(client, "MedicalAid", monkeypatch, stripe_ready=False)
    assert campaign["stripe_ready"] is False
    assert campaign["status"] == "draft"


@pytest.mark.django_db
def test_campaign_update_requires_owner_or_moderator(monkeypatch):
    owner_token, _ = register_user("owner3@example.com", "owner3")
    owner_client = make_client(owner_token)

    campaign = create_campaign(owner_client, "EducationFund", monkeypatch, stripe_ready=True)
    campaign_id = campaign["id"]

    # Approve with moderator so it is visible to other users
    mod_token, mod_user = register_user("moderator@example.com", "moderator")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)
    approve_response = mod_client.post(
        reverse("campaign-approve", args=[campaign_id]),
        {"moderation_notes": "Looks good."},
        format="json",
    )
    assert approve_response.status_code == status.HTTP_200_OK

    other_token, _ = register_user("other@example.com", "other")
    other_client = make_client(other_token)
    update_response = other_client.patch(
        reverse("campaign-detail", args=[campaign_id]),
        {"title": "Updated Title"},
        format="json",
    )
    assert update_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_campaign_update_pending_requires_stripe_ready(monkeypatch):
    token, _ = register_user("owner4@example.com", "owner4")
    client = make_client(token)

    campaign = create_campaign(client, "CommunityGarden", monkeypatch, stripe_ready=False)
    campaign_id = campaign["id"]

    response = client.patch(
        reverse("campaign-detail", args=[campaign_id]),
        {"status": "pending"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "status" in response.data


@pytest.mark.django_db
def test_campaign_update_resets_moderation_for_approved(monkeypatch):
    owner_token, _ = register_user("owner5@example.com", "owner5")
    owner_client = make_client(owner_token)

    campaign = create_campaign(owner_client, "AnimalShelter", monkeypatch, stripe_ready=True)
    campaign_id = campaign["id"]

    # Approve via moderator
    mod_token, mod_user = register_user("moderator5@example.com", "moderator5")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)
    approve_response = mod_client.post(
        reverse("campaign-approve", args=[campaign_id]),
        {"moderation_notes": "Approved."},
        format="json",
    )
    assert approve_response.status_code == status.HTTP_200_OK

    update_response = owner_client.patch(
        reverse("campaign-detail", args=[campaign_id]),
        {"title": "New Title"},
        format="json",
    )
    assert update_response.status_code == status.HTTP_200_OK

    detail_response = owner_client.get(reverse("campaign-detail", args=[campaign_id]), {"include_history": "true"})
    detail = detail_response.data
    assert detail["status"] == "pending"
    assert detail["moderation_notes"] == ""
    history = detail.get("moderation_history", [])
    assert len(history) == 1
    assert history[0]["action"] == "approve"


@pytest.mark.django_db
def test_campaign_create_with_media_files(monkeypatch, tmp_path):
    token, _ = register_user("owner6@example.com", "owner6")
    client = make_client(token)

    account = SimpleNamespace(is_ready=True, stripe_account_id="acct_media")
    monkeypatch.setattr("donations.views.ensure_user_stripe_account", lambda _user: account)
    monkeypatch.setattr("donations.views.sync_user_stripe_account", lambda _account: account)

    image_content = b"fake image"
    video_content = b"fake video"

    with override_settings(MEDIA_ROOT=str(tmp_path)):
        response = client.post(
            reverse("campaign-list"),
            {
                "title": "DisasterRelief",
                "short_description": "Emergency support.",
                "description": "<p>Provide urgent aid.</p>",
                "target_amount": "3000.00",
                "status": "pending",
                "media_files": [
                    SimpleUploadedFile("photo.jpg", image_content, content_type="image/jpeg"),
                    SimpleUploadedFile("clip.mp4", video_content, content_type="video/mp4"),
                ],
            },
            format="multipart",
        )
    assert response.status_code == status.HTTP_201_CREATED

    list_response = client.get(reverse("campaign-list"))
    items = list_results(list_response)
    media_campaign = next(item for item in items if item["title"] == "DisasterRelief")
    assert media_campaign["stripe_ready"] is True

    detail_response = client.get(reverse("campaign-detail", args=[media_campaign["id"]]))
    detail = detail_response.data
    assert len(detail.get("media", [])) == 2


@pytest.mark.django_db
def test_moderator_can_approve_pending_campaign(monkeypatch):
    creator_token, _ = register_user("creator@example.com", "creator")
    creator_client = make_client(creator_token)

    campaign = create_campaign(creator_client, "PendingCampaign", monkeypatch, stripe_ready=True)
    campaign_id = campaign["id"]

    mod_token, mod_user = register_user("moderator6@example.com", "moderator6")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)

    response = mod_client.post(
        reverse("campaign-approve", args=[campaign_id]),
        {"moderation_notes": "Looks good."},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK

    detail = mod_client.get(reverse("campaign-detail", args=[campaign_id])).data
    assert detail["status"] == "approved"
    assert detail["moderation_notes"] == "Looks good."


@pytest.mark.django_db
def test_moderator_cannot_approve_without_stripe_ready(monkeypatch):
    creator_token, _ = register_user("creator2@example.com", "creator2")
    creator_client = make_client(creator_token)

    campaign = create_campaign(creator_client, "PendingNoStripe", monkeypatch, stripe_ready=False)
    campaign_id = campaign["id"]

    mod_token, mod_user = register_user("moderator7@example.com", "moderator7")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)

    response = mod_client.post(
        reverse("campaign-approve", args=[campaign_id]),
        {"moderation_notes": "Needs Stripe."},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_moderator_can_reject_pending_campaign(monkeypatch):
    creator_token, _ = register_user("creator3@example.com", "creator3")
    creator_client = make_client(creator_token)

    campaign = create_campaign(creator_client, "PendingCampaign2", monkeypatch, stripe_ready=True)
    campaign_id = campaign["id"]

    mod_token, mod_user = register_user("moderator8@example.com", "moderator8")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)

    response = mod_client.post(
        reverse("campaign-reject", args=[campaign_id]),
        {"moderation_notes": "Insufficient details."},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK

    detail = mod_client.get(reverse("campaign-detail", args=[campaign_id])).data
    assert detail["status"] == "rejected"
    assert detail["moderation_notes"] == "Insufficient details."


@pytest.mark.django_db
def test_moderator_resume_requires_stripe_ready(monkeypatch):
    creator_token, _ = register_user("creator4@example.com", "creator4")
    creator_client = make_client(creator_token)

    campaign = create_campaign(creator_client, "SuspendedCampaign", monkeypatch, stripe_ready=False)
    campaign_id = campaign["id"]

    mod_token, mod_user = register_user("moderator9@example.com", "moderator9")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)

    # suspend campaign via API
    susp_response = creator_client.post(reverse("campaign-suspend", args=[campaign_id]))
    assert susp_response.status_code == status.HTTP_200_OK

    resume_response = mod_client.post(
        reverse("campaign-resume", args=[campaign_id]),
        {"moderation_notes": "Ready to resume."},
        format="json",
    )
    assert resume_response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_admin_resume_success(monkeypatch):
    creator_token, _ = register_user("creator5@example.com", "creator5")
    creator_client = make_client(creator_token)

    campaign = create_campaign(creator_client, "SuspendedReady", monkeypatch, stripe_ready=True)
    campaign_id = campaign["id"]

    # suspend
    creator_client.post(reverse("campaign-suspend", args=[campaign_id]))

    admin_token, admin_user = register_user("moderator10@example.com", "moderator10")
    promote_to_moderator(admin_user["id"])
    admin_client = make_client(admin_token)

    response = admin_client.post(
        reverse("campaign-resume", args=[campaign_id]),
        {"moderation_notes": "Issue resolved."},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK

    detail = admin_client.get(reverse("campaign-detail", args=[campaign_id])).data
    assert detail["status"] == "approved"
    assert detail["moderation_notes"] == "Issue resolved."
