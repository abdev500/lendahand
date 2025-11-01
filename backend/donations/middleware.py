from django.utils.deprecation import MiddlewareMixin


class DisableCSRFForAPI(MiddlewareMixin):
    """
    Disable CSRF protection for API endpoints.
    Since we're using TokenAuthentication, CSRF is not needed.
    """

    def process_request(self, request):
        # Exempt all API endpoints from CSRF
        if request.path.startswith("/api/"):
            setattr(request, "_dont_enforce_csrf_checks", True)
