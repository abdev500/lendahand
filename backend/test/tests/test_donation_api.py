import pytest
from decimal import Decimal
from types import SimpleNamespace
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from donations.models import Campaign, Donation, User, UserStripeAccount


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="donor@example.com",
        username="donor",
        password="SecurePass123!",
    )


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_create_checkout_session_returns_stripe_session(settings, user, client, monkeypatch):
    settings.STRIPE_SECRET_KEY = "sk_test_key"
    campaign = Campaign.objects.create(
        title="Clean Water",
        short_description="Provide access to clean water.",
        description="<p>Help build wells.</p>",
        target_amount=Decimal("1000.00"),
        created_by=user,
        status="approved",
        stripe_ready=True,
    )
    UserStripeAccount.objects.create(
        user=user,
        stripe_account_id="acct_test123",
        charges_enabled=True,
        payouts_enabled=True,
        details_submitted=True,
    )

    captured = {}

    def fake_sync(account):
        return account

    def fake_create(**kwargs):
        captured["kwargs"] = kwargs
        return SimpleNamespace(id="sess_test", url="https://stripe.test/checkout")

    monkeypatch.setattr("donations.views.sync_user_stripe_account", fake_sync)
    monkeypatch.setattr("donations.views.stripe.checkout.Session.create", fake_create)

    url = reverse("donation-create-checkout-session")
    response = client.post(
        url,
        {"campaign_id": campaign.id, "amount": "50.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["session_id"] == "sess_test"
    params = captured["kwargs"]
    assert params["metadata"]["campaign_id"] == campaign.id
    assert params["line_items"][0]["price_data"]["unit_amount"] == 5000
    assert params["payment_intent_data"]["metadata"]["campaign_id"] == campaign.id


@pytest.mark.django_db
def test_confirm_payment_updates_campaign_progress(user, client, monkeypatch):
    campaign = Campaign.objects.create(
        title="Community Library",
        short_description="Build a library.",
        description="<p>Support education.</p>",
        target_amount=Decimal("200.00"),
        created_by=user,
        status="approved",
        stripe_ready=True,
        current_amount=Decimal("0.00"),
    )

    def fake_retrieve(session_id):
        return SimpleNamespace(
            payment_status="paid",
            metadata={"campaign_id": str(campaign.id)},
            amount_total=5000,
            payment_intent="pi_test123",
        )

    monkeypatch.setattr("donations.views.stripe.checkout.Session.retrieve", fake_retrieve)

    url = reverse("donation-confirm-payment")
    response = client.post(url, {"session_id": "cs_test"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    campaign.refresh_from_db()
    assert campaign.current_amount == Decimal("50.00")
    assert campaign.progress_percentage == 25

    donation = Donation.objects.get()
    assert donation.campaign == campaign
    assert donation.amount == Decimal("50.00")
    assert donation.stripe_payment_intent_id == "pi_test123"
