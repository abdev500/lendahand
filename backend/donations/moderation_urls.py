from django.urls import path

from .moderation_views import moderate_campaign, moderation_dashboard, user_management

app_name = "moderation"

urlpatterns = [
    path("", moderation_dashboard, name="dashboard"),
    path("campaign/<int:campaign_id>/<str:action>/", moderate_campaign, name="moderate"),
    path("users/", user_management, name="users"),
]
