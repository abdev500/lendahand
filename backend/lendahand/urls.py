"""
URL configuration for lendahand project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

schema_view = get_schema_view(
    openapi.Info(
        title="Lend a Hand API",
        default_version="v1",
        description="Donation platform API",
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("donations.urls")),  # This comes first to handle /api/auth/login/
    path("api/auth/", include("rest_framework.urls")),  # For browseable API login
    path("api/swagger/", schema_view.with_ui("swagger", cache_timeout=0), name="schema-swagger-ui"),
    path("api/redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"),
    path("accounts/", include("allauth.urls")),
]

if settings.DEBUG:
    # Media files are served from MinIO (S3 storage), not locally
    # Only serve static files locally
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
