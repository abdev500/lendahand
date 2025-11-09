#!/usr/bin/env python3
"""
Standalone environment reset script.

Usage:
    python backend/scripts/reset_environment.py
    python backend/scripts/reset_environment.py --noinput --with-seed
"""

import argparse
import os
import sys
from pathlib import Path


def ensure_project_on_path():
    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))


def setup_django():
    ensure_project_on_path()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "lendahand.settings")
    import django  # noqa: WPS433 (import after env setup)

    django.setup()


def reset_database(settings, stdout, stderr):
    from django.core.management import call_command
    from django.db.utils import OperationalError

    default_db = settings.DATABASES.get("default", {})
    engine = default_db.get("ENGINE", "")

    stdout.write(f"Resetting database ({engine})…")

    if "sqlite" in engine:
        db_path = default_db.get("NAME")
        if db_path and db_path != ":memory:":
            db_file = Path(db_path)
            if db_file.exists():
                db_file.unlink()
                stdout.write(f"Removed SQLite file at {db_file}.")
        return

    try:
        call_command("flush", interactive=False, verbosity=0, database="default")
    except OperationalError as exc:
        stderr.write(f"Unable to flush database: {exc}\n")
        sys.exit(1)

    stdout.write("Database flushed.")


def reset_minio(settings, stdout, stderr):
    if not getattr(settings, "USE_S3_STORAGE", False):
        stdout.write("MinIO/S3 storage disabled; skipping.")
        return

    bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")
    if not bucket_name:
        stdout.write("No bucket configured; skipping MinIO reset.")
        return

    stdout.write(f"Clearing MinIO/S3 bucket '{bucket_name}'…")

    try:
        import boto3  # noqa: WPS433
        from botocore.exceptions import ClientError  # noqa: WPS433
    except ImportError:
        stderr.write("boto3 required to clear MinIO/S3 bucket.\n")
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

    s3_client = boto3.client(**client_kwargs)

    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        objects_to_delete = []
        for page in paginator.paginate(Bucket=bucket_name):
            for obj in page.get("Contents", []):
                objects_to_delete.append({"Key": obj["Key"]})
                if len(objects_to_delete) >= 1000:
                    s3_client.delete_objects(Bucket=bucket_name, Delete={"Objects": objects_to_delete})
                    objects_to_delete = []

        if objects_to_delete:
            s3_client.delete_objects(Bucket=bucket_name, Delete={"Objects": objects_to_delete})

        stdout.write("MinIO/S3 bucket cleared.")
    except ClientError as exc:
        stderr.write(f"Unable to clear bucket '{bucket_name}': {exc}\n")
    except Exception as exc:  # noqa: W0703
        stderr.write(f"Unexpected error clearing bucket '{bucket_name}': {exc}\n")


def migrate(stdout):
    from django.core.management import call_command

    stdout.write("Applying migrations…")
    call_command("migrate", interactive=False, verbosity=1)


def seed_data(stdout, stderr):
    from django.conf import settings
    from django.core.management import call_command

    if "seeddata" not in settings.INSTALLED_APPS:
        stdout.write("Seed data app not installed; skipping seeding.")
        return

    try:
        call_command("seeddata")
        stdout.write("Seed data applied.")
    except Exception as exc:  # noqa: W0703
        stderr.write(f"Seeding failed: {exc}\n")


def parse_arguments():
    parser = argparse.ArgumentParser(description="Reset database and MinIO content.")
    parser.add_argument(
        "--noinput",
        action="store_true",
        help="Run without interactive confirmation.",
    )
    parser.add_argument(
        "--with-seed",
        action="store_true",
        help="After reset, run the seeddata command if available.",
    )
    return parser.parse_args()


def main():
    args = parse_arguments()

    if not args.noinput:
        confirm = input("This will DELETE all data in the database and MinIO bucket. " "Type 'reset' to continue: ")
        if confirm.strip().lower() != "reset":
            print("Aborted.")
            return

    setup_django()

    from django.conf import settings  # noqa: WPS433

    stdout = sys.stdout
    stderr = sys.stderr

    reset_database(settings, stdout, stderr)
    reset_minio(settings, stdout, stderr)
    migrate(stdout)

    if args.with_seed:
        seed_data(stdout, stderr)

    stdout.write("Environment reset complete.\n")


if __name__ == "__main__":
    main()
