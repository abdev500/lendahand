# Lend a Hand - Donation Platform

A full-stack donation platform built with Django REST Framework and React.

## Features

- **Campaign Management**: Create, edit, and manage fundraising campaigns
- **Stripe Integration**: Secure payment processing via Stripe Checkout
- **Moderation System**: Campaign approval workflow for moderators
- **Multi-language Support**: English, Russian, Belarusian, Lithuanian, Ukrainian
- **User Dashboard**: Manage campaigns, view statistics
- **News System**: Localized news entries
- **REST API**: Full API with Swagger documentation

## Technology Stack

- **Backend**: Django 4.2, Django REST Framework
- **Frontend**: React 18, Vite
- **Database**: PostgreSQL (production), SQLite (development)
- **Payments**: Stripe Checkout
- **Deployment**: Docker, Docker Compose

## Quick Start

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd bs
   ```

2. **Run the development setup script**:
   ```bash
   ./start-dev.sh
   ```

   This script will:
   - Create a Python virtual environment
   - Install Python dependencies
   - Run database migrations
   - Create a superuser (admin/admin)
   - Seed the database with sample data
   - Install Node.js dependencies
   - Start Django and React development servers

3. **Access the application**:
   - React App: http://localhost:5173
   - Django API: http://localhost:8000
   - Admin Panel: http://localhost:8000/admin (admin/admin)
   - Moderation Dashboard: http://localhost:8000/moderation/
   - API Documentation: http://localhost:8000/api/swagger/

### Manual Setup

If you prefer to set up manually:

#### Backend

1. **Create and activate virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Set up environment variables** (create `.env` file):
   ```bash
   DJANGO_SECRET_KEY=your-secret-key
   STRIPE_SECRET_KEY=your-stripe-secret-key
   STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
   STRIPE_ONBOARDING_RETURN_URL=http://localhost:5173/dashboard?stripe_onboarding=complete
   STRIPE_ONBOARDING_REFRESH_URL=http://localhost:5173/dashboard?stripe_onboarding=refresh
   ```

4. **Run migrations**:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Create superuser**:
   ```bash
   python manage.py createsuperuser
   ```

6. **Start Django server**:
   ```bash
   python manage.py runserver
   ```

#### Frontend

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

## Production Deployment

### Using Docker

1. **Build and start services**:
   ```bash
   docker-compose up -d
   ```

2. **Set environment variables** in `docker-compose.yml`:
   ```yaml
   environment:
     - DJANGO_SECRET_KEY=your-secret-key
     - STRIPE_SECRET_KEY=your-stripe-secret-key
     - STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
     - STRIPE_ONBOARDING_RETURN_URL=https://your-frontend-host/dashboard?stripe_onboarding=complete
     - STRIPE_ONBOARDING_REFRESH_URL=https://your-frontend-host/dashboard?stripe_onboarding=refresh
     - DATABASE_URL=postgres://user:password@db:5432/dbname
   ```

3. **Build React app**:
   ```bash
   cd frontend
   npm run build
   ```

   The built files will be in `backend/static` and served by Django/Whitenoise.

### Environment Variables

Create a `.env` file or set these environment variables:

- `DJANGO_SECRET_KEY`: Django secret key
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret (optional)
- `STRIPE_ONBOARDING_RETURN_URL`: URL users return to after completing Stripe onboarding
- `STRIPE_ONBOARDING_REFRESH_URL`: URL Stripe calls when onboarding link expires and user needs a new link
- `DATABASE_URL`: PostgreSQL connection string (production)
- `DEBUG`: Set to `False` in production
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts

## Default Users

After running `setup-db.sh`, these users are available:

- **Admin**: `admin@lendahand.me` / `admin` (superuser, moderator)
- **Moderator**: `moderator@lendahand.me` / `moderator` (moderator)
- **User**: `user@example.com` / `password` (regular user)

## API Endpoints

- `/api/campaigns/` - List/create campaigns
- `/api/campaigns/{id}/` - Campaign details
- `/api/donations/` - List donations
- `/api/donations/create_checkout_session/` - Create Stripe checkout
- `/api/news/` - List news
- `/api/auth/register/` - User registration
- `/api/auth/login/` - User login
- `/api/auth/logout/` - User logout
- `/api/users/me/` - Current user info

Full API documentation available at `/api/swagger/`

## Project Structure

```
bs/
├── backend/              # Django backend
│   ├── donations/        # Main app
│   ├── lendahand/        # Project settings
│   ├── templates/        # Django templates
│   └── manage.py
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── api/          # API client
│   │   └── i18n.js       # Localization
│   └── package.json
├── doc/                  # Documentation
├── docker-compose.yml    # Docker setup
├── Dockerfile           # Django container
└── start-dev.sh         # Development script
```

## Features Implementation

- ✅ Custom User model with email, phone, address
- ✅ Campaign CRUD with moderation
- ✅ Stripe Checkout integration
- ✅ Moderation dashboard
- ✅ REST API with Swagger
- ✅ React frontend with routing
- ✅ Multi-language support
- ✅ News system with localization
- ✅ Media upload (images/videos)
- ✅ User dashboard
- ✅ Responsive design

## License

This project is part of the lend-a-hand.me platform.
