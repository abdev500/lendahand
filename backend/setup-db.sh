#!/bin/bash

# Database setup script
# Handles migrations, creates initial accounts

set -e

# Get script directory (backend folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for flags
SHOW_HELP=false

for arg in "$@"; do
    case $arg in
        --help|-h)
            SHOW_HELP=true
            ;;
    esac
done

# Show help message
if [ "$SHOW_HELP" = true ]; then
    echo "Usage: ./setup-db.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "Description:"
    echo "  Sets up the database by:"
    echo "    - Creating/updating database migrations"
    echo "    - Running migrations"
    echo "    - Creating initial superuser account (admin@lend-a-hand.me)"
    echo "    - Creating moderator account (moderator@lend-a-hand.me)"
    echo ""
    echo "  Note: Python environment setup (venv, dependencies) is handled by start-dev.sh"
    echo ""
    echo "Examples:"
    echo "  ./setup-db.sh              Setup database (migrations, superuser)"
    echo ""
    echo "Note:"
    echo "  This script assumes Python virtual environment is activated"
    echo "  and dependencies are installed. Run from start-dev.sh or activate venv first."
    exit 0
fi

echo "Setting up database..."

# This script assumes:
# - Python virtual environment is already activated
# - All dependencies are installed
# - Run from start-dev.sh which handles environment setup

# Verify we're in the backend directory
if [ ! -f "manage.py" ]; then
    echo "⚠️  Error: manage.py not found. Please run this script from the backend folder."
    exit 1
fi

# Run migrations
echo "Running migrations..."
python manage.py makemigrations
python manage.py migrate

# Create superuser if it doesn't exist
echo "Creating superuser..."
python manage.py shell << PYTHON_EOF
from donations.models import User
if not User.objects.filter(email='admin@lend-a-hand.me').exists():
    user = User.objects.create_superuser(
        email='admin@lend-a-hand.me',
        username='admin',
        password='admin',
        is_moderator=True
    )
    print('Superuser created: admin@lend-a-hand.me / admin')
else:
    print('Superuser already exists')
PYTHON_EOF

# Create moderator user if it doesn't exist
echo "Creating moderator user..."
python manage.py shell << PYTHON_EOF
from donations.models import User
if not User.objects.filter(email='moderator@lend-a-hand.me').exists():
    user = User.objects.create_user(
        email='moderator@lend-a-hand.me',
        username='moderator',
        password='moderator',
        is_moderator=True
    )
    print('Moderator created: moderator@lend-a-hand.me / moderator')
else:
    print('Moderator already exists')
PYTHON_EOF

echo ""
echo "=========================================="
echo "Database setup complete!"
echo "=========================================="
echo "Admin:    admin@lend-a-hand.me / admin"
echo "Moderator: moderator@lend-a-hand.me / moderator"
echo ""
echo "Next steps:"
echo "  1. Start Django server: python manage.py runserver"
echo "  2. Run seeddata/seed.py (from backend folder) to populate with test data"
echo "  3. Or run ../start-dev.sh --populate (from project root) to start servers and seed"
echo "=========================================="
