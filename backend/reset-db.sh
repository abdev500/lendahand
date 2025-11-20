#!/bin/bash

# Reset Database and Storage Script
# Simple script to run inside Docker backend container
# Drops PostgreSQL database and deletes MinIO bucket

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Get script directory (backend folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration from environment variables (set in docker-compose.yml)
# Parse DATABASE_URL: postgres://user:password@host:port/database
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

# Extract components from DATABASE_URL
# Remove postgres:// prefix
DB_URL="${DATABASE_URL#postgres://}"
# Extract user:password@host:port/database
DB_CREDENTIALS="${DB_URL%%@*}"
DB_REST="${DB_URL#*@}"
# Split user and password
POSTGRES_USER="${DB_CREDENTIALS%%:*}"
POSTGRES_PASSWORD="${DB_CREDENTIALS#*:}"
# Split host:port and database
DB_HOST_PORT="${DB_REST%%/*}"
POSTGRES_DB="${DB_REST#*/}"
# Split host and port
POSTGRES_HOST="${DB_HOST_PORT%%:*}"
POSTGRES_PORT="${DB_HOST_PORT#*:}"
# Default port if not specified
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

MINIO_ENDPOINT="${AWS_S3_ENDPOINT_URL:-http://minio:9000}"
MINIO_ACCESS_KEY="${AWS_ACCESS_KEY_ID:-minioadmin}"
MINIO_SECRET_KEY="${AWS_SECRET_ACCESS_KEY:-minioadmin}"
MINIO_BUCKET="${AWS_STORAGE_BUCKET_NAME:-lendahand-media}"

# Check for confirmation flag
FORCE=false
for arg in "$@"; do
    case $arg in
        --force|-f)
            FORCE=true
            ;;
        --help|-h)
            echo "Usage: ./reset-db.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force, -f    Skip confirmation prompt"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Description:"
            echo "  This script will:"
            echo "    - Drop and recreate PostgreSQL database (from DATABASE_URL)"
            echo "    - Delete MinIO bucket: ${MINIO_BUCKET}"
            echo ""
            echo "⚠️  WARNING: This will DELETE ALL DATA!"
            exit 0
            ;;
    esac
done

# Confirmation prompt
if [ "$FORCE" = false ]; then
    echo -e "${RED}⚠️  WARNING: This will DELETE ALL DATA!${NC}"
    echo ""
    echo "This script will:"
    echo "  - Drop PostgreSQL database: ${POSTGRES_DB}"
    echo "  - Delete MinIO bucket: ${MINIO_BUCKET}"
    echo ""
    echo -e "${YELLOW}Are you sure you want to continue? (yes/no):${NC} "
    read -r confirmation
    if [ "$confirmation" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "Resetting Database and Storage"
echo "=========================================="
echo ""

# ============================================
# 1. Reset PostgreSQL Database
# ============================================
echo -e "${YELLOW}[1/2] Resetting PostgreSQL database...${NC}"

# Check if psql is available
if ! command -v psql >/dev/null 2>&1; then
    echo -e "${RED}  ✗ psql not found. Install postgresql-client.${NC}"
    exit 1
fi

# Drop and recreate database
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres <<EOF
-- Terminate all connections to the database
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();

-- Drop database
DROP DATABASE IF EXISTS ${POSTGRES_DB};

-- Create database
CREATE DATABASE ${POSTGRES_DB};
EOF

echo -e "${GREEN}  ✓ PostgreSQL database reset${NC}"
echo ""

# ============================================
# 2. Reset MinIO Bucket
# ============================================
echo -e "${YELLOW}[2/2] Resetting MinIO bucket...${NC}"

# Check if mc (MinIO Client) is available
if ! command -v mc >/dev/null 2>&1; then
    echo -e "${RED}  ✗ mc (MinIO Client) not found. Please install it in the Dockerfile.${NC}"
    exit 1
fi

# Setup mc alias
echo "  Configuring MinIO client..."
mc alias set local "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" 2>/dev/null || true

# Wait for MinIO to be ready
echo "  Waiting for MinIO to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if mc admin info local >/dev/null 2>&1; then
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}  ✗ MinIO is not accessible at ${MINIO_ENDPOINT}${NC}"
    exit 1
fi

# Remove bucket if it exists
if mc ls local/"${MINIO_BUCKET}" >/dev/null 2>&1; then
    echo "  Deleting bucket contents..."
    mc rm --recursive --force local/"${MINIO_BUCKET}" || true
    echo "  Removing bucket..."
    mc rb --force local/"${MINIO_BUCKET}" || true
else
    echo "  Bucket does not exist, skipping deletion"
fi

# Recreate bucket
echo "  Creating bucket..."
mc mb local/"${MINIO_BUCKET}" || true
mc anonymous set download local/"${MINIO_BUCKET}" || true

echo -e "${GREEN}  ✓ MinIO bucket reset${NC}"

echo ""
echo "=========================================="
echo -e "${GREEN}Reset complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Run migrations: python manage.py migrate"
echo "  2. Create superuser: python manage.py createsuperuser"
echo "  3. Or run: ./setup-db.sh"
echo ""
