import pytest
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from donations.models import News, User


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def moderator(db):
    return User.objects.create_user(
        email="moderator@example.com",
        username="moderator",
        password="SecurePass123!",
        is_moderator=True,
    )


@pytest.fixture
def regular_user(db):
    return User.objects.create_user(
        email="user@example.com",
        username="user",
        password="SecurePass123!",
    )


@pytest.mark.django_db
def test_news_list_hides_unpublished_for_anonymous(client):
    News.objects.create(title="Published", content="Visible", published=True)
    News.objects.create(title="Draft", content="Hidden", published=False)

    url = reverse("news-list")
    response = client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.data
    if isinstance(data, dict) and "results" in data:
        items = data["results"]
    else:
        items = list(data)
    titles = [item["title"] for item in items]
    assert "Published" in titles
    assert "Draft" not in titles


@pytest.mark.django_db
def test_regular_user_cannot_create_news(client, regular_user):
    token = Token.objects.create(user=regular_user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = reverse("news-list")
    response = client.post(
        url,
        {"title": "Unauthorized", "content": "Should fail", "published": True},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert News.objects.count() == 0


@pytest.mark.django_db
def test_moderator_can_create_news_with_media(client, moderator, tmp_path):
    token = Token.objects.create(user=moderator)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    image_file = SimpleUploadedFile("photo.jpg", b"fake-image", content_type="image/jpeg")
    payload = {
        "title": "Relief Update",
        "content": "New developments.",
        "published": True,
        "media_files": [image_file],
    }

    url = reverse("news-list")
    with override_settings(MEDIA_ROOT=str(tmp_path)):
        response = client.post(url, payload, format="multipart")

    assert response.status_code == status.HTTP_201_CREATED
    news = News.objects.get(title="Relief Update")
    assert news.published is True
    assert news.media.count() == 1


@pytest.mark.django_db
def test_moderator_can_update_news(client, moderator):
    news = News.objects.create(title="Initial", content="Old", published=False)

    token = Token.objects.create(user=moderator)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = reverse("news-detail", args=[news.id])
    response = client.patch(url, {"published": True, "content": "Updated"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    news.refresh_from_db()
    assert news.published is True
    assert news.content == "Updated"


@pytest.mark.django_db
def test_regular_user_cannot_delete_news(client, regular_user):
    news = News.objects.create(title="Protected", content="Should remain", published=True)

    token = Token.objects.create(user=regular_user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = reverse("news-detail", args=[news.id])
    response = client.delete(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert News.objects.filter(id=news.id).exists()
