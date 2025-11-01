#!/bin/bash

set -e

# Check for flags
RESET_DATA=false
SHOW_HELP=false

for arg in "$@"; do
    case $arg in
        --reset|-r)
            RESET_DATA=true
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
    echo "  --reset, -r    Reset all data (database, migrations, media files)"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./start-dev.sh              Start development environment"
    echo "  ./start-dev.sh --reset      Reset all data and start fresh"
    exit 0
fi

echo "Starting development environment setup..."

# Reset all data if flag is set
if [ "$RESET_DATA" = true ]; then
    echo ""
    echo "⚠️  RESET MODE: This will delete all data!"
    echo "   - Database will be deleted"
    echo "   - Migration files will be removed"
    echo "   - Media files will be cleared"
    echo ""
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Reset cancelled."
        exit 0
    fi

    echo "Resetting all data..."

    # Kill existing servers first
    if lsof -ti:8000 > /dev/null 2>&1; then
        echo "Killing Django server..."
        lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    fi
    if lsof -ti:5173 > /dev/null 2>&1; then
        echo "Killing React dev server..."
        lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    fi

    # Remove database
    if [ -f "backend/db.sqlite3" ]; then
        echo "Deleting database..."
        rm -f backend/db.sqlite3
    fi

    # Remove migration files (except __init__.py)
    echo "Removing migration files..."
    find backend -path "*/migrations/*.py" -not -name "__init__.py" -type f -delete 2>/dev/null || true

    # Clear media files
    echo "Clearing media files..."
    rm -rf backend/media/* 2>/dev/null || true
    mkdir -p backend/media/campaigns backend/media/news

    # Clear static files
    echo "Clearing static files..."
    rm -rf backend/staticfiles/* 2>/dev/null || true

    echo "✓ Reset complete!"
    echo ""
fi

# Kill any existing Django server instances
echo "Checking for existing Django server..."
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

echo "Cleanup complete. Starting fresh instances..."

# Install Python dependencies in backend
echo "Installing Python dependencies..."
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
pip install -r requirements.txt

# Verify Django installation (fixes potential Python 3.13 compatibility issues)
echo "Verifying Django installation..."
python -c "import django.db.migrations.migration" 2>/dev/null || {
    echo "⚠️  Django migrations module not found, reinstalling Django..."
    pip uninstall -y Django
    pip install Django==4.2.7 --no-cache-dir
    echo "✓ Django reinstalled"
}

# Create media and static directories
echo "Creating media and static directories..."
mkdir -p media
mkdir -p static
mkdir -p staticfiles

# Run migrations
echo "Running migrations..."
python manage.py makemigrations
python manage.py migrate

# Create superuser if it doesn't exist (or recreate if reset)
echo "Creating superuser..."
RESET_FLAG="False"
if [ "$RESET_DATA" = true ]; then
    RESET_FLAG="True"
fi
python manage.py shell << PYTHON_EOF
from donations.models import User
reset_mode = $RESET_FLAG
if reset_mode:
    # In reset mode, delete existing superuser and recreate
    User.objects.filter(email='admin@lendahand.me').delete()
    user = User.objects.create_superuser(
        email='admin@lendahand.me',
        username='admin',
        password='admin',
        is_moderator=True
    )
    print('Superuser created: admin/admin')
else:
    if not User.objects.filter(email='admin@lendahand.me').exists():
        user = User.objects.create_superuser(
            email='admin@lendahand.me',
            username='admin',
            password='admin',
            is_moderator=True
        )
        print('Superuser created: admin/admin')
    else:
        print('Superuser already exists')
PYTHON_EOF

# Seed database
echo "Seeding database..."
python manage.py seed_data

# Install Node dependencies
echo "Installing Node dependencies..."
cd ../frontend
npm install

# Start Django server in background
echo "Starting Django development server..."
cd ../backend
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
echo "Django Admin: http://localhost:8000/admin"
echo "Moderation Dashboard: http://localhost:8000/moderation/"
echo "API Documentation: http://localhost:8000/api/swagger/"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "=========================================="

# Wait for user interrupt
trap "kill $DJANGO_PID $REACT_PID; exit" INT TERM
wait
