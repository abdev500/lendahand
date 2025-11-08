# Donation Platform – Requirements Document (Updated v2.3)

## 1. Overview
A web platform for collecting donations.
Users create campaigns, go through moderation, and accept payments via Stripe.
Each campaign owner maintains their own Stripe Connect Express account; campaigns remain blocked until onboarding is complete.
The goal is simplicity, transparency, and trust for donors.
The platform is called **lend-a-hand.me** and all branding shall be done using this name.

---

## 2. Functional Requirements

### 2.1 User Roles
- **Guest**
  - Browse campaigns.
  - View campaign details (description, media, progress, donations table).
  - Make donations (without registration).

- **Registered User**
  - Create campaigns (with formatted description via WYSIWYG editor and up to 6 media files).
  - View/edit their own campaigns (editing triggers new moderation).
  - Suspend or cancel campaigns.
  - See moderation status.

- **Moderator**
  - Approve or reject campaigns via a dedicated **moderation dashboard**.
  - Manage users.
  - View donation statistics.

- **Administrator**
  - Full Django admin access.
  - Same abilities as moderators plus full system management.

---

### 2.2 Campaigns
- Each campaign includes:
  - Title, short description.
  - Full description (WYSIWYG, stored as HTML).
  - Up to 6 images or videos (stored locally).
  - Target fundraising goal.
  - Progress bar.
  - Table of donations sorted chronologically (anonymous amounts only).
- Campaign statuses: **Draft, Pending moderation, Approved, Rejected**.
- Only approved campaigns are visible publicly.

---

### 2.3 Donations
- Payments via **Stripe Checkout**.
- Funds are transferred directly to the campaign owner's connected Stripe Express account (no platform fee).
- Donors:
  - Enter amount.
  - Redirected to Stripe.
  - After success → redirected back to campaign page with success message.
- A `Donation` record is created after Stripe success.

---

### 2.4 Moderation
- Campaigns require approval before publication.
- **Moderators** log in and use a top-level **Moderation menu**.
- Moderators can:
  - View pending campaigns.
  - Approve or reject with notes.
- Users are notified about results.

---

### 2.5 Presentation Layer
- **Frontend** built in **React (Vite)** styled with custom CSS (red–white theme).
- **Design inspiration**: dapamoga.lt.
- Home page:
  - Hero section with call-to-action.
  - Grid of campaign cards with progress.
- Top Navigation:
  - Compaigns link
  - News link
  - Login/Logout
  - Moderation (if available for the user)
  - Administration (if available for the user)
  - Language selection
- Campaign detail:
  - Media gallery (images + videos).
  - Donation progress + form.
  - Donation history table.
  - Modern slick UI
  - Mobile friendly

---

### 2.6 User Management
- Custom `User` model with: email, phone, address.
- UI for:
  - Signup.
  - Login/logout.
  - Password change/reset.
  - Autorisatoin and registration via google/apple
- Moderators can manage users.

---

### 2.7 Registered User Area
- Dashboard with user’s campaigns.
- Create campaign.
- Edit campaign (resets moderation).
- Suspend or cancel campaign.

---

### 2.8 News Management
- Managed in Django admin.
- Each news entry has image + text.
- News displayed in chronological order.
- **Localization**:
  - English + Russian required.
  - Optional Belarusian, Lithuanian, Ukrainian.
  - Fallback: English if missing.

---

### 2.9 Localization
- Entire site localized in:
  - Russian (RU)
  - English (EN)
  - Belarusian (BE)
  - Lithuanian (LT)
  - Ukrainian (UA)
- Language switcher in top menu.


### 2.10 Backend rest API
- Shall support following:
  - user login/logout, authorization for the other endpoints
  - user registration/password management
  - complete api to implement a full UI in react or mobile

### 2.11 React frontend
- Shall support following:
  - main site with all ui features listed in this document, except django administration
---

## 3. Implementation Details

### 3.1 Technology Stack
- **Backend**: Django (Python 3.10+), Django REST Framework.
- **Frontend**: React (Vite) + custom CSS (red–white theme).
- **Database**: PostgreSQL (prod), SQLite (dev).
- **Payments**: Stripe API (Checkout).
- **Media**: Stored locally on the backend

---

### 3.2 Architecture
- **Django app**: `donations`
  - Models: `User`, `Campaign`, `Donation`,  `News`.
  - REST API + **Swagger** docs for mobile/React.
- **Frontend**: React
  - Consumes REST API for all donor/user features.
  - Django templates only used for moderation/admin.
- **Seed data**:
  - 10 campaigns (Belarusian/Ukrainian samples).
  - Each with sample images, video, and HTML text.
  - Users and moderation entries.
  - Some pending, some approved.

---

### 3.3 Deployment
- **Development**:
  - `start-dev.sh`:
    - Creates venv.
    - Installs deps.
    - Runs migrations.
    - Seeds DB.
    - Creates superuser **admin/admin** (is_moderator too).
    - Starts **Django** and **React dev server**.
  - Ensures media/static folders exist.
  - Seeds binary images/videos.

- **Production**:
  - Dockerfile (Django with Gunicorn + Whitenoise).
  - docker-compose (Django + Postgres).
  - React built via `vite build` → artifacts served by Django/Whitenoise.
  - Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_CLIENT_ID`, `STRIPE_ONBOARDING_RETURN_URL`, `STRIPE_ONBOARDING_REFRESH_URL`, `DJANGO_SECRET_KEY`, `DATABASE_URL`.

---

### 3.4 Design
- Colors: red `#d62828`, dark red `#9d1d1d`, white `#ffffff`.
- Logos: SVG/PNG (“Дапамога” wordmark, circular smile mark).
- Fonts: **Montserrat** (headings), **Inter** (body).
- UI: rounded cards, shadows, progress bars, CTA buttons.

---

## 4. Future Extensions
- Blockchain witnessing
