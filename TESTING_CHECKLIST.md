# Manual Testing Checklist

This document provides a comprehensive checklist for manually testing all functionality in the Lend a Hand application.

## Test Environment Setup

- [ ] Application is running (locally or on Kubernetes)
- [ ] Database is seeded with test data
- [ ] MinIO storage is accessible
- [ ] Frontend URL: `http://localhost:5173` (local) or `http://test.lendahand.me` (Kubernetes)
- [ ] Backend URL: `http://localhost:8000/api` (local) or `http://api-test.lendahand.me/api` (Kubernetes)

## Test Accounts

### Admin Account
- [ ] Email: `admin@lendahand.me`
- [ ] Password: `admin`

### Moderator Account
- [ ] Email: `moderator@lendahand.me`
- [ ] Password: `moderator`

### Regular User Accounts
- [ ] Email: `user1@example.com` / Password: `User1Pass123!`
- [ ] Email: `user2@example.com` / Password: `User2Pass123!`
- [ ] Email: `testuser@example.com` / Password: `TestUserPass123!`

---

## 1. Authentication & User Management

### 1.1 User Registration
- [ ] Navigate to `/register`
- [ ] Fill in all required fields (email, username, password, confirm password)
- [ ] Submit form with valid data
- [ ] Verify redirect to dashboard after successful registration
- [ ] Verify user is logged in
- [ ] Try registering with existing email - verify error message
- [ ] Try registering with mismatched passwords - verify error message
- [ ] Try registering with weak password (< 8 chars) - verify error message
- [ ] Test "Already have an account? Login" link
- [ ] Verify all form labels and messages are localized (test with language switcher)

### 1.2 User Login
- [ ] Navigate to `/login`
- [ ] Login with valid admin credentials
- [ ] Verify redirect to dashboard
- [ ] Logout and verify redirect to home
- [ ] Login with valid regular user credentials
- [ ] Verify redirect to dashboard
- [ ] Try login with invalid credentials - verify error message
- [ ] Try login with empty fields - verify validation
- [ ] Test "Forgot password?" link
- [ ] Test "Don't have an account? Register" link
- [ ] Verify all form labels and messages are localized

### 1.3 Password Reset
- [ ] Navigate to `/forgot-password`
- [ ] Enter valid email address
- [ ] Submit form
- [ ] Verify success message (email sent confirmation)
- [ ] Check email inbox (or console for local) for reset link
- [ ] Click reset link in email
- [ ] Verify redirect to reset password page with UID and token in URL
- [ ] Enter new password and confirmation
- [ ] Submit form
- [ ] Verify success message
- [ ] Verify redirect to login page
- [ ] Login with new password - verify success
- [ ] Try reset with invalid email - verify generic success message (security)
- [ ] Try reset with invalid/expired token - verify error message
- [ ] Try reset with mismatched passwords - verify error message
- [ ] Try reset with short password (< 8 chars) - verify error message
- [ ] Verify all messages are localized

### 1.4 Logout
- [ ] While logged in, click logout button
- [ ] Verify redirect to home page
- [ ] Verify user is logged out (can't access protected routes)
- [ ] Verify session/token is cleared

---

## 2. Campaign Functionality

### 2.1 View Campaigns List
- [ ] Navigate to `/campaigns` (while logged out)
- [ ] Verify all approved campaigns are displayed
- [ ] Verify pending campaigns are NOT displayed to public
- [ ] Verify draft campaigns are NOT displayed to public
- [ ] Verify campaign cards show:
  - [ ] Campaign image
  - [ ] Campaign title
  - [ ] Short description
  - [ ] Progress bar with percentage
  - [ ] Current amount raised (€ symbol)
  - [ ] Target amount (€ symbol)
  - [ ] "Donate" button
- [ ] Click on campaign card - verify navigation to campaign detail page
- [ ] Test pagination (if applicable)
- [ ] Verify currency displays in EUR (€)
- [ ] Verify all text is localized

### 2.2 View Campaign Details (Public)
- [ ] Navigate to `/campaign/{id}` for an approved campaign (while logged out)
- [ ] Verify campaign details are displayed:
  - [ ] Title
  - [ ] Short description
  - [ ] Full description (formatted HTML)
  - [ ] Status badge (if visible)
  - [ ] Progress bar with percentage
  - [ ] Current amount raised (€)
  - [ ] Target amount (€)
  - [ ] Media carousel/images
  - [ ] Donations table
- [ ] Verify donation form is visible:
  - [ ] Predefined amount buttons (€10, €25, €50, €100)
  - [ ] Amount input prefilled with €10
  - [ ] Custom amount input field
  - [ ] "Donate" button
- [ ] Click predefined amount button - verify amount is set in input
- [ ] Enter custom amount - verify input accepts decimal values
- [ ] Verify currency symbol (€) is displayed correctly
- [ ] Verify "Anonymous donations" note is displayed
- [ ] Verify donations table shows:
  - [ ] Amount column with € symbol
  - [ ] Date column
  - [ ] All donations for this campaign
- [ ] Verify pending/draft campaigns show warning message (if accessed via direct link)
- [ ] Verify all text is localized

### 2.3 Create Campaign
- [ ] Login as regular user
- [ ] Navigate to `/dashboard`
- [ ] Click "Create New Campaign" or navigate to `/campaigns/create`
- [ ] Fill in campaign form:
  - [ ] Title (required)
  - [ ] Short description (required)
  - [ ] Full description using rich text editor (required)
  - [ ] Target amount in EUR (required, numeric)
  - [ ] Upload media files (images/videos, up to 6 total)
- [ ] Submit form
- [ ] Verify success message
- [ ] Verify redirect to dashboard or campaign detail
- [ ] Verify campaign status is "pending" or "draft"
- [ ] Verify campaign appears in user's dashboard
- [ ] Try submitting with missing required fields - verify validation errors
- [ ] Try uploading more than 6 files - verify error/limitation
- [ ] Try uploading invalid file types - verify error
- [ ] Verify target amount field shows "EUR" in label
- [ ] Verify all form labels and messages are localized

### 2.4 Edit Campaign
- [ ] Login as campaign creator
- [ ] Navigate to campaign in dashboard
- [ ] Click "Edit" button
- [ ] Modify campaign fields:
  - [ ] Title
  - [ ] Description
  - [ ] Target amount
  - [ ] Add/remove media files
- [ ] Submit form
- [ ] Verify success message
- [ ] Verify changes are reflected in campaign detail page
- [ ] Verify campaign status changes to "pending" after edit (if applicable)
- [ ] Verify edit note is displayed (if applicable)
- [ ] Try editing campaign you didn't create - verify permission error

### 2.5 Donate to Campaign
- [ ] Navigate to approved campaign detail page (can be logged out)
- [ ] Verify donation form is visible
- [ ] Test predefined amount buttons:
  - [ ] Click €10 button - verify input shows 10
  - [ ] Click €25 button - verify input shows 25
  - [ ] Click €50 button - verify input shows 50
  - [ ] Click €100 button - verify input shows 100
  - [ ] Verify active button is highlighted
- [ ] Enter custom amount (e.g., 15.50)
- [ ] Click "Donate" button
- [ ] Verify redirect to Stripe Checkout
- [ ] Use test card: `4242 4242 4242 4242`
  - [ ] Any future expiry date
  - [ ] Any 3-digit CVC
  - [ ] Any postal code (5 digits)
- [ ] Complete payment
- [ ] Verify redirect back to campaign with success message
- [ ] Verify donation appears in donations table
- [ ] Verify campaign progress bar updated
- [ ] Verify current amount increased by donation amount
- [ ] Try donating with amount = 0 - verify validation error
- [ ] Try donating with negative amount - verify validation error
- [ ] Try donating with empty amount - verify validation error
- [ ] Verify currency displays correctly (€) throughout donation flow

### 2.6 Campaign Status & Moderation
- [ ] Login as campaign creator
- [ ] Create a new campaign
- [ ] Verify campaign status is "pending" or "draft"
- [ ] Verify pending warning message is displayed (if applicable)
- [ ] Login as moderator/admin
- [ ] Navigate to moderation dashboard or campaign list
- [ ] Verify pending campaigns are visible
- [ ] Approve a campaign:
  - [ ] Click "Approve" or navigate to moderation view
  - [ ] Submit approval
  - [ ] Verify success message
  - [ ] Verify campaign status changed to "approved"
  - [ ] Verify campaign is now visible to public
- [ ] Reject a campaign:
  - [ ] Navigate to pending campaign
  - [ ] Click "Reject" or enter rejection reason
  - [ ] Submit rejection (may require reason/notes)
  - [ ] Verify success message
  - [ ] Verify campaign status changed to "rejected"
  - [ ] Verify campaign is NOT visible to public
  - [ ] Verify rejection notes are visible to creator

---

## 3. Dashboard Features

### 3.1 User Dashboard
- [ ] Login as regular user
- [ ] Navigate to `/dashboard`
- [ ] Verify dashboard displays:
  - [ ] User email/username
  - [ ] User phone (if provided)
  - [ ] User address (if provided)
  - [ ] "My Campaigns" section
- [ ] Verify user's campaigns are listed:
  - [ ] Campaign title
  - [ ] Campaign status (draft, pending, approved, rejected, suspended, cancelled)
  - [ ] Progress: current amount / target amount (€)
  - [ ] "View" button
  - [ ] "Edit" button
  - [ ] "Suspend" button (if applicable)
  - [ ] "Cancel" button (if applicable)
- [ ] Verify status badges are styled correctly
- [ ] Verify pending campaigns show "Awaiting approval" note
- [ ] Verify moderation notes are displayed (if rejected)
- [ ] Click "View" - verify navigation to campaign detail
- [ ] Click "Edit" - verify navigation to edit page
- [ ] Test campaign actions:
  - [ ] Suspend campaign - verify success message and status update
  - [ ] Cancel campaign - verify success message and status update
- [ ] Verify "No campaigns" message if user has no campaigns
- [ ] Verify currency displays in EUR (€)
- [ ] Verify all text is localized

### 3.2 Moderator Dashboard
- [ ] Login as moderator
- [ ] Navigate to `/dashboard` or `/moderation`
- [ ] Verify moderator-specific features:
  - [ ] "Pending Campaigns" tab/section
  - [ ] List of campaigns awaiting moderation
  - [ ] Approve/Reject buttons for each campaign
- [ ] Test moderation actions:
  - [ ] Approve campaign - verify success message
  - [ ] Reject campaign with reason - verify success message
- [ ] Verify moderated campaigns are removed from pending list
- [ ] Verify all text is localized

### 3.3 Campaign Management (Creator)
- [ ] Login as campaign creator
- [ ] Navigate to campaign in dashboard
- [ ] Verify campaign can be edited
- [ ] Verify campaign can be suspended
- [ ] Verify campaign can be cancelled
- [ ] Verify suspended/cancelled campaigns show correct status
- [ ] Verify suspended campaigns are not visible to public
- [ ] Verify cancelled campaigns are not visible to public

---

## 4. News Functionality

### 4.1 View News List
- [ ] Navigate to `/news`
- [ ] Verify published news articles are displayed
- [ ] Verify unpublished news are NOT displayed
- [ ] Verify news cards show:
  - [ ] Title
  - [ ] Content preview
  - [ ] Date
  - [ ] Published status (if visible)
- [ ] Click on news article - verify navigation to detail page
- [ ] Verify all text is localized

### 4.2 View News Details
- [ ] Navigate to `/news/{id}`
- [ ] Verify news details:
  - [ ] Title
  - [ ] Full content (formatted)
  - [ ] Date
  - [ ] Author (if applicable)
- [ ] Verify all text is localized

### 4.3 Create News (Admin/Moderator)
- [ ] Login as admin or moderator
- [ ] Navigate to news creation page
- [ ] Fill in news form:
  - [ ] Title (required)
  - [ ] Content using rich text editor (required)
  - [ ] Published status (if applicable)
- [ ] Submit form
- [ ] Verify success message
- [ ] Verify news appears in news list (if published)
- [ ] Verify unpublished news does not appear in public list
- [ ] Try submitting with missing required fields - verify validation errors
- [ ] Verify all form labels and messages are localized

### 4.4 Edit News (Admin/Moderator)
- [ ] Login as admin or moderator
- [ ] Navigate to existing news article
- [ ] Click "Edit" button
- [ ] Modify news fields
- [ ] Submit form
- [ ] Verify success message
- [ ] Verify changes are reflected
- [ ] Test publish/unpublish toggle:
  - [ ] Publish news - verify it appears in public list
  - [ ] Unpublish news - verify it disappears from public list

### 4.5 Delete News (Admin/Moderator)
- [ ] Login as admin or moderator
- [ ] Navigate to news article
- [ ] Click "Delete" button
- [ ] Confirm deletion (if confirmation dialog)
- [ ] Verify success message
- [ ] Verify news is removed from list
- [ ] Verify deleted news is no longer accessible

---

## 5. Localization (i18n)

### 5.1 Language Switcher
- [ ] Verify language switcher is available (if implemented)
- [ ] Test switching between languages:
  - [ ] English (en)
  - [ ] Russian (ru)
  - [ ] Belarusian (be)
  - [ ] Lithuanian (lt)
  - [ ] Ukrainian (uk)
- [ ] Verify all UI text changes language
- [ ] Verify language preference persists (if saved)

### 5.2 Translated Content
- [ ] For each language, verify:
  - [ ] Navigation menu items
  - [ ] Page titles
  - [ ] Form labels
  - [ ] Buttons
  - [ ] Error messages
  - [ ] Success messages
  - [ ] Validation messages
  - [ ] Campaign status labels
  - [ ] Currency format (EUR)

### 5.3 Currency Display
- [ ] Verify EUR symbol (€) is displayed correctly across all languages
- [ ] Verify currency formatting (thousands separator)
- [ ] Verify currency in:
  - [ ] Campaign cards
  - [ ] Campaign detail pages
  - [ ] Dashboard
  - [ ] Donation form
  - [ ] Donations table

---

## 6. UI/UX Elements

### 6.1 Responsive Design
- [ ] Test on desktop (1920x1080, 1366x768)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667, 414x896)
- [ ] Verify navigation menu works on mobile (hamburger menu if applicable)
- [ ] Verify forms are usable on mobile
- [ ] Verify images/media display correctly on all screen sizes

### 6.2 Navigation
- [ ] Verify header/navigation is visible on all pages
- [ ] Test navigation links:
  - [ ] Home
  - [ ] Campaigns
  - [ ] News
  - [ ] Login/Logout
  - [ ] Dashboard (when logged in)
  - [ ] Settings (when logged in)
  - [ ] Moderation (when moderator/admin)
- [ ] Verify active page is highlighted in navigation
- [ ] Verify navigation works on mobile devices

### 6.3 Forms & Inputs
- [ ] Verify all input fields are accessible
- [ ] Verify form validation messages are clear
- [ ] Verify error messages are displayed correctly
- [ ] Verify success messages are displayed correctly
- [ ] Verify form submission feedback (loading states)
- [ ] Test tab navigation through form fields
- [ ] Verify placeholder text is helpful
- [ ] Verify required fields are marked (* or visually indicated)

### 6.4 Images & Media
- [ ] Verify campaign images load correctly
- [ ] Verify image carousel works (next/prev buttons, indicators)
- [ ] Verify images are responsive
- [ ] Verify image alt text (accessibility)
- [ ] Verify video media plays correctly
- [ ] Verify media upload works (create campaign, edit campaign)

### 6.5 Error Handling
- [ ] Test network errors (disconnect internet):
  - [ ] Verify error message is displayed
  - [ ] Verify error message is user-friendly
- [ ] Test invalid form submissions:
  - [ ] Verify validation errors are clear
  - [ ] Verify errors are displayed next to relevant fields
- [ ] Test 404 errors (invalid URLs):
  - [ ] Verify 404 page is displayed (if implemented)
- [ ] Test 403 errors (unauthorized access):
  - [ ] Verify permission error is displayed
  - [ ] Verify user is redirected appropriately

---

## 7. Security & Permissions

### 7.1 Access Control
- [ ] Verify protected routes require authentication:
  - [ ] `/dashboard` - redirects to login if not logged in
  - [ ] `/campaigns/create` - redirects to login if not logged in
  - [ ] `/campaigns/{id}/edit` - redirects to login if not logged in
  - [ ] `/moderation` - redirects to login if not logged in
  - [ ] `/settings` - redirects to login if not logged in
- [ ] Verify users can only edit their own campaigns:
  - [ ] Login as user1
  - [ ] Try editing user2's campaign
  - [ ] Verify permission error or redirect
- [ ] Verify only moderators/admins can access moderation:
  - [ ] Login as regular user
  - [ ] Try accessing moderation page
  - [ ] Verify permission error or redirect
- [ ] Verify only admins/moderators can create/edit news:
  - [ ] Login as regular user
  - [ ] Try accessing news creation page
  - [ ] Verify permission error or redirect

### 7.2 Session Management
- [ ] Login and verify token is stored
- [ ] Refresh page - verify user remains logged in
- [ ] Wait for token expiry (if applicable) - verify logout
- [ ] Logout - verify token is cleared
- [ ] Try accessing protected route after logout - verify redirect to login

### 7.3 CSRF & API Security
- [ ] Verify API requests include proper authentication headers
- [ ] Verify CSRF protection is enabled (check browser console)
- [ ] Verify API errors are handled gracefully (no sensitive info exposed)

---

## 8. Performance & Loading States

### 8.1 Loading States
- [ ] Verify loading indicators are shown:
  - [ ] When fetching campaigns
  - [ ] When submitting forms
  - [ ] When uploading files
  - [ ] When processing payments
- [ ] Verify "Loading..." text is localized
- [ ] Verify loading states don't block user interaction unnecessarily

### 8.2 Page Load Performance
- [ ] Verify pages load within reasonable time (< 3 seconds)
- [ ] Verify images are optimized (not too large)
- [ ] Verify no console errors (check browser console)
- [ ] Verify no network errors (check Network tab)

---

## 9. Edge Cases & Special Scenarios

### 9.1 Empty States
- [ ] Verify "No campaigns" message when no campaigns exist
- [ ] Verify "No donations" message when campaign has no donations
- [ ] Verify "No news" message when no news articles exist
- [ ] Verify "No pending campaigns" message when no campaigns need moderation

### 9.2 Boundary Values
- [ ] Test donation with very small amount (€0.01)
- [ ] Test donation with very large amount (€999,999)
- [ ] Test campaign with very large target (€1,000,000)
- [ ] Test campaign with very small target (€1)
- [ ] Test very long campaign title/description
- [ ] Test special characters in input fields

### 9.3 Media Handling
- [ ] Test uploading image files (JPG, PNG, GIF)
- [ ] Test uploading video files (if supported)
- [ ] Test uploading large files - verify file size limit
- [ ] Test uploading more than 6 files - verify limit enforcement
- [ ] Test image carousel with single image
- [ ] Test image carousel with 6 images
- [ ] Test image carousel navigation (next/prev)

### 9.4 Payment Integration
- [ ] Test successful payment flow end-to-end
- [ ] Test payment cancellation (close Stripe checkout)
- [ ] Test payment failure scenarios
- [ ] Verify payment confirmation works correctly
- [ ] Verify donation is recorded after successful payment
- [ ] Verify campaign progress updates after donation

---

## 10. Browser Compatibility

### 10.1 Desktop Browsers
- [ ] Test on Chrome (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (latest)
- [ ] Test on Edge (latest)
- [ ] Verify all functionality works across browsers

### 10.2 Mobile Browsers
- [ ] Test on Chrome Mobile
- [ ] Test on Safari Mobile (iOS)
- [ ] Verify responsive design works
- [ ] Verify touch interactions work

---

## Test Completion

### Final Checks
- [ ] All critical paths tested
- [ ] All error scenarios tested
- [ ] All user roles tested (regular user, moderator, admin)
- [ ] All languages tested
- [ ] All major features verified
- [ ] No console errors
- [ ] No critical bugs found

### Notes Section
Use this space to document any issues found during testing:

---

**Tested by:** _______________
**Date:** _______________
**Environment:** [ ] Local [ ] Kubernetes [ ] Production
**Browser:** _______________
**Version:** _______________
