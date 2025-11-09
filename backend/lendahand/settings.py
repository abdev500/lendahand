"""
Django settings for lend-a-hand project.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-key-change-in-production")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv("DEBUG", "True") == "True"

ALLOWED_HOSTS = ["*"] if DEBUG else os.getenv("ALLOWED_HOSTS", "").split(",")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    # Third party
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.apple",
    "parler",
    "drf_yasg",
    "storages",  # S3/MinIO storage backend
    # Local apps
    "donations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "donations.middleware.DisableCSRFForAPI",  # Exempt API from CSRF
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "donations.middleware.TokenAuthenticationMiddleware",  # Token auth for template views
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "lendahand.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "lendahand.wsgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql" if os.getenv("DATABASE_URL") else "django.db.backends.sqlite3",
        "NAME": os.getenv("DB_NAME", BASE_DIR / "db.sqlite3"),
        "USER": os.getenv("DB_USER", ""),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", ""),
        "PORT": os.getenv("DB_PORT", ""),
    }
}

# If DATABASE_URL is provided (production), use it
if os.getenv("DATABASE_URL"):
    try:
        import dj_database_url

        DATABASES["default"] = dj_database_url.config(default=os.getenv("DATABASE_URL"))
    except ImportError:
        pass

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en"
LANGUAGES = [
    ("en", "English"),
    ("ru", "Russian"),
    ("be", "Belarusian"),
    ("lt", "Lithuanian"),
    ("uk", "Ukrainian"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]

TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media files - MinIO (S3-compatible) storage or local fallback
USE_S3_STORAGE = os.getenv("USE_S3_STORAGE", "False") == "True"

# Check if we're running database setup operations (makemigrations, migrate, createsuperuser)
# These operations don't need MinIO storage and should be allowed to run
import sys

IS_DB_SETUP = any(cmd in sys.argv for cmd in ["makemigrations", "migrate", "createsuperuser", "shell", "dbshell"])

if USE_S3_STORAGE:
    # MinIO/S3 storage configuration
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "minioadmin")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
    AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "lend-a-hand-media")
    AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "http://localhost:9000")
    AWS_S3_CUSTOM_DOMAIN = os.getenv("AWS_S3_CUSTOM_DOMAIN", None)
    AWS_S3_USE_SSL = os.getenv("AWS_S3_USE_SSL", "False") == "True"
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = "public-read"
    AWS_S3_OBJECT_PARAMETERS = {
        "CacheControl": "max-age=86400",  # Cache for 1 day
    }

    # Use custom S3 storage backend for MinIO (ensures bucket name in URLs)
    DEFAULT_FILE_STORAGE = "donations.storage.MinIOStorage"

    # Media URL configuration
    if AWS_S3_CUSTOM_DOMAIN:
        # Include bucket name in path for MinIO S3 API compatibility
        MEDIA_URL = f'{"https" if AWS_S3_USE_SSL else "http"}://{AWS_S3_CUSTOM_DOMAIN}/{AWS_STORAGE_BUCKET_NAME}/'
    else:
        # Use MinIO endpoint directly
        MEDIA_URL = f"{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/"
else:
    # Local file storage is disabled - require MinIO storage
    # Exception: Allow during database setup operations
    if not IS_DB_SETUP:
        raise ValueError(
            "ERROR: Local media storage is not allowed. MinIO storage must be enabled.\n"
            "\n"
            "To fix this:\n"
            "1. Ensure Docker is running (MinIO requires Docker)\n"
            "2. Set USE_S3_STORAGE=True environment variable\n"
            "3. Set required MinIO environment variables:\n"
            "   - AWS_S3_ENDPOINT_URL (default: http://localhost:9000)\n"
            "   - AWS_ACCESS_KEY_ID (default: minioadmin)\n"
            "   - AWS_SECRET_ACCESS_KEY (default: minioadmin)\n"
            "   - AWS_STORAGE_BUCKET_NAME (default: lend-a-hand-media)\n"
            "\n"
            "If using start-dev.sh, ensure MinIO container is running:\n"
            "  - Docker Desktop must be started\n"
            "  - MinIO container should be running (check with: docker ps)\n"
            "\n"
            "Current environment:\n"
            f"  USE_S3_STORAGE={os.getenv('USE_S3_STORAGE', 'not set')}\n"
            f"  AWS_S3_ENDPOINT_URL={os.getenv('AWS_S3_ENDPOINT_URL', 'not set')}\n"
        )
    else:
        # Allow during database setup operations (no media storage needed)
        MEDIA_URL = f"{os.getenv('AWS_S3_ENDPOINT_URL', 'http://localhost:9000')}/{os.getenv('AWS_STORAGE_BUCKET_NAME', 'lend-a-hand-media')}/"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Custom User Model
AUTH_USER_MODEL = "donations.User"

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        # SessionAuthentication removed to avoid CSRF issues with API endpoints
        # 'rest_framework.authentication.SessionAuthentication',
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "donations.exceptions.custom_exception_handler",
}

# CORS
# Get allowed origins from environment variable or use defaults
CORS_ALLOWED_ORIGINS_ENV = os.getenv("CORS_ALLOWED_ORIGINS", "")
CORS_ALLOWED_ORIGINS = (
    [origin.strip() for origin in CORS_ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
    if CORS_ALLOWED_ORIGINS_ENV
    else [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://test.lend-a-hand.me",
        "https://test.lend-a-hand.me",
        "http://dev.lend-a-hand.me",
        "https://dev.lend-a-hand.me",
        "https://lend-a-hand.me",
    ]
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Allow all origins in debug mode
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]
CORS_EXPOSE_HEADERS = [
    "authorization",
    "content-type",
]

# Django Allauth
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

SITE_ID = 1

ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_VERIFICATION = "none"

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
# Frontend URL for redirects (Stripe Checkout success/cancel URLs)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
STRIPE_CLIENT_ID = os.getenv("STRIPE_CLIENT_ID", "")
STRIPE_ONBOARDING_RETURN_URL = os.getenv(
    "STRIPE_ONBOARDING_RETURN_URL", f"{FRONTEND_URL}/dashboard?stripe_onboarding=complete"
)
STRIPE_ONBOARDING_REFRESH_URL = os.getenv(
    "STRIPE_ONBOARDING_REFRESH_URL", f"{FRONTEND_URL}/dashboard?stripe_onboarding=refresh"
)

# Parler (Localization)
PARLER_LANGUAGES = {
    None: (
        {"code": "en"},
        {"code": "ru"},
        {"code": "be"},
        {"code": "lt"},
        {"code": "uk"},
    ),
    "default": {
        "fallbacks": ["en"],
        "hide_untranslated": False,
    },
}

# Swagger
SWAGGER_SETTINGS = {"SECURITY_DEFINITIONS": {"Token": {"type": "apiKey", "name": "Authorization", "in": "header"}}}

# Email Configuration
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False") == "False"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@lend-a-hand.me")

# Password Reset Configuration
PASSWORD_RESET_TIMEOUT = 86400  # 24 hours in seconds
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
