# Seed Data

This folder contains all seed data and scripts for populating the database with test data.

## Structure

- `users.json` - User accounts to create (email, password, username, roles, permissions)
- `news.json` - News article data (title, content, published status, images)
- `images/` - Image files used for news articles
- `seed.py` - Python script that uses the REST API to populate the database

## Usage

### Via start-dev.sh (Recommended)

```bash
./start-dev.sh --populate
```

This will:
1. Start Django server
2. Run the `seed.py` script to populate data via REST API
3. Create test users and news articles

### Direct Usage

```bash
cd backend
python3 seeddata/seed.py
```

Or with a custom API URL:

```bash
python3 seeddata/seed.py --api-url https://api.example.com/api
```

Show help:

```bash
python3 seeddata/seed.py --help
```

**Note**: Make sure the Django server is running on the specified API URL before running the seed script.

## Seeding Process

1. **Login as admin and moderator** (created by `setup-db.sh`)
2. **Load regular users** from `users.json` and create them via API
3. **Create news** using admin/moderator accounts (created by `setup-db.sh`)

## API Endpoints Used

- `POST /api/auth/register/` - Register users
- `POST /api/auth/login/` - Login and get token
- `POST /api/news/` - Create news articles

## Test Accounts

### Created by setup-db.sh

- **Admin**: `admin@lend-a-hand.me` / `admin` (superuser, moderator)
- **Moderator**: `moderator@lend-a-hand.me` / `moderator` (moderator)

### Created by seed process (via API)

- **User1**: `user1@example.com` / `User1Pass123!` (regular user)
- **User2**: `user2@example.com` / `User2Pass123!` (regular user)
- **User**: `user@example.com` / `TestUser123!` (regular user)

**Note**: Admin and moderator accounts are created by `setup-db.sh` during database setup, not via the API seeding process.

## Configuration

The API base URL can be configured via:

1. **Command-line argument** (highest priority):
   ```bash
   python3 seeddata/seed.py --api-url https://api.example.com/api
   ```

2. **Environment variable**:
   ```bash
   export API_BASE_URL=http://localhost:8000/api
   python3 seeddata/seed.py
   ```

3. **Default value** (if neither is provided):
   - Default: `http://localhost:8000/api`

The command-line argument takes precedence over the environment variable, which takes precedence over the default value.
