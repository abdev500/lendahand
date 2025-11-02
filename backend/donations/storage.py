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

    URLs format: /api/media/<file_path>
    Django will proxy the request to MinIO and serve the file.
    """

    def url(self, name):
        """
        Generate URL pointing to Django backend endpoint.

        Instead of direct MinIO URLs, generate Django URLs like:
        /api/media/campaigns/image.jpg

        Django will proxy this to MinIO and serve the file.
        """
        # Generate Django media URL instead of direct MinIO URL
        # Use /api/media/ prefix to route through Django
        # Remove any leading slashes from name to avoid double slashes
        clean_name = name.lstrip('/')
        media_url = f"/api/media/{clean_name}"
        return media_url
