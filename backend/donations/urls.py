from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CampaignViewSet,
    DonationViewSet,
    NewsViewSet,
    UserViewSet,
    health_check,
    login_view,
    logout_view,
    password_reset_confirm,
    password_reset_request,
    register,
    serve_media,
    stripe_webhook,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"campaigns", CampaignViewSet, basename="campaign")
router.register(r"donations", DonationViewSet, basename="donation")
router.register(r"news", NewsViewSet, basename="news")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", health_check, name="health"),
    path("auth/register/", register, name="register"),
    path("auth/login/", login_view, name="login"),
    path("auth/logout/", logout_view, name="logout"),
    path("auth/password-reset/", password_reset_request, name="password-reset-request"),
    path("auth/password-reset-confirm/", password_reset_confirm, name="password-reset-confirm"),
    path("stripe/webhook/", stripe_webhook, name="stripe-webhook"),
    # Media serving endpoint - serves files from MinIO through Django
    path("media/<path:file_path>", serve_media, name="serve-media"),
]
