import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that ensures JSON responses are always returned.
    """
    # Get the standard exception response
    response = exception_handler(exc, context)

    # If we get None, it means DRF doesn't handle this exception
    # Return a JSON response instead of letting Django return HTML
    if response is None:
        logger.exception("Unhandled exception occurred", exc_info=exc)
        return Response(
            {"error": str(exc), "detail": "An unexpected error occurred"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Ensure the response is JSON
    if response.data and isinstance(response.data, str):
        return Response({"error": response.data}, status=response.status_code)

    return response
