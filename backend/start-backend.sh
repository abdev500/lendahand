#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$PROJECT_ROOT/venv"

function info() {
  echo -e "\033[1;34m[INFO]\033[0m $1"
}

function warn() {
  echo -e "\033[1;33m[WARN]\033[0m $1"
}

function error() {
  echo -e "\033[1;31m[ERROR]\033[0m $1"
}

info "Starting backend bootstrap..."

PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  error "Python interpreter '$PYTHON_BIN' not found in PATH."
  error "Install Python 3 or set PYTHON_BIN to the desired interpreter."
  exit 1
fi

if [ ! -d "$VENV_PATH" ]; then
  info "Creating virtual environment at $VENV_PATH..."
  "$PYTHON_BIN" -m venv "$VENV_PATH"
else
  info "Using existing virtual environment at $VENV_PATH"
fi

info "Activating virtual environment..."
source "$VENV_PATH/bin/activate"
PYTHON_VENV="$VENV_PATH/bin/python"

info "Upgrading pip and setuptools..."
"$PYTHON_VENV" -m pip install --upgrade pip setuptools >/dev/null

info "Installing backend dependencies..."
"$PYTHON_VENV" -m pip install -r "$PROJECT_ROOT/requirements.txt"

info "Running setup-db.sh (migrations & superuser)..."
chmod +x "$PROJECT_ROOT/setup-db.sh"
"$PROJECT_ROOT/setup-db.sh"

info "Launching Django development server..."
USE_S3_STORAGE_DEFAULT="${USE_S3_STORAGE:-True}"
export USE_S3_STORAGE="$USE_S3_STORAGE_DEFAULT"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-minioadmin}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-minioadmin}"
export AWS_STORAGE_BUCKET_NAME="${AWS_STORAGE_BUCKET_NAME:-lend-a-hand-media}"
export AWS_S3_ENDPOINT_URL="${AWS_S3_ENDPOINT_URL:-http://localhost:9000}"
export AWS_S3_CUSTOM_DOMAIN="${AWS_S3_CUSTOM_DOMAIN:-localhost:9000}"
export AWS_S3_USE_SSL="${AWS_S3_USE_SSL:-False}"

info "Environment for S3 storage:"
echo "  USE_S3_STORAGE=$USE_S3_STORAGE"
echo "  AWS_S3_ENDPOINT_URL=$AWS_S3_ENDPOINT_URL"
echo "  AWS_STORAGE_BUCKET_NAME=$AWS_STORAGE_BUCKET_NAME"

"$PYTHON_VENV" "$PROJECT_ROOT/manage.py" runserver
