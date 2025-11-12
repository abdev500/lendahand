# Telegram Android Image Display Fix

## Problem
Images were not displaying when opening the site from Telegram on Android devices.

## Root Cause
The application was generating **relative URLs** for media files (e.g., `/api/media/campaigns/image.jpg`) instead of **absolute URLs** (e.g., `https://api.lend-a-hand.me/api/media/campaigns/image.jpg`).

Telegram's in-app browser on Android doesn't properly resolve relative URLs, causing images to fail loading. This is a common issue with many in-app browsers that use custom schemes or proxies.

## Solution
Modified the `MinIOStorage` class in `backend/donations/storage.py` to generate absolute URLs by including the full backend domain.

### Changes Made

#### 1. Backend Storage Configuration (`backend/donations/storage.py`)
Updated the `url()` method to return absolute URLs:

```python
def url(self, name):
    """
    Generate absolute URL pointing to Django backend endpoint.
    Returns absolute URLs like:
    https://api.lend-a-hand.me/api/media/campaigns/image.jpg
    """
    backend_url = getattr(settings, 'BACKEND_URL', None)
    clean_name = name.lstrip("/")

    if backend_url:
        backend_url = backend_url.rstrip('/')
        media_url = f"{backend_url}/api/media/{clean_name}"
    else:
        # Fallback to relative URL for local development
        media_url = f"/api/media/{clean_name}"

    return media_url
```

#### 2. Django Settings (`backend/lendahand/settings.py`)
Added `BACKEND_URL` setting:

```python
# Backend URL for absolute media URLs (important for in-app browsers like Telegram)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
```

#### 3. Environment Configuration Files
Added `BACKEND_URL` to all environment files:

- **Production** (`config/env.production`):
  ```
  BACKEND_URL=https://api.lend-a-hand.me
  ```

- **Development** (`config/env.development`):
  ```
  BACKEND_URL=https://api-dev.lend-a-hand.me
  ```

- **Testing** (`config/env.test`):
  ```
  BACKEND_URL=https://api-test.lend-a-hand.me
  ```

#### 4. Kubernetes Deployment (`devops/lendahand/values.yaml`)
Added environment variable to backend configuration:

```yaml
env:
  BACKEND_URL: "https://api-test.lend-a-hand.me"
```

#### 5. Docker Compose (`docker-compose.yml`)
Added environment variable to backend service:

```yaml
environment:
  BACKEND_URL: http://localhost:8000
```

#### 6. GitHub Actions CD Workflow (`.github/workflows/cd.yml`)
Added `BACKEND_URL` to the Helm deployment command:

```yaml
--set "backend.env.BACKEND_URL=${{ env.BACKEND_URL }}"
```

This ensures the environment variable is set during automated deployments to all environments (development, test, production).

## Testing

To verify the fix works:

1. **Check API Response**:
   - Call the campaigns API endpoint
   - Verify that media URLs are now absolute (include full domain)
   - Example: `https://api.lend-a-hand.me/api/media/campaigns/image.jpg`

2. **Test in Telegram**:
   - Share a link to the site in Telegram
   - Open the link on an Android device using Telegram's in-app browser
   - Verify that campaign images display correctly

3. **Test in Other Browsers**:
   - Ensure images still work in regular browsers
   - Test both desktop and mobile browsers

## Benefits

1. **In-app Browser Compatibility**: Images now work in Telegram, WhatsApp, Facebook Messenger, and other in-app browsers
2. **Better SEO**: Absolute URLs are better for search engine crawlers
3. **Social Media Sharing**: Proper image previews when sharing links on social media
4. **Backwards Compatible**: Still works with relative URLs in local development

## Deployment

After deploying these changes:

1. **Backend Deployment**: Ensure `BACKEND_URL` environment variable is set correctly
2. **No Database Changes**: This fix doesn't require database migrations
3. **No Frontend Changes**: The frontend continues to use the URLs provided by the backend API
4. **Cache**: May need to clear API response caches if any exist

## Related Issues

This fix also helps with:
- WhatsApp in-app browser
- Facebook Messenger in-app browser
- Other mobile apps with embedded browsers
- Email clients with embedded web views
- PDF generators and other server-side rendering tools

## Technical Notes

- The fix preserves backward compatibility by falling back to relative URLs when `BACKEND_URL` is not set
- URLs are generated at the Django model serialization level, ensuring consistency
- The backend continues to proxy media files from MinIO, maintaining security
- No changes to MinIO configuration were needed
