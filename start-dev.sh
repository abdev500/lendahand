#!/bin/bash

set -e

echo "Starting development environment setup..."

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
cd backend
pip install --upgrade pip
pip install -r requirements.txt

# Create media and static directories
echo "Creating media and static directories..."
mkdir -p media
mkdir -p static
mkdir -p staticfiles

# Run migrations
echo "Running migrations..."
python manage.py makemigrations
python manage.py migrate

# Create superuser if it doesn't exist
echo "Creating superuser..."
python manage.py shell << EOF
from donations.models import User
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
EOF

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

