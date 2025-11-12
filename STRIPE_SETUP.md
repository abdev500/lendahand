# Stripe Setup Guide

This guide will help you set up Stripe API keys for the donation functionality.

## Step 1: Get Your Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. If you don't have an account, sign up for free
3. Navigate to **Developers** → **API keys**
4. You'll see two keys:
   - **Publishable key** (starts with `pk_test_` for test mode or `pk_live_` for live mode)
   - **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)

⚠️ **Important**: Start with **Test mode** keys for development. Only use live keys in production.

## Step 2: Configure Environment Variables

The Django backend reads Stripe keys from environment variables. You have two options:

### Option A: Using a `.env` file (Recommended for Development)

1. Create a `.env` file in the `backend/` directory (if it doesn't exist):
   ```bash
   cd backend
   touch .env
   ```

2. Add your Stripe keys to the `.env` file:
   ```bash
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   STRIPE_CLIENT_ID=ca_your_connect_client_id
   STRIPE_ONBOARDING_RETURN_URL=http://localhost:5173/dashboard?stripe_onboarding=complete
   STRIPE_ONBOARDING_REFRESH_URL=http://localhost:5173/dashboard?stripe_onboarding=refresh
   FRONTEND_URL=http://localhost:5173
   ```

3. Make sure `.env` is in your `.gitignore` file (it should be already)

### Option B: Using System Environment Variables

Set the environment variables in your shell:
```bash
export STRIPE_SECRET_KEY=sk_test_your_secret_key_here
export STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
export STRIPE_CLIENT_ID=ca_your_connect_client_id
export STRIPE_ONBOARDING_RETURN_URL=http://localhost:5173/dashboard?stripe_onboarding=complete
export STRIPE_ONBOARDING_REFRESH_URL=http://localhost:5173/dashboard?stripe_onboarding=refresh
export FRONTEND_URL=http://localhost:5173
```

Or add them to your shell profile (e.g., `~/.zshrc` or `~/.bashrc`):
```bash
echo 'export STRIPE_SECRET_KEY=sk_test_your_secret_key_here' >> ~/.zshrc
echo 'export STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here' >> ~/.zshrc
echo 'export STRIPE_CLIENT_ID=ca_your_connect_client_id' >> ~/.zshrc
echo 'export STRIPE_ONBOARDING_RETURN_URL=http://localhost:5173/dashboard?stripe_onboarding=complete' >> ~/.zshrc
echo 'export STRIPE_ONBOARDING_REFRESH_URL=http://localhost:5173/dashboard?stripe_onboarding=refresh' >> ~/.zshrc
echo 'export FRONTEND_URL=http://localhost:5173' >> ~/.zshrc
source ~/.zshrc
```

## Step 3: Configure Stripe Connect Onboarding

Campaign owners create and reuse their own Stripe Express accounts during campaign creation. Make sure your platform is prepared:

1. In Stripe Dashboard go to **Settings → Connect settings** and enable **Connect** with **Express** accounts.
2. Copy your **Client ID** (found under “Integration” → “Client ID”) and set it as `STRIPE_CLIENT_ID`.
3. Ensure `STRIPE_ONBOARDING_RETURN_URL` and `STRIPE_ONBOARDING_REFRESH_URL` are publicly reachable URLs that redirect users back to your frontend dashboard.
4. If you use different environments (development, staging, production), configure separate URLs and client IDs for each.

Stripe requires HTTPS for production return URLs. For local testing you can use `http://localhost` but Stripe may require you to enable “Allow HTTP” in the Connect settings or use a tunneling service (ngrok, Cloudflare Tunnel).

## Step 4: Verify Configuration

After setting the keys, restart your Django server and verify:

```bash
cd backend
python manage.py shell
```

Then run:
```python
from django.conf import settings
print(f"STRIPE_SECRET_KEY configured: {bool(settings.STRIPE_SECRET_KEY)}")
print(f"STRIPE_SECRET_KEY length: {len(settings.STRIPE_SECRET_KEY) if settings.STRIPE_SECRET_KEY else 0}")
```

If configured correctly, you should see:
```
STRIPE_SECRET_KEY configured: True
STRIPE_SECRET_KEY length: 32
```

## Step 5: Test the Donation Flow

1. Start your Django backend server:
   ```bash
   cd backend
   python manage.py runserver
   ```

2. Start your React frontend (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. Navigate to a campaign detail page and try to donate:
   - Use test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC
   - Any ZIP code

## Test Mode vs Live Mode

### Test Mode (`sk_test_...`, `pk_test_...`)
- Use for development and testing
- No real charges are made
- Use test card numbers from [Stripe Testing](https://stripe.com/docs/testing)

### Live Mode (`sk_live_...`, `pk_live_...`)
- Use only in production
- Real charges are made
- Requires activated Stripe account

## Common Issues

### Issue: "Payment processing is not configured"
- **Solution**: Check that `STRIPE_SECRET_KEY` is set in your environment
- Verify the `.env` file exists and has the correct variable name
- Restart the Django server after setting environment variables

### Issue: "Campaign cannot be moderated or accept donations yet"
- **Solution**: The campaign owner's Stripe Express onboarding is incomplete. From the dashboard click **Resume Stripe setup** to generate a fresh onboarding link.
- Confirm `STRIPE_CLIENT_ID`, `STRIPE_ONBOARDING_RETURN_URL`, and `STRIPE_ONBOARDING_REFRESH_URL` are configured and match the URLs registered in the Stripe Dashboard.
- Check Stripe Dashboard → Connect → Accounts to ensure the connected account has `charges_enabled` and `payouts_enabled`.

### Issue: "Invalid API Key"
- **Solution**: Make sure you're using the correct key type (test vs live)
- Verify there are no extra spaces or quotes in the `.env` file
- Check that you copied the entire key

### Issue: Keys not loading
- **Solution**: Make sure `python-dotenv` is installed: `pip install python-dotenv`
- Verify `load_dotenv()` is called in `settings.py`
- Restart the server after changing environment variables

## Security Notes

⚠️ **Never commit your Stripe keys to Git!**

- The `.env` file should be in `.gitignore`
- Use different keys for development and production
- Rotate keys if they're accidentally exposed
- Use environment variables or secrets management in production (not `.env` files)
