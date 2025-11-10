import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.utils import override_settings
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


def promote_to_moderator(user_id):
    user_model = get_user_model()
    user_model.objects.filter(id=user_id).update(is_moderator=True, is_staff=True)


def create_news(client, title, content, published=False, media_file=None, media_root=None):
    payload = {
        "title": title,
        "content": content,
        "published": published,
    }
    kwargs = {"format": "json"}
    if media_file is not None:
        payload["media_files"] = [media_file]
        kwargs["format"] = "multipart"
    if media_root:
        with override_settings(MEDIA_ROOT=str(media_root)):
            response = client.post(reverse("news-list"), payload, **kwargs)
    else:
        response = client.post(reverse("news-list"), payload, **kwargs)
    assert response.status_code == status.HTTP_201_CREATED

    list_response = client.get(reverse("news-list"))
    assert list_response.status_code == status.HTTP_200_OK
    for item in list_results(list_response):
        if item["title"] == title:
            return item["id"], item
    raise AssertionError("News item not found after creation")


@pytest.mark.django_db
def test_news_list_hides_unpublished_for_anonymous(tmp_path):
    mod_token, mod_user = register_user("mod-news@example.com", "mod_news")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)

    create_news(mod_client, "Published", "Visible", published=True)
    create_news(mod_client, "Draft", "Hidden", published=False)

    anonymous_client = APIClient()
    response = anonymous_client.get(reverse("news-list"))
    assert response.status_code == status.HTTP_200_OK
    items = list_results(response)
    titles = [item["title"] for item in items]
    assert "Published" in titles
    assert "Draft" not in titles


@pytest.mark.django_db
def test_regular_user_cannot_create_news():
    user_token, _ = register_user("user-news@example.com", "user_news")
    user_client = make_client(user_token)

    response = user_client.post(
        reverse("news-list"),
        {"title": "Unauthorized", "content": "Should fail", "published": True},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_moderator_can_create_news_with_media(tmp_path):
    mod_token, mod_user = register_user("mod-media@example.com", "mod_media")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)

    image_file = SimpleUploadedFile("photo.jpg", b"fake-image", content_type="image/jpeg")
    news_id, news_item = create_news(
        mod_client,
        "Relief Update",
        "New developments.",
        published=True,
        media_file=image_file,
        media_root=tmp_path,
    )

    assert news_item["published"] is True
    detail_response = mod_client.get(reverse("news-detail", args=[news_id]))
    assert detail_response.status_code == status.HTTP_200_OK
    detail = detail_response.data
    assert len(detail["media"]) == 1


@pytest.mark.django_db
def test_moderator_can_update_news():
    mod_token, mod_user = register_user("mod-update@example.com", "mod_update")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)

    news_id, _ = create_news(mod_client, "Initial", "Old", published=False)

    response = mod_client.patch(
        reverse("news-detail", args=[news_id]),
        {"published": True, "content": "Updated"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK

    detail_response = mod_client.get(reverse("news-detail", args=[news_id]))
    detail = detail_response.data
    assert detail["published"] is True
    assert detail["content"] == "Updated"


@pytest.mark.django_db
def test_regular_user_cannot_delete_news():
    mod_token, mod_user = register_user("mod-delete@example.com", "mod_delete")
    promote_to_moderator(mod_user["id"])
    mod_client = make_client(mod_token)

    news_id, _ = create_news(mod_client, "Protected", "Should remain", published=True)

    user_token, _ = register_user("regular-delete@example.com", "regular_delete")
    user_client = make_client(user_token)

    response = user_client.delete(reverse("news-detail", args=[news_id]))
    assert response.status_code == status.HTTP_403_FORBIDDEN

    detail_response = mod_client.get(reverse("news-detail", args=[news_id]))
    assert detail_response.status_code == status.HTTP_200_OK
