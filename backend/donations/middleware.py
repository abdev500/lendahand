from django.contrib.auth import get_user_model
from django.utils.deprecation import MiddlewareMixin
from rest_framework.authtoken.models import Token

User = get_user_model()


class DisableCSRFForAPI(MiddlewareMixin):
    """
    Disable CSRF protection for API endpoints.
    Since we're using TokenAuthentication, CSRF is not needed for API endpoints.
    """

    def process_request(self, request):
        # Exempt all API endpoints from CSRF
        if request.path.startswith("/api/"):
            setattr(request, "_dont_enforce_csrf_checks", True)


class TokenAuthenticationMiddleware(MiddlewareMixin):
    """
    Middleware to authenticate users via token for non-API views.
    Supports token in Authorization header or as query parameter.
    This middleware must run AFTER AuthenticationMiddleware.
    """

    def process_request(self, request):
        # Skip if user is already authenticated via session
        if request.user.is_authenticated:
            return

        # Try to get token from Authorization header
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        token_key = None

        if auth_header.startswith("Token "):
            token_key = auth_header.split(" ")[1]
        # Also check query parameter (for browser links)
        elif request.GET.get("token"):
            token_key = request.GET.get("token")

        if token_key:
            try:
                token = Token.objects.select_related("user").get(key=token_key)
                # Set user on request - this makes request.user.is_authenticated return True
                # because we're setting it to an actual User instance (not AnonymousUser)
                request.user = token.user
                # Mark as authenticated for Django's internal checks
                request.user._state.adding = False
            except Token.DoesNotExist:
                pass
