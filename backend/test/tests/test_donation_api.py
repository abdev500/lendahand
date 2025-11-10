import pytest
from decimal import Decimal
from types import SimpleNamespace
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


def register_user(email, username, password="SecurePass123!"):
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


def create_campaign_via_api(client, title, stripe_ready=True, monkeypatch=None):
    account = SimpleNamespace(
        is_ready=stripe_ready,
        stripe_account_id=f"acct_{title.lower().replace(' ', '_')}",
    )
    if monkeypatch:
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
    assert list_response.status_code == status.HTTP_200_OK
    for item in list_results(list_response):
        if item["title"] == title:
            return item["id"], item
    raise AssertionError("Campaign not found after creation")


@pytest.mark.django_db
def test_create_checkout_session_returns_stripe_session(monkeypatch):
    owner_token, owner_user = register_user("donor@example.com", "donor")
    owner_client = make_client(owner_token)

    account = SimpleNamespace(
        is_ready=True,
        stripe_account_id="acct_checkout",
        charges_enabled=True,
        payouts_enabled=True,
        details_submitted=True,
    )
    monkeypatch.setattr("donations.views.ensure_user_stripe_account", lambda _user: account)
    monkeypatch.setattr("donations.views.sync_user_stripe_account", lambda _account: account)
    monkeypatch.setattr("donations.views.get_user_stripe_account", lambda _user: account)

    campaign_id, _ = create_campaign_via_api(owner_client, "Clean Water", stripe_ready=True)

    # Approve via moderator so donations are allowed
    mod_token, mod_user = register_user("mod-donation@example.com", "mod_donation")
    user_model = get_user_model()
    user_model.objects.filter(id=mod_user["id"]).update(is_moderator=True, is_staff=True)
    mod_client = make_client(mod_token)
    approve_response = mod_client.post(
        reverse("campaign-approve", args=[campaign_id]),
        {"moderation_notes": "Ready to accept donations."},
        format="json",
    )
    assert approve_response.status_code == status.HTTP_200_OK

    captured = {}

    def fake_session_create(**kwargs):
        captured["kwargs"] = kwargs
        return SimpleNamespace(id="sess_test", url="https://stripe.test/checkout")

    monkeypatch.setattr("donations.views.stripe.checkout.Session.create", fake_session_create)

    response = owner_client.post(
        reverse("donation-create-checkout-session"),
        {"campaign_id": campaign_id, "amount": "50.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["session_id"] == "sess_test"
    params = captured["kwargs"]
    assert params["metadata"]["campaign_id"] == campaign_id
    assert params["line_items"][0]["price_data"]["unit_amount"] == 5000
    assert params["payment_intent_data"]["metadata"]["campaign_id"] == campaign_id


@pytest.mark.django_db
def test_confirm_payment_updates_campaign_progress(monkeypatch):
    owner_token, owner_user = register_user("donor2@example.com", "donor2")
    owner_client = make_client(owner_token)

    account = SimpleNamespace(
        is_ready=True,
        stripe_account_id="acct_progress",
        charges_enabled=True,
        payouts_enabled=True,
        details_submitted=True,
    )
    monkeypatch.setattr("donations.views.ensure_user_stripe_account", lambda _user: account)
    monkeypatch.setattr("donations.views.sync_user_stripe_account", lambda _account: account)
    monkeypatch.setattr("donations.views.get_user_stripe_account", lambda _user: account)

    campaign_id, _ = create_campaign_via_api(owner_client, "Community Library", stripe_ready=True)

    # Approve campaign
    mod_token, mod_user = register_user("mod-progress@example.com", "mod_progress")
    user_model = get_user_model()
    user_model.objects.filter(id=mod_user["id"]).update(is_moderator=True, is_staff=True)
    mod_client = make_client(mod_token)
    approve_response = mod_client.post(
        reverse("campaign-approve", args=[campaign_id]),
        {"moderation_notes": "Approved for donations."},
        format="json",
    )
    assert approve_response.status_code == status.HTTP_200_OK

    def fake_session_retrieve(_session_id):
        return SimpleNamespace(
            payment_status="paid",
            metadata={"campaign_id": str(campaign_id)},
            amount_total=5000,
            payment_intent="pi_test123",
        )

    monkeypatch.setattr("donations.views.stripe.checkout.Session.retrieve", fake_session_retrieve)

    response = owner_client.post(
        reverse("donation-confirm-payment"),
        {"session_id": "cs_test"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK

    detail_response = owner_client.get(reverse("campaign-detail", args=[campaign_id]))
    assert detail_response.status_code == status.HTTP_200_OK
    detail = detail_response.data
    assert Decimal(detail["current_amount"]) == Decimal("50")
    assert detail["progress_percentage"] == 5

    donations_response = owner_client.get(reverse("donation-list"), {"campaign": campaign_id})
    assert donations_response.status_code == status.HTTP_200_OK
    donations = list_results(donations_response)
    assert len(donations) == 1
    assert Decimal(donations[0]["amount"]) == Decimal("50")
