from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, CampaignViewSet, DonationViewSet, NewsViewSet,
    register, login_view, logout_view, stripe_webhook
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'campaigns', CampaignViewSet, basename='campaign')
router.register(r'donations', DonationViewSet, basename='donation')
router.register(r'news', NewsViewSet, basename='news')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', register, name='register'),
    path('auth/login/', login_view, name='login'),
    path('auth/logout/', logout_view, name='logout'),
    path('stripe/webhook/', stripe_webhook, name='stripe-webhook'),
]

