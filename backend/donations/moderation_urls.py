from django.urls import path

from .moderation_views import (moderate_campaign, moderation_dashboard,
                               news_management, toggle_news, user_management)

app_name = "moderation"

urlpatterns = [
    path("", moderation_dashboard, name="dashboard"),
    path(
        "campaign/<int:campaign_id>/<str:action>/", moderate_campaign, name="moderate"
    ),
    path("users/", user_management, name="users"),
    path("news/", news_management, name="news"),
    path("news/<int:news_id>/toggle/", toggle_news, name="toggle_news"),
]
