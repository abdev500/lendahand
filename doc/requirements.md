# Lend a Hand Donation Platform – Comprehensive Requirements (2025-11-09)

## 1. Purpose and Scope
The platform enables individuals and organisations to host fundraising campaigns and accept online donations under the **lend-a-hand.me** brand. This document consolidates current behaviour captured in code, seed content, and existing documentation, and defines the requirements baseline for ongoing work.
- Deliver a responsive web experience for donors, campaign owners, moderators, and administrators.
- Provide a stable public REST API that powers the React frontend and potential mobile clients.
- Support Stripe Connect Express for compliant payment processing and payouts directly to campaign owners.
- Maintain localisation for the supported language set and ensure content parity across locales.
- Exclude features not yet implemented (e.g., third-party OAuth logins) from the committed production scope until explicitly prioritised.

## 2. Stakeholders and Roles
The system supports multiple user classes, each with distinct permissions and expectations.
- **Guest / Donor**: Browses campaigns, reads news, and donates without authentication.
- **Registered User / Campaign Owner**: Manages profile, Stripe onboarding, creates and maintains campaigns, monitors donations.
- **Moderator**: Reviews campaigns, manages user activation, curates news, and oversees Stripe readiness compliance.
- **Administrator**: Has full Django admin access, inherits moderator capabilities, and manages platform configuration.
- **Engineering & Operations**: Develop, deploy, and monitor the stack (backend, frontend, storage, Stripe, infrastructure).

## 3. System Overview
The solution is a full-stack web application composed of a Django REST backend and a React (Vite) frontend, complemented by optional auxiliary services.
- **Backend**: Django 4.2 project (`backend/`) with `donations` app delivering REST API, Stripe integration, moderation, and media handling.
- **Frontend**: React 18 single-page app (`frontend/`) consuming the REST API, managing client-side routing, and runtime configuration via `config.js`.
- **Data Stores**: PostgreSQL in production, SQLite in development; MinIO (S3-compatible) optional for media, otherwise local storage.
- **Payments**: Stripe Checkout and Stripe Connect Express for direct payouts to campaign owners.
- **Deployment**: Docker/Docker Compose for local use, Helm charts (`devops/`) for Kubernetes environments.

## 4. Functional Requirements

### 4.1 Authentication & Identity
- Users register with email (unique), username, password confirmation, and optional phone/address.
- Login uses token-based authentication; backend issues DRF tokens and frontend stores them in `localStorage`.
- Password management includes change (authenticated) and reset flows with email delivery and time-bound tokens.
- Sessionless API design: `TokenAuthentication` middleware bridges token access for non-API views; CSRF is disabled for `/api/` routes.
- Future OAuth logins (Google/Apple) remain backlog items until prioritised and implemented.

### 4.2 Stripe Onboarding & Account Readiness
- Each campaign owner must create or link a Stripe Connect Express account before campaigns enter moderation or accept donations.
- Backend persists `UserStripeAccount` records with readiness flags (`charges_enabled`, `payouts_enabled`, `details_submitted`, outstanding requirements, dashboard link).
- Dashboard surfaces Stripe status, outstanding tasks, onboarding link refresh, and dashboard access via generated login link.
- Stripe onboarding and status endpoints enforce the readiness gate on campaign submission, approval, and donation availability.
- Stripe webhook handlers update stored account state and cascade readiness to associated campaigns.

### 4.3 Campaign Management
- Campaign entity includes title, short description, rich HTML description, target amount, current amount, moderation notes, Stripe readiness flag, creator relationship, timestamps.
- Media support allows up to six ordered files per campaign (images or videos), stored locally or via S3-compatible storage.
- Campaign creation automatically enforces Stripe readiness; submissions default to `draft` until onboarding is complete.
- Editing a campaign resets moderated states (`approved` or `rejected` revert to `pending`) and clears moderator notes.
- Owners can suspend or cancel their campaigns; moderators can resume suspended/cancelled campaigns if Stripe-ready.

#### Campaign Status Matrix

| Status       | Description                                 | Owner Actions                      | Moderator Actions                 |
|--------------|---------------------------------------------|------------------------------------|-----------------------------------|
| `draft`      | Editable, not visible publicly               | Submit for moderation, cancel      | None                              |
| `pending`    | Awaiting moderation, hidden from public      | Suspend, cancel                    | Approve, reject (notes required)  |
| `approved`   | Visible and open to donations                | Suspend                            | Suspend, resume                   |
| `rejected`   | Moderation denied with notes                 | Edit (resubmits), cancel           | None                              |
| `suspended`  | Temporarily halted by owner/moderator        | Cancel                             | Resume (requires Stripe readiness)|
| `cancelled`  | Closed permanently by owner                  | None                               | Resume (treated as approval)      |

### 4.4 Moderation Workflow
- Moderators access a dedicated dashboard tab listing campaigns with filtering by status.
- Approval requires campaign Stripe readiness; rejection mandates free-text explanation captured as moderation notes.
- All moderation actions (`approve`, `reject`, `suspend`, `resume`) create immutable `ModerationHistory` entries linked to moderator identity and timestamp.
- Moderators can view historical decisions within each campaign to maintain auditability.
- User activation toggles allow moderators/admins to deactivate problematic accounts (self-deactivation prevented).

### 4.5 Donations & Payments
- Donors initiate Stripe Checkout sessions without authentication; amounts must be positive and specified in EUR.
- Backend validates campaign approval and Stripe readiness before session creation and embeds transfer data targeting the owner’s Stripe account.
- Successful payments are confirmed via Stripe webhook (`checkout.session.completed`) or manual confirmation endpoint; duplicates are prevented by tracking `stripe_payment_intent_id`.
- Donation records store amount, campaign, anonymous donor placeholders, and timestamps; campaign `current_amount` aggregates donations.
- Campaign detail page displays progress bars, raised/target amounts, donation history table, and disables donate button when Stripe readiness is false.

### 4.6 Dashboard & Account Area
- Authenticated users access a dashboard summarising their campaigns, moderation notes, Stripe readiness, and next steps.
- Campaign owners can create, edit, submit, suspend, and cancel campaigns, with UI guards reflecting status-based permissions.
- Stripe connection section surfaces onboarding URL, outstanding requirements, refresh controls, and direct dashboard access when available.
- Moderators gain additional tabs for moderation queue, news management, and user administration.
- User settings area supports profile updates (phone, address) and password change with validation feedback.

### 4.7 News Management
- News entries comprise title, rich text content, publish flag, timestamps, and associated media (up to six files).
- Public users see only published news ordered by recency; moderators/staff can view drafts and manage lifecycle.
- Moderators create, edit, publish/unpublish, and delete news via dashboard controls; confirmations appear in UI.
- Optional legacy single-image field remains for backward compatibility but is superseded by `NewsMedia`.

### 4.8 Public Site & Navigation
- Home page hero promotes donation call-to-action and highlights brand identity; campaign cards exposed on campaigns listing.
- Campaign listing filters to approved and Stripe-ready campaigns; includes progress indicators and quick actions.
- Campaign detail view provides carousel media gallery, moderation warnings (draft/pending), donation workflow, and history table.
- Navigation header includes campaigns, news, login/logout, dashboard, moderation/admin links (role-based), and language selector.
- News page renders published articles chronologically with localisation support.

### 4.9 Localisation & Content
- Supported locales: English, Russian, Belarusian, Lithuanian, Ukrainian; automatic language detection with manual switcher.
- Translation resources maintained in `frontend/src/i18n.js`; ensure key coverage for new UI strings across locales.
- Backend responses should remain language-neutral (English) while frontend handles display strings.
- News entries require at minimum English and Russian content; other locales fallback to English when translations are missing.

### 4.10 Media & File Storage
- Default storage uses local filesystem under `backend/media/`; optional MinIO/S3 integration activated via `USE_S3_STORAGE`.
- Media endpoints support streaming via Django proxy when using S3-compatible storage to avoid exposing buckets directly.
- Uploaded campaign and news media enforce six-file cap, file ordering, and type detection (image/video) for rendering decisions.
- Static frontend build outputs to `backend/static/` for Whitenoise serving in production.
- Seed data provides representative campaign imagery and news assets for development/testing.

### 4.11 API & Integration Surface
- REST API hosted under `/api/`, documented with Swagger (`/api/swagger/`); includes routers for users, campaigns, donations, news.
- Authentication endpoints: register, login, logout, password reset request/confirm, Stripe onboarding/status.
- Campaign endpoints include CRUD operations, moderation actions (`approve`, `reject`, `suspend`, `resume`, `cancel`), and media associations.
- Donation endpoints provide listing, Stripe checkout session creation, and payment confirmation.
- News endpoints expose CRUD operations with permission gating; list endpoint respects publish status per role.
- Ancillary endpoints include health check (`/api/health/`), Stripe webhook handler, and media proxy.

## 5. Data Model Summary
- **User**: Email-unique identity with username, phone, address, `is_moderator`, `is_staff`, `is_active`, timestamps.
- **UserStripeAccount**: One-to-one with User; stores Stripe account ID, readiness booleans, outstanding requirements array, onboarding/dashboard URLs, timestamps.
- **Campaign**: Fundraising entity with textual fields, monetary target/progress, status enum, moderation notes, creator link, Stripe readiness flag, timestamps.
- **CampaignMedia**: Ordered campaign assets with type, file path, created timestamp; enforces unique `(campaign, order)`.
- **Donation**: Records amount, campaign link, anonymous donor placeholders, Stripe payment intent, created timestamp.
- **ModerationHistory**: Tracks moderation actions, moderator reference, notes, timestamp for each campaign decision.
- **News**: Editorial entries with title, content, optional legacy image, publish flag, timestamps.
- **NewsMedia**: Ordered media assets for news items, mirroring campaign media behaviour.

## 6. External Integrations & Configuration
- Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`) plus return/refresh URLs must be set per environment.
- Application URLs (`FRONTEND_URL`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`) configured via environment variables or `.env` files.
- Optional MinIO/S3 variables: `USE_S3_STORAGE`, `AWS_S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME`, SSL flags.
- Email delivery for password reset depends on `DEFAULT_FROM_EMAIL` and SMTP settings aligned with Django configuration.
- Runtime frontend API base configured through `REACT_APP_API_URL` injected at container startup.

## 7. Environments & Deployment
- Development bootstrap script (`start-dev.sh`) provisions Python virtualenv, installs dependencies, runs migrations/seed data, and starts Django and React dev servers.
- Docker Compose (`docker-compose.yml`) orchestrates backend, frontend, database, and optional MinIO services locally.
- Production deployment relies on Docker images, Whitenoise static serving, gunicorn WSGI server, and environment-specific configuration.
- Helm charts under `devops/` package Kubernetes manifests for backend, frontend, database, and storage services with configurable values.
- Health check endpoint supports container orchestration readiness probes; optional database check included in response payload.

## 8. Non-Functional Requirements
- **Security**: Enforce HTTPS in production, store secrets securely, rotate Stripe keys on exposure, and maintain least-privilege roles in Django admin.
- **Compliance**: Align with Stripe Connect requirements, ensure GDPR-ready data handling (password reset emails, donor anonymity, user deletion process backlog).
- **Performance**: API endpoints should respond within 500ms under nominal load; donation checkout must hand off to Stripe within 2 seconds.
- **Reliability**: Webhook handling must be idempotent; background jobs (if added) should retry safely; campaigns must reflect donation totals consistently.
- **Maintainability**: Codebase adheres to Django/React best practices, uses linting (ESLint, flake8), and provides seeded data for reproducible environments.
- **Observability**: Log Stripe interactions, moderation decisions, and authentication events; integrate with monitoring/alerting in production deployments.

## 9. Reporting & Telemetry
- Dashboard displays per-campaign donation totals and progression; extended analytics (e.g., aggregated donation trends) remain future enhancements.
- Stripe dashboard serves as the authoritative source for payout and payment settlement reporting.
- System logs furnish operational telemetry for moderation actions, Stripe webhooks, and health checks.

## 10. Outstanding Items & Future Work
- Implement social authentication (Google/Apple) once requirements, UX, and compliance checks are defined.
- Expand localisation coverage to ensure parity across all supported languages, including dynamic content translation workflows.
- Introduce donor-facing receipts and email notifications after successful payments to enhance transparency.
