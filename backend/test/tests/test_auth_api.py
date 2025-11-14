import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_registration_and_login_flow():
    client = APIClient()
    register_url = reverse("register")
    login_url = reverse("login")
    me_url = reverse("user-me")

    payload = {
        "email": "pytest-user@example.com",
        "username": "pytest_user",
        "password": "StrongPass123!",
        "password2": "StrongPass123!",
        "phone": "+1234567890",
        "address": "123 Test Street",
    }

    response = client.post(register_url, payload, format="json")
    assert response.status_code == status.HTTP_201_CREATED
    token = response.data["token"]
    registered_user = response.data["user"]

    assert registered_user["email"] == payload["email"]
    assert registered_user["username"] == payload["username"]
    assert token

    login_response = client.post(
        login_url,
        {"email": payload["email"], "password": payload["password"]},
        format="json",
    )

    assert login_response.status_code == status.HTTP_200_OK
    assert login_response.data["token"] == token
    assert login_response.data["user"]["email"] == payload["email"]

    unauthorized_response = client.get(me_url)
    assert unauthorized_response.status_code == status.HTTP_401_UNAUTHORIZED

    client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
    me_response = client.get(me_url)

    assert me_response.status_code == status.HTTP_200_OK
    assert me_response.data["email"] == payload["email"]
    assert me_response.data["id"] == registered_user["id"]


@pytest.mark.django_db
def test_login_with_invalid_credentials_returns_error():
    client = APIClient()
    login_url = reverse("login")

    response = client.post(
        login_url,
        {"email": "missing@example.com", "password": "wrongpass"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "error" in response.data

