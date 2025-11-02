#!/bin/bash

set -e

# Check for flags
RESET_DATA=false
POPULATE_DATA=false
SHOW_HELP=false

for arg in "$@"; do
    case $arg in
        --reset|-r)
            RESET_DATA=true
            ;;
        --populate|-p)
            POPULATE_DATA=true
            ;;
        --help|-h)
            SHOW_HELP=true
            ;;
    esac
done

# Show help message
if [ "$SHOW_HELP" = true ]; then
    echo "Usage: ./start-dev.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --reset, -r      Fully reset all data (database, migrations)"
    echo "  --populate, -p   Run seeddata/seed.py to populate database with test data"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Description:"
    echo "  Starts the development environment:"
    echo "    - Sets up Python environment (venv, dependencies)"
    echo "    - Sets up database (runs setup-db.sh - migrations, superuser)"
    echo "    - Starts MinIO storage service"
    echo "    - Seeds database (if --populate flag is provided)"
    echo "    - Starts Django backend server"
    echo "    - Starts React frontend server"
    echo ""
    echo "  Flags:"
    echo "    --reset        Resets all data (database, migrations)"
    echo "    --populate      Runs seeddata/seed.py to populate database with test data"
    echo "                    Use together: --reset --populate to reset and populate"
    echo ""
    echo "Related scripts:"
    echo "  ./backend/setup-db.sh    Setup database (migrations, initial accounts)"
    echo "  ./backend/seeddata/seed.py  Populate database with test data via API"
    echo ""
    echo "Examples:"
    echo "  ./start-dev.sh                      Start development environment"
    echo "  ./start-dev.sh --reset              Reset all data"
    echo "  ./start-dev.sh --populate           Populate database with test data"
    echo "  ./start-dev.sh --reset --populate   Reset and populate database"
    exit 0
fi

echo "Starting development environment setup..."

# Kill any existing servers first (always do this)
echo "Cleaning up existing processes..."
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "Killing existing Django server on port 8000..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
pkill -f "python.*manage.py runserver" 2>/dev/null || true

# Kill any existing Vite/React dev server instances
echo "Checking for existing React dev server..."
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "Killing existing React dev server on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
pkill -f "vite" 2>/dev/null || true
pkill -f "node.*vite" 2>/dev/null || true

# Kill any existing MinIO instances
echo "Checking for existing MinIO server..."
if lsof -ti:9000 > /dev/null 2>&1; then
    echo "Killing existing MinIO server on port 9000..."
    lsof -ti:9000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
if lsof -ti:9001 > /dev/null 2>&1; then
    echo "Killing existing MinIO console on port 9001..."
    lsof -ti:9001 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
docker ps -q --filter "name=lendahand-minio" | xargs docker stop 2>/dev/null || true

# Reset all data if flag is set
if [ "$RESET_DATA" = true ]; then
    echo ""
    echo "⚠️  RESET MODE: This will delete all data!"
    echo "   - Database will be deleted"
    echo "   - Migration files will be removed"
    echo ""
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Reset cancelled."
        exit 0
    fi

    echo "Resetting all data..."

    # Remove database
    if [ -f "backend/db.sqlite3" ]; then
        echo "Deleting database..."
        rm -f backend/db.sqlite3
    fi

    # Remove migration files (except __init__.py)
    echo "Removing migration files..."
    find backend -path "*/migrations/*.py" -not -name "__init__.py" -type f -delete 2>/dev/null || true

    # Clear static files
    echo "Clearing static files..."
    rm -rf backend/staticfiles/* 2>/dev/null || true

    echo "✓ Reset complete!"
    echo ""
fi

echo "Cleanup complete. Starting fresh instances..."

# Setup Python environment (always needed for Django server)
echo "Setting up Python environment..."
cd backend

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install setuptools (required for pkg_resources)
pip install --upgrade pip setuptools

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Verify Django installation (fixes potential Python 3.13 compatibility issues)
echo "Verifying Django installation..."
python -c "import django.db.migrations.migration" 2>/dev/null || {
    echo "⚠️  Django migrations module not found, reinstalling Django..."
    pip uninstall -y Django
    pip install Django==4.2.7 --no-cache-dir
    echo "✓ Django reinstalled"
}

# Create static directories (always needed)
echo "Creating static directories..."
mkdir -p static
mkdir -p staticfiles

cd ..

# Setup database (migrations, initial accounts) - Always run setup-db.sh
echo "Setting up database..."
cd backend && source venv/bin/activate && ./setup-db.sh && cd ..

# Start MinIO storage service
echo "Starting MinIO storage service..."
SKIP_MINIO=false

# Check if Docker is available and running
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found, skipping MinIO"
    SKIP_MINIO=true
elif ! docker info &> /dev/null; then
    echo "⚠️  Docker daemon is not running, skipping MinIO"
    echo "   Start Docker Desktop or Docker daemon to use MinIO"
    SKIP_MINIO=true
fi

# Only try to start MinIO if Docker is available and running
if [ "$SKIP_MINIO" != "true" ]; then
    cd storage

    # Use docker-compose to start MinIO
    if [ -f "docker-compose.yml" ]; then
        echo "Starting MinIO with docker-compose..."
        if docker-compose up -d 2>&1; then
            # Wait for MinIO to be ready
            echo "Waiting for MinIO to be ready..."
            MAX_RETRIES=30
            RETRY=0
            while [ $RETRY -lt $MAX_RETRIES ]; do
                if curl -s -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
                    echo "✓ MinIO is ready!"
                    break
                fi
                RETRY=$((RETRY + 1))
                sleep 1
                echo -n "."
            done
            echo ""

            if [ $RETRY -eq $MAX_RETRIES ]; then
                echo "⚠️  Warning: MinIO may not be ready. Continuing anyway..."
            fi

            # Create bucket if it doesn't exist
            echo "Checking for bucket 'lendahand-media'..."
            if [ -f "../backend/venv/bin/python3" ]; then
                ../backend/venv/bin/python3 << 'PYTHON_SCRIPT'
import boto3
from botocore.exceptions import ClientError
import sys

try:
    # Connect to MinIO
    s3_client = boto3.client(
        's3',
        endpoint_url='http://localhost:9000',
        aws_access_key_id='minioadmin',
        aws_secret_access_key='minioadmin'
    )

    bucket_name = 'lendahand-media'

    # Check if bucket exists
    try:
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"✓ Bucket '{bucket_name}' already exists")
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        # MinIO may return 404 or other codes for non-existent bucket
        if error_code in ['404', 'NoSuchBucket']:
            # Bucket doesn't exist, create it
            try:
                s3_client.create_bucket(Bucket=bucket_name)
                print(f"✓ Created bucket '{bucket_name}'")
            except ClientError as create_error:
                print(f"⚠️  Failed to create bucket '{bucket_name}': {create_error}", file=sys.stderr)
                sys.exit(1)
        else:
            # Other error (e.g., access denied) - log but don't fail
            print(f"⚠️  Error checking bucket '{bucket_name}': {e}", file=sys.stderr)
            print("   Bucket will be created on first file upload", file=sys.stderr)
            sys.exit(0)
except Exception as e:
    print(f"⚠️  Failed to connect to MinIO or create bucket: {e}", file=sys.stderr)
    print("   Bucket will be created on first file upload", file=sys.stderr)
    sys.exit(0)  # Non-fatal error, continue anyway
PYTHON_SCRIPT
                BUCKET_STATUS=$?
                if [ $BUCKET_STATUS -eq 0 ]; then
                    echo "✓ Bucket check completed"
                else
                    echo "⚠️  Bucket creation had issues, but continuing..."
                fi
            else
                echo "⚠️  Python venv not found, skipping bucket creation"
                echo "   Bucket will be created on first file upload"
            fi

            echo ""
            echo "MinIO started successfully!"
            echo "  API: http://localhost:9000"
            echo "  Console: http://localhost:9001"
            echo "  Credentials: minioadmin/minioadmin"
            echo "  Bucket: lendahand-media"
            echo ""
        else
            echo "⚠️  Failed to start MinIO with docker-compose"
            echo "   Docker may not be running. MinIO will be skipped."
            SKIP_MINIO=true
        fi
    else
        echo "⚠️  docker-compose.yml not found in storage folder, skipping MinIO"
        SKIP_MINIO=true
    fi

    cd ..
fi

# Set environment variable to use MinIO if Docker is available and MinIO started successfully
# Note: MinIO must be running for media files to be stored on the file server
if [ "$SKIP_MINIO" != "true" ] && command -v docker &> /dev/null && docker ps -q --filter "name=lendahand-minio" | grep -q .; then
    export USE_S3_STORAGE="True"
    export AWS_S3_ENDPOINT_URL="http://localhost:9000"
    export AWS_ACCESS_KEY_ID="minioadmin"
    export AWS_SECRET_ACCESS_KEY="minioadmin"
    export AWS_STORAGE_BUCKET_NAME="lendahand-media"
    echo "✓ MinIO storage enabled (USE_S3_STORAGE=True)"
    echo "  Media files will be stored on MinIO file server"
else
    export USE_S3_STORAGE="False"
    echo "⚠️  MinIO storage is not available (USE_S3_STORAGE=False)"
    echo "  Media storage requires MinIO to be running"
    if ! command -v docker &> /dev/null; then
        echo "  To use MinIO: Install Docker and restart start-dev.sh"
    elif ! docker info &> /dev/null; then
        echo "  To use MinIO: Start Docker Desktop and restart start-dev.sh"
    elif ! docker ps -q --filter "name=lendahand-minio" | grep -q .; then
        echo "  To use MinIO: Ensure MinIO container is running"
    fi
fi

# Seed database with test data (after MinIO is configured) - ONLY if populate flag is provided
if [ "$POPULATE_DATA" = true ]; then
    echo "Seeding database with test data..."
    if [ ! -f "backend/db.sqlite3" ]; then
        echo "⚠️  Database not found! Database setup should have created it."
        exit 1
    fi

    # Check if Django server is running
    echo "Checking if Django server is running..."
    if ! curl -s -f http://localhost:8000/api/health/ > /dev/null 2>&1; then
        echo "⚠️  Django server is not running!"
        echo "   Please start the Django server first:"
        echo "   cd backend && source venv/bin/activate && python manage.py runserver"
        echo ""
        echo "   Or restart start-dev.sh - it will start Django server after seeding"
    else
        echo "✓ Django server is running"

        # Activate venv and run seed script
        cd backend
        source venv/bin/activate

        echo "Running seeddata/seed.py..."
        python3 seeddata/seed.py

        cd ..
    fi
else
    echo "✓ Skipping database seeding (use --populate to seed database)"
fi

# Install Node dependencies
echo "Installing Node dependencies..."
# We should be in project root here (after cd .. from backend)
cd frontend
npm install

# Start Django server in background
echo "Starting Django development server..."
cd ../backend
source venv/bin/activate

# Export MinIO environment variables to Django process
if [ "$USE_S3_STORAGE" = "True" ]; then
    export USE_S3_STORAGE="True"
    export AWS_S3_ENDPOINT_URL="$AWS_S3_ENDPOINT_URL"
    export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
    export AWS_STORAGE_BUCKET_NAME="$AWS_STORAGE_BUCKET_NAME"
fi

# Start Django with environment variables
env USE_S3_STORAGE="${USE_S3_STORAGE:-False}" \
    AWS_S3_ENDPOINT_URL="${AWS_S3_ENDPOINT_URL:-}" \
    AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}" \
    AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}" \
    AWS_STORAGE_BUCKET_NAME="${AWS_STORAGE_BUCKET_NAME:-}" \
    python manage.py runserver &
DJANGO_PID=$!

# Start React dev server
echo "Starting React development server..."
cd ../frontend
npm run dev &
REACT_PID=$!

echo ""
echo "=========================================="
echo "Development servers are starting!"
echo "=========================================="
echo "Django API: http://localhost:8000"
echo "React App: http://localhost:5173"
if command -v docker &> /dev/null && docker ps -q --filter "name=lendahand-minio" | grep -q .; then
    echo "MinIO API: http://localhost:9000"
    echo "MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
fi
echo "Django Admin: http://localhost:8000/admin"
echo "Moderation Dashboard: http://localhost:8000/moderation/"
echo "API Documentation: http://localhost:8000/api/swagger/"
echo ""
if [ "$USE_S3_STORAGE" = "True" ]; then
    echo "✓ Media storage: MinIO (S3-compatible)"
else
    echo "⚠️  Media storage: MinIO not available (media uploads will fail)"
fi
echo ""
echo "Press Ctrl+C to stop all servers"
echo "=========================================="

# Wait for user interrupt
trap "kill $DJANGO_PID $REACT_PID; docker stop \$(docker ps -q --filter 'name=lendahand-minio') 2>/dev/null || true; exit" INT TERM
wait
