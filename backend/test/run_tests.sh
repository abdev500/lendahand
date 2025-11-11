#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGDATA=/var/lib/postgresql/data
INITDB_PATH="$(find /usr/lib/postgresql -type f -name initdb -print -quit)"
if [ -z "$INITDB_PATH" ]; then
  INITDB_PATH="$(command -v initdb || true)"
fi
if [ -z "$INITDB_PATH" ]; then
  echo "❌ Unable to locate initdb binary" >&2
  exit 1
fi
PG_BIN="$(dirname "$INITDB_PATH")"
PATH="$PG_BIN:$PATH"

MINIO_DATA_DIR=/tmp/minio-data
AWS_STORAGE_BUCKET_NAME=lendahand-media
MINIO_ENDPOINT=http://127.0.0.1:9000
STRIPE_MOCK_HTTP=12111
STRIPE_MOCK_HTTPS=12112

cleanup() {
  set +e
  echo "🔻 Shutting down services..."
  if [ -n "${MINIO_PID:-}" ] && kill -0 "$MINIO_PID" 2>/dev/null; then
    kill "$MINIO_PID"
    wait "$MINIO_PID" 2>/dev/null || true
  fi
  if [ -n "${STRIPE_MOCK_PID:-}" ] && kill -0 "$STRIPE_MOCK_PID" 2>/dev/null; then
    kill "$STRIPE_MOCK_PID"
    wait "$STRIPE_MOCK_PID" 2>/dev/null || true
  fi
  if [ -x "$PG_BIN/pg_ctl" ] && su postgres -c "PATH=$PG_BIN:\$PATH $PG_BIN/pg_ctl -D $PGDATA status" >/dev/null 2>&1; then
    su postgres -c "PATH=$PG_BIN:\$PATH $PG_BIN/pg_ctl -D $PGDATA -m fast stop" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

wait_for_http() {
  local url="$1"
  local retries="${2:-30}"
  local delay="${3:-1}"
  local attempt=0

  until curl -s -o /dev/null "$url"; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$retries" ]; then
      echo "❌ Timeout waiting for $url"
      return 1
    fi
    sleep "$delay"
  done
}

echo "🚀 Starting PostgreSQL..."
if [ ! -d "$PGDATA" ] || [ ! -f "$PGDATA/PG_VERSION" ]; then
  su postgres -c "PATH=$PG_BIN:\$PATH $PG_BIN/initdb -D $PGDATA"
fi
su postgres -c "PATH=$PG_BIN:\$PATH $PG_BIN/pg_ctl -D $PGDATA -o '-p 5432 -F' -w start"

CREATE_USER_SQL_FILE="$(mktemp)"
cat <<SQL > "$CREATE_USER_SQL_FILE"
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
      EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
   END IF;
END
\$\$;
SQL
chown postgres:postgres "$CREATE_USER_SQL_FILE"
su postgres -c "PATH=$PG_BIN:\$PATH psql -v ON_ERROR_STOP=1 -f \"$CREATE_USER_SQL_FILE\"" < /dev/null
rm -f "$CREATE_USER_SQL_FILE"
su postgres -c "PATH=$PG_BIN:\$PATH psql --command \"ALTER ROLE ${POSTGRES_USER} WITH SUPERUSER;\""
su postgres -c "PATH=$PG_BIN:\$PATH psql --command \"CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};\"" >/dev/null 2>&1 || true

echo "🚀 Starting MinIO..."
rm -rf "$MINIO_DATA_DIR"
mkdir -p "$MINIO_DATA_DIR"
/usr/local/bin/minio server "$MINIO_DATA_DIR" --console-address ":9001" >/tmp/minio.log 2>&1 &
MINIO_PID=$!
wait_for_http "${MINIO_ENDPOINT}/minio/health/live"

echo "🪣 Ensuring S3 bucket ${AWS_STORAGE_BUCKET_NAME} exists..."
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_S3_ENDPOINT_URL=$MINIO_ENDPOINT
export AWS_STORAGE_BUCKET_NAME=$AWS_STORAGE_BUCKET_NAME
python - <<'PYCODE'
import os
import sys
import time

import boto3
from botocore.exceptions import ClientError

endpoint = os.environ["AWS_S3_ENDPOINT_URL"]
bucket = os.environ.get("AWS_STORAGE_BUCKET_NAME", "lendahand-media")
access_key = os.environ["AWS_ACCESS_KEY_ID"]
secret_key = os.environ["AWS_SECRET_ACCESS_KEY"]

client = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
)

for _ in range(20):
    try:
        client.head_bucket(Bucket=bucket)
        break
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code in ("404", "NoSuchBucket", "NotFound"):
            try:
                client.create_bucket(Bucket=bucket)
                break
            except ClientError:
                time.sleep(1)
        else:
            time.sleep(1)
else:
    print(f"Unable to ensure bucket {bucket}", file=sys.stderr)
    sys.exit(1)
PYCODE

echo "🚀 Starting stripe-mock..."
/usr/local/bin/stripe-mock --http-port "${STRIPE_MOCK_HTTP}" --https-port "${STRIPE_MOCK_HTTPS}" >/tmp/stripe-mock.log 2>&1 &
STRIPE_MOCK_PID=$!
if ! wait_for_http "http://127.0.0.1:${STRIPE_MOCK_HTTP}/"; then
  echo "❌ stripe-mock failed to become ready. Recent logs:"
  tail -n 50 /tmp/stripe-mock.log || true
  exit 1
fi

export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export DB_NAME="${POSTGRES_DB}"
export DB_USER="${POSTGRES_USER}"
export DB_PASSWORD="${POSTGRES_PASSWORD}"
export DB_HOST="127.0.0.1"
export DB_PORT="5432"
export USE_S3_STORAGE="True"
export AWS_STORAGE_BUCKET_NAME="${AWS_STORAGE_BUCKET_NAME}"
export AWS_S3_CUSTOM_DOMAIN=""
export AWS_S3_USE_SSL="False"
export FRONTEND_URL="http://localhost:5173"
export STRIPE_SECRET_KEY="sk_test_mockKey"
export STRIPE_PUBLISHABLE_KEY="pk_test_mockKey"
export STRIPE_CLIENT_ID="ca_mock_client"
export STRIPE_API_BASE="http://127.0.0.1:${STRIPE_MOCK_HTTP}"
export STRIPE_WEBHOOK_SECRET="whsec_mock"
export DJANGO_SECRET_KEY="test-secret-key"
export DEBUG="True"
export CORS_ALLOWED_ORIGINS="http://localhost:5173"

echo "⚙️ Applying migrations..."
python manage.py migrate --noinput

echo "🧪 Running pytest suite..."
pytest -c test/pytest.ini test/tests -vv
