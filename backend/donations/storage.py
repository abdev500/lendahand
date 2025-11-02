"""
Custom storage backend for MinIO S3-compatible storage.
Ensures bucket name is included in URLs when using custom domain.
"""
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class MinIOStorage(S3Boto3Storage):
    """
    Custom S3 storage backend for MinIO.

    This backend ensures that when using a custom domain (AWS_S3_CUSTOM_DOMAIN),
    the bucket name is included in the URL path for path-based bucket addressing.

    For MinIO with path-based bucket addressing:
    - URL format: http://custom-domain/bucket-name/path/to/file.jpg
    - Without this fix: http://custom-domain/path/to/file.jpg (bucket missing)
    """

    def url(self, name):
        """
        Override URL generation to include bucket name when using custom domain.
        """
        # Get the base URL from parent class
        url = super().url(name)

        # If using custom domain, ensure bucket name is in the path
        custom_domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)

        if custom_domain and bucket_name:
            # Parse the URL
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(url)

            # Check if bucket name is already in the path
            path_parts = parsed.path.lstrip('/').split('/', 1)
            if path_parts[0] != bucket_name:
                # Bucket name is missing, add it to the path
                # For path-based addressing: /bucket-name/path/to/file
                new_path = f"/{bucket_name}{parsed.path}" if parsed.path.startswith('/') else f"/{bucket_name}/{parsed.path}"
                parsed = parsed._replace(path=new_path)
                url = urlunparse(parsed)

        return url
