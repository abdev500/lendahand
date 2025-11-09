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
        self._log_startup_diagnostics()

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

    def _log_startup_diagnostics(self):
        self._check_database()
        self._check_minio()
        self._check_stripe()
        self._check_frontend()

    def _check_database(self):
        from django.db import connection

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            logger.info("Startup check: PostgreSQL database connection successful.")
        except Exception as exc:
            logger.error("Startup check: PostgreSQL database connection failed: %s", exc)

    def _check_minio(self):
        if not getattr(settings, "USE_S3_STORAGE", False):
            logger.info("Startup check: MinIO/S3 storage disabled.")
            return

        bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")
        if not bucket_name:
            logger.warning("Startup check: AWS_STORAGE_BUCKET_NAME not configured.")
            return

        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError:
            logger.warning("Startup check: boto3 not installed; cannot verify MinIO/S3.")
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
            s3_client.head_bucket(Bucket=bucket_name)
            logger.info("Startup check: MinIO/S3 bucket '%s' reachable.", bucket_name)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "")
            logger.error(
                "Startup check: Unable to access MinIO/S3 bucket '%s' (code %s): %s",
                bucket_name,
                error_code,
                exc,
            )
        except Exception as exc:
            logger.error("Startup check: Unexpected error while checking MinIO/S3: %s", exc)

    def _check_stripe(self):
        import stripe

        stripe_key = getattr(settings, "STRIPE_SECRET_KEY", "")
        if not stripe_key:
            logger.warning("Startup check: STRIPE_SECRET_KEY not configured.")
            return

        stripe.api_key = stripe_key
        try:
            stripe.Balance.retrieve()
            logger.info("Startup check: Stripe connectivity confirmed.")
        except stripe.error.AuthenticationError:
            logger.error("Startup check: Stripe authentication failed.")
        except Exception as exc:
            logger.error("Startup check: Stripe connectivity error: %s", exc)

    def _check_frontend(self):
        frontend_url = getattr(settings, "FRONTEND_URL", "")
        if not frontend_url:
            logger.warning("Startup check: FRONTEND_URL not configured.")
            return

        try:
            import requests

            response = requests.head(frontend_url, timeout=3)
            logger.info(
                "Startup check: Frontend at %s responded with HTTP %s.",
                frontend_url,
                response.status_code,
            )
            if response.status_code >= 400:
                logger.warning(
                    "Startup check: Frontend at %s returned HTTP %s.",
                    frontend_url,
                    response.status_code,
                )
        except Exception as exc:
            logger.error("Startup check: Unable to reach frontend at %s: %s", frontend_url, exc)
