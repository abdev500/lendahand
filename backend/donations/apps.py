import logging

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)


class DonationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "donations"

    def ready(self):
        super().ready()
        self._ensure_storage_bucket()

    def _ensure_storage_bucket(self):
        if not getattr(settings, "USE_S3_STORAGE", False):
            return

        bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")
        if not bucket_name:
            logger.warning("USE_S3_STORAGE is True but AWS_STORAGE_BUCKET_NAME is not configured.")
            return

        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError:
            logger.warning("boto3 is required to ensure MinIO/S3 bucket but is not installed.")
            return

        client_kwargs = {
            "service_name": "s3",
            "aws_access_key_id": getattr(settings, "AWS_ACCESS_KEY_ID", None),
            "aws_secret_access_key": getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
        }

        endpoint_url = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url

        region_name = getattr(settings, "AWS_S3_REGION_NAME", None)
        if region_name:
            client_kwargs["region_name"] = region_name

        try:
            s3_client = boto3.client(**client_kwargs)
        except Exception as exc:
            logger.warning("Unable to initialize S3 client for bucket creation: %s", exc)
            return

        try:
            s3_client.head_bucket(Bucket=bucket_name)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "")
            if error_code not in {"404", "NoSuchBucket", "NotFound"}:
                logger.warning("Unable to verify bucket '%s': %s", bucket_name, exc)
                return

            # Bucket does not exist; attempt to create it.
            create_kwargs = {"Bucket": bucket_name}
            if region_name:
                create_kwargs["CreateBucketConfiguration"] = {"LocationConstraint": region_name}

            try:
                s3_client.create_bucket(**create_kwargs)
                logger.info("Created missing bucket '%s' on S3/MinIO.", bucket_name)
            except ClientError as create_exc:
                logger.error("Failed to create bucket '%s': %s", bucket_name, create_exc)
        except Exception as exc:
            logger.warning("Unexpected error while ensuring bucket '%s': %s", bucket_name, exc)
