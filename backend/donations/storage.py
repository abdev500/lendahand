"""
Custom storage backend for MinIO S3-compatible storage.
Generates URLs that point to Django backend for serving files.
"""

from django.conf import settings
from django.urls import reverse
from storages.backends.s3boto3 import S3Boto3Storage


class MinIOStorage(S3Boto3Storage):
    """
    Custom S3 storage backend for MinIO.

    This backend generates URLs that point to Django backend endpoints
    instead of directly to MinIO, allowing Django to proxy/serve files.

    URLs format: https://api.lend-a-hand.me/api/media/<file_path>
    Django will proxy the request to MinIO and serve the file.
    """

    def url(self, name):
        """
        Generate absolute URL pointing to Django backend endpoint.

        Returns absolute URLs like:
        https://api.lend-a-hand.me/api/media/campaigns/image.jpg

        This is important for compatibility with in-app browsers (like Telegram)
        that don't handle relative URLs correctly.

        Django will proxy this to MinIO and serve the file.
        """
        # Get backend base URL from settings
        # BACKEND_URL should be set in environment (e.g., https://api.lend-a-hand.me)
        backend_url = getattr(settings, "BACKEND_URL", None)

        # Remove any leading slashes from name to avoid double slashes
        clean_name = name.lstrip("/")

        if backend_url:
            # Return absolute URL for production/deployment
            # Remove trailing slash from backend_url if present
            backend_url = backend_url.rstrip("/")
            media_url = f"{backend_url}/api/media/{clean_name}"
        else:
            # Fallback to relative URL for local development
            media_url = f"/api/media/{clean_name}"

        return media_url
