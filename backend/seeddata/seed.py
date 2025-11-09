#!/usr/bin/env python3
"""
Seed database with test data using REST API.

This script uses the REST API to create campaigns and news articles,
uploading images and creating all necessary data through HTTP requests.

Usage:
    python3 seed.py [OPTIONS]

Options:
    --api-url URL      API base URL (default: http://localhost:8000/api)
    --help, -h         Show this help message

Examples:
    python3 seed.py
    python3 seed.py --api-url http://localhost:8000/api
    python3 seed.py --api-url https://api.example.com/api

Environment Variables:
    API_BASE_URL       API base URL (overridden by --api-url)
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
SEEDDATA_DIR = SCRIPT_DIR
IMAGES_DIR = SEEDDATA_DIR / "images"


class SeederAPI:
    """Client for seeding data via REST API."""

    def __init__(self, base_url):
        self.base_url = base_url
        self.session = requests.Session()
        self.token = None

    def login(self, email, password):
        """Login and get authentication token."""
        url = f"{self.base_url}/auth/login/"
        response = self.session.post(url, json={"email": email, "password": password})
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            if self.token:
                self.session.headers.update({"Authorization": f"Token {self.token}"})
                print(f"✓ Logged in as {email}")
                return True
        print(f"✗ Login failed: {response.status_code} - {response.text}")
        return False

    def register_user(self, email, password, username=None, password2=None):
        """Register a new user via API. Returns True on success, False if user exists or error."""
        url = f"{self.base_url}/auth/register/"
        data = {
            "email": email,
            "password": password,
            "password2": password2 or password,
            "username": username or email.split("@")[0],
        }
        response = self.session.post(url, json=data)
        if response.status_code in [200, 201]:
            try:
                response_data = response.json()
                self.token = response_data.get("token")
                if self.token:
                    self.session.headers.update({"Authorization": f"Token {self.token}"})
                print(f"✓ Registered user: {email}")
                return True
            except Exception as e:
                print(f"  ⚠ Error parsing registration response: {e}")
                print(f"     Response: {response.text}")
                # Still try to login
                return False
        elif response.status_code == 400:
            # Check if it's because user already exists
            try:
                error_data = response.json() if response.text else {}
                # Check for email field error (user already exists)
                email_errors = error_data.get("email", [])
                if email_errors:
                    # Check if error indicates user already exists
                    error_str = str(email_errors).lower()
                    if "already" in error_str or "exists" in error_str or "unique" in error_str:
                        print(f"  ℹ User {email} already exists")
                    else:
                        print(f"  ⚠ Registration validation error for {email}: {error_data}")
                else:
                    # Other validation errors
                    print(f"  ⚠ Registration validation error for {email}: {error_data}")
            except:
                print(f"  ⚠ Registration failed with 400 status: {response.text}")
            return False
        else:
            print(f"✗ Registration failed: {response.status_code} - {response.text}")
            return False

    def create_news(self, news_data, image_files=None):
        """Create a news article via API."""
        url = f"{self.base_url}/news/"

        data = {
            "title": news_data["title"],
            "content": news_data["content"],
            "published": news_data.get("published", True),
        }

        # Prepare files for upload
        files = []
        if image_files:
            for img_file in image_files:
                if img_file.exists():
                    files.append(("media_files", (img_file.name, open(img_file, "rb"), "image/jpeg")))

        if files:
            response = self.session.post(url, data=data, files=files)
            # Close file handles
            for _, (_, file_handle, _) in files:
                file_handle.close()
        else:
            response = self.session.post(url, json=data)

        if response.status_code in [200, 201]:
            news = response.json()
            print(f"✓ Created news: {news_data['title']}")
            return news
        else:
            print(f"✗ Failed to create news '{news_data['title']}': {response.status_code} - {response.text}")
            return None


def load_json_file(filepath):
    """Load JSON data from file."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"✗ File not found: {filepath}")
        return None
    except json.JSONDecodeError as e:
        print(f"✗ Invalid JSON in {filepath}: {e}")
        return None


def seed_data(api_base_url):
    """Main seeding function."""
    print("=" * 60)
    print("Seeding database via REST API")
    print("=" * 60)
    print(f"API Base URL: {api_base_url}")
    print()

    # Step 1: Load and create users (excluding admin and moderator - created by setup-db.sh)
    print("Step 1: Loading users from users.json...")
    users_file = SEEDDATA_DIR / "users.json"
    users_data = load_json_file(users_file)
    if not users_data:
        print("✗ Failed to load users.json")
        return False

    # Filter out admin and moderator (created by setup-db.sh)
    admin_emails = ["admin@lend-a-hand.me", "moderator@lend-a-hand.me"]
    regular_users_data = [u for u in users_data if u["email"] not in admin_emails]

    # Store user APIs and metadata
    user_apis = {}

    # Login as admin and moderator for news creation (created by setup-db.sh)
    admin_api = SeederAPI(api_base_url)
    moderator_api = SeederAPI(api_base_url)
    users_for_news = []  # Users that can create news

    print("Step 2: Logging in as admin and moderator (created by setup-db.sh)...")
    if admin_api.login("admin@lend-a-hand.me", "admin"):
        users_for_news.append(admin_api)
        print("  ✓ Logged in as admin")
    else:
        print("  ✗ Failed to login as admin (ensure setup-db.sh has been run)")

    if moderator_api.login("moderator@lend-a-hand.me", "moderator"):
        users_for_news.append(moderator_api)
        print("  ✓ Logged in as moderator")
    else:
        print("  ✗ Failed to login as moderator (ensure setup-db.sh has been run)")
    print()

    print(f"Step 3: Creating {len(regular_users_data)} regular users via API...")
    for user_data in regular_users_data:
        email = user_data["email"]
        password = user_data["password"]
        username = user_data["username"]

        # Create API client for this user
        user_api = SeederAPI(api_base_url)

        print(f"  Creating user: {email}...")
        registered = user_api.register_user(email, password, username)

        # If registration failed, try to login (user might already exist)
        if not registered:
            # Create a fresh session for login attempt
            login_api = SeederAPI(api_base_url)
            print(f"  Attempting to login as {email}...")
            if login_api.login(email, password):
                # Login successful - user exists with correct password
                user_api = login_api
                print(f"  ✓ Logged in as existing user: {email}")
            else:
                print(f"  ✗ Failed to setup user: {email}")
                print(f"     Registration failed and login with password '{password}' also failed")
                print(f"     User may exist with different password. Delete user manually or reset password.")
                continue

        # Store the API client
        user_apis[email] = user_api

        # Track users for news creation
        if user_data.get("creates_news", False):
            users_for_news.append(user_api)

        print(f"  ✓ User {email} ready")
    print()

    # Step 4: Create news (requires moderator/admin created by setup-db.sh)
    print("Step 4: Creating news articles...")
    news_file = SEEDDATA_DIR / "news.json"
    news_data = load_json_file(news_file)
    if news_data:
        if not users_for_news:
            print("  ⚠ No users available for creating news")
        else:
            # Use first available user who can create news (typically admin)
            news_api = users_for_news[0]
            for article_data in news_data:
                # Get image files
                image_files = []
                if "images" in article_data:
                    for img_name in article_data["images"]:
                        img_path = IMAGES_DIR / img_name
                        if img_path.exists():
                            image_files.append(img_path)
                        else:
                            print(f"  ⚠ Image not found: {img_name}")

                news_api.create_news(article_data, image_files if image_files else None)
    print()

    print("=" * 60)
    print("Seeding complete!")
    print("=" * 60)
    print()
    print("Test accounts available:")
    print("  Admin:    admin@lend-a-hand.me / admin (created by setup-db.sh)")
    print("  Moderator: moderator@lend-a-hand.me / moderator (created by setup-db.sh)")
    for user_data in regular_users_data:
        email = user_data["email"]
        password = user_data["password"]
        print(f"  {user_data['username']}: {email} / {password}")
    print()
    print("Note: Admin and moderator accounts are created by setup-db.sh, not via API.")
    print()

    return True


def main():
    """Main entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description="Seed database with test data using REST API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 seed.py
  python3 seed.py --api-url http://localhost:8000/api
  python3 seed.py --api-url https://api.example.com/api

Environment Variables:
  API_BASE_URL       API base URL (overridden by --api-url)
        """.strip()
    )

    parser.add_argument(
        "--api-url",
        type=str,
        default=os.getenv("API_BASE_URL", "http://localhost:8000/api"),
        help="API base URL (default: http://localhost:8000/api or API_BASE_URL env var)"
    )

    args = parser.parse_args()

    # Validate API URL
    api_url = args.api_url.rstrip('/')
    if not api_url.startswith(('http://', 'https://')):
        print(f"✗ Error: API URL must start with http:// or https://")
        print(f"  Provided: {api_url}")
        sys.exit(1)

    try:
        success = seed_data(api_url)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nSeeding interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
