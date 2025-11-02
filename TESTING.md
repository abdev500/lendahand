# Kubernetes Testing Guide

Quick reference for testing Lend a Hand on Kubernetes.

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://test.lendahand.me | Main application UI |
| **Backend API** | http://api-test.lendahand.me/api | REST API |
| **API Docs** | http://api-test.lendahand.me/api/swagger/ | Swagger UI |
| **Admin Panel** | http://api-test.lendahand.me/admin | Django admin |
| **Moderation** | http://api-test.lendahand.me/moderation/ | Moderation dashboard |
| **MinIO Console** | http://storage-console-test.lendahand.me | MinIO management console |
| **MinIO API** | http://storage-test.lendahand.me | MinIO S3 API (internal use) |

## User Credentials

### Admin/Moderator Accounts

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| **Admin** | `admin@lendahand.me` | `admin` | Superuser, Moderator |
| **Moderator** | `moderator@lendahand.me` | `moderator` | Moderator |

### Regular User Accounts

| User | Email | Password | Can Create Campaigns |
|------|-------|----------|---------------------|
| **User1** | `user1@example.com` | `User1Pass123!` | Yes |
| **User2** | `user2@example.com` | `User2Pass123!` | Yes |
| **TestUser** | `user@example.com` | `TestUser123!` | Yes |

## Service Credentials

### MinIO Storage Console
- **URL**: http://storage-console-test.lendahand.me
- **Username**: `minioadmin`
- **Password**: `minioadmin`
- **Bucket**: `lendahand-media`

### Database (Internal)
- **Host**: `infra-postgresql`
- **Database**: `getdonate`
- **Username**: `postgres`
- **Password**: `postgres`

## Stripe Test Cards

Use these cards with Stripe test keys:

| Card Number | Purpose | Expiry | CVC | ZIP |
|-------------|---------|--------|-----|-----|
| `4242 4242 4242 4242` | ✅ Success | Any future date | Any 3 digits | Any 5 digits |
| `4000 0000 0000 0002` | ❌ Card declined | Any | Any | Any |
| `4000 0000 0000 9995` | ❌ Insufficient funds | Any | Any | Any |

**Note**: Use any future expiry date, any CVC, any ZIP code for all test cards.
