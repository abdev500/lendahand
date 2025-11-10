import pytest
from types import SimpleNamespace
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from donations.models import Campaign, ModerationHistory, User


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="owner@example.com",
        username="owner",
        password="SecurePass123!",
    )


@pytest.fixture
def auth_client(user):
    client = APIClient()
    token = Token.objects.create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


@pytest.mark.django_db
def test_campaign_create_sets_owner_and_stripe_ready(settings, auth_client, user, monkeypatch):
    settings.STRIPE_SECRET_KEY = "sk_test_key"

    account = SimpleNamespace(is_ready=True, stripe_account_id="acct_ready")
    monkeypatch.setattr("donations.views.ensure_user_stripe_account", lambda _: account)
    monkeypatch.setattr("donations.views.sync_user_stripe_account", lambda __: account)

    url = reverse("campaign-list")
    payload = {
        "title": "Clean Water Initiative",
        "short_description": "Provide clean water.",
        "description": "<p>Help us build wells.</p>",
        "target_amount": "1000.00",
        "status": "pending",
    }

    response = auth_client.post(url, payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    campaign = Campaign.objects.get(title=payload["title"])
    assert campaign.created_by == user
    assert campaign.stripe_ready is True
    assert campaign.status == "pending"


@pytest.mark.django_db
def test_campaign_create_forces_draft_when_stripe_not_ready(settings, auth_client, monkeypatch, user):
    settings.STRIPE_SECRET_KEY = "sk_test_key"

    account = SimpleNamespace(is_ready=False, stripe_account_id="acct_pending")
    monkeypatch.setattr("donations.views.ensure_user_stripe_account", lambda _: account)
    monkeypatch.setattr("donations.views.sync_user_stripe_account", lambda __: account)

    url = reverse("campaign-list")
    payload = {
        "title": "Medical Aid",
        "short_description": "Support medical treatment.",
        "description": "<p>Funding urgent care.</p>",
        "target_amount": "5000.00",
        "status": "pending",
    }

    response = auth_client.post(url, payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    campaign = Campaign.objects.get(title=payload["title"])
    assert campaign.stripe_ready is False
    assert campaign.status == "draft"


@pytest.mark.django_db
def test_campaign_update_requires_owner_or_moderator(auth_client, user):
    other_user = User.objects.create_user(
        email="other@example.com",
        username="other",
        password="SecurePass123!",
    )
    campaign = Campaign.objects.create(
        title="Education Fund",
        short_description="Support education.",
        description="<p>Build schools.</p>",
        target_amount="2000.00",
        created_by=other_user,
        status="approved",
        stripe_ready=True,
    )

    url = reverse("campaign-detail", args=[campaign.id])
    response = auth_client.patch(url, {"title": "Updated Title"}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_campaign_update_pending_requires_stripe_ready(auth_client, user):
    campaign = Campaign.objects.create(
        title="Community Garden",
        short_description="Grow food locally.",
        description="<p>Community effort.</p>",
        target_amount="1500.00",
        created_by=user,
        stripe_ready=False,
        status="draft",
    )

    url = reverse("campaign-detail", args=[campaign.id])
    response = auth_client.patch(url, {"status": "pending"}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "status" in response.data


@pytest.mark.django_db
def test_campaign_update_resets_moderation_for_approved(auth_client, user):
    campaign = Campaign.objects.create(
        title="Animal Shelter",
        short_description="Care for animals.",
        description="<p>Adopt a pet.</p>",
        target_amount="2500.00",
        created_by=user,
        status="approved",
        moderation_notes="Initial approval.",
        stripe_ready=True,
    )

    url = reverse("campaign-detail", args=[campaign.id])
    response = auth_client.patch(url, {"title": "New Title"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    campaign.refresh_from_db()
    assert campaign.title == "New Title"
    assert campaign.status == "pending"
    assert campaign.moderation_notes == ""


@pytest.mark.django_db
def test_campaign_create_with_media_files(settings, auth_client, user, monkeypatch, tmp_path):
    settings.STRIPE_SECRET_KEY = "sk_test_key"

    account = SimpleNamespace(is_ready=True, stripe_account_id="acct_ready")
    monkeypatch.setattr("donations.views.ensure_user_stripe_account", lambda _: account)
    monkeypatch.setattr("donations.views.sync_user_stripe_account", lambda __: account)

    url = reverse("campaign-list")
    image_file = SimpleUploadedFile("photo.jpg", b"fake image", content_type="image/jpeg")
    video_file = SimpleUploadedFile("clip.mp4", b"fake video", content_type="video/mp4")
    payload = {
        "title": "Disaster Relief",
        "short_description": "Emergency support.",
        "description": "<p>Provide urgent aid.</p>",
        "target_amount": "3000.00",
        "status": "pending",
        "media_files": [image_file, video_file],
    }

    with override_settings(MEDIA_ROOT=str(tmp_path)):
        response = auth_client.post(url, payload, format="multipart")

    assert response.status_code == status.HTTP_201_CREATED
    campaign = Campaign.objects.get(title=payload["title"])
    media = list(campaign.media.order_by("order"))
    assert len(media) == 2
    assert media[0].media_type == "image"
    assert media[1].media_type == "video"
    assert media[0].order == 0
    assert media[1].order == 1


@pytest.mark.django_db
def test_moderator_can_approve_pending_campaign(auth_client, user):
    moderator = User.objects.create_user(
        email="moderator@example.com",
        username="moderator",
        password="SecurePass123!",
        is_moderator=True,
    )
    campaign = Campaign.objects.create(
        title="Pending Campaign",
        short_description="Pending review.",
        description="<p>Needs approval.</p>",
        target_amount="4000.00",
        created_by=user,
        status="pending",
        stripe_ready=True,
    )

    client = APIClient()
    token = Token.objects.create(user=moderator)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = reverse("campaign-approve", args=[campaign.id])
    response = client.post(url, {"moderation_notes": "Looks good."}, format="json")

    assert response.status_code == status.HTTP_200_OK
    campaign.refresh_from_db()
    assert campaign.status == "approved"
    assert campaign.moderation_notes == "Looks good."
    history = ModerationHistory.objects.filter(campaign=campaign, action="approve")
    assert history.count() == 1


@pytest.mark.django_db
def test_moderator_cannot_approve_without_stripe_ready(auth_client, user):
    moderator = User.objects.create_user(
        email="moderator2@example.com",
        username="moderator2",
        password="SecurePass123!",
        is_moderator=True,
    )
    campaign = Campaign.objects.create(
        title="Pending No Stripe",
        short_description="Pending but not Stripe ready.",
        description="<p>No Stripe yet.</p>",
        target_amount="4000.00",
        created_by=user,
        status="pending",
        stripe_ready=False,
    )

    client = APIClient()
    token = Token.objects.create(user=moderator)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = reverse("campaign-approve", args=[campaign.id])
    response = client.post(url, {"moderation_notes": "Needs Stripe."}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    campaign.refresh_from_db()
    assert campaign.status == "pending"
    assert ModerationHistory.objects.filter(campaign=campaign).count() == 0


@pytest.mark.django_db
def test_moderator_can_reject_pending_campaign(auth_client, user):
    moderator = User.objects.create_user(
        email="moderator3@example.com",
        username="moderator3",
        password="SecurePass123!",
        is_moderator=True,
    )
    campaign = Campaign.objects.create(
        title="Pending Campaign 2",
        short_description="Pending review again.",
        description="<p>Needs rejection.</p>",
        target_amount="4000.00",
        created_by=user,
        status="pending",
        stripe_ready=True,
    )

    client = APIClient()
    token = Token.objects.create(user=moderator)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = reverse("campaign-reject", args=[campaign.id])
    response = client.post(url, {"moderation_notes": "Insufficient details."}, format="json")

    assert response.status_code == status.HTTP_200_OK
    campaign.refresh_from_db()
    assert campaign.status == "rejected"
    assert campaign.moderation_notes == "Insufficient details."
    history = ModerationHistory.objects.filter(campaign=campaign, action="reject")
    assert history.count() == 1


@pytest.mark.django_db
def test_moderator_resume_requires_stripe_ready(auth_client, user):
    moderator = User.objects.create_user(
        email="moderator4@example.com",
        username="moderator4",
        password="SecurePass123!",
        is_moderator=True,
    )
    campaign = Campaign.objects.create(
        title="Suspended Campaign",
        short_description="Suspended state.",
        description="<p>Should be resumed.</p>",
        target_amount="4000.00",
        created_by=user,
        status="suspended",
        stripe_ready=False,
    )

    client = APIClient()
    token = Token.objects.create(user=moderator)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = reverse("campaign-resume", args=[campaign.id])
    response = client.post(url, {"moderation_notes": "Ready to resume."}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    campaign.refresh_from_db()
    assert campaign.status == "suspended"
    assert ModerationHistory.objects.filter(campaign=campaign).count() == 0


@pytest.mark.django_db
def test_admin_resume_success(auth_client, user):
    moderator = User.objects.create_user(
        email="moderator5@example.com",
        username="moderator5",
        password="SecurePass123!",
        is_staff=True,
        is_moderator=True,
    )
    campaign = Campaign.objects.create(
        title="Suspended Ready",
        short_description="Suspended but ready.",
        description="<p>Resume me.</p>",
        target_amount="4000.00",
        created_by=user,
        status="suspended",
        stripe_ready=True,
        moderation_notes="Previous issue.",
    )

    client = APIClient()
    token = Token.objects.create(user=moderator)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = reverse("campaign-resume", args=[campaign.id])
    response = client.post(url, {"moderation_notes": "Issue resolved."}, format="json")

    assert response.status_code == status.HTTP_200_OK
    campaign.refresh_from_db()
    assert campaign.status == "approved"
    assert campaign.moderation_notes == "Issue resolved."
    history = ModerationHistory.objects.filter(campaign=campaign, action="resume")
    assert history.count() == 1
