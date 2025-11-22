from rest_framework.views import exception_handler
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Custom exception handler to standardize error response format.
    """
    response = exception_handler(exc, context)

    if response is not None:
        # Standardize error format
        if isinstance(response.data, dict):
            # If it's already a dict, wrap it in our standard format
            if "error" not in response.data:
                error_code = "error"
                message = "An error occurred"

                # Map common error codes
                if response.status_code == status.HTTP_401_UNAUTHORIZED:
                    error_code = "authentication_required"
                    message = "Authentication required"
                elif response.status_code == status.HTTP_403_FORBIDDEN:
                    error_code = "permission_denied"
                    message = "You do not have permission to perform this action"
                elif response.status_code == status.HTTP_404_NOT_FOUND:
                    error_code = "not_found"
                    message = "Resource not found"
                elif response.status_code == status.HTTP_400_BAD_REQUEST:
                    error_code = "bad_request"
                    message = "Invalid request"

                # Extract message from detail if available
                if "detail" in response.data:
                    message = str(response.data["detail"])
                elif "non_field_errors" in response.data:
                    message = str(response.data["non_field_errors"][0])

                response.data = {
                    "error": error_code,
                    "message": message,
                    "details": response.data,
                }
        else:
            # If it's not a dict, wrap it
            response.data = {
                "error": "error",
                "message": str(response.data) if response.data else "An error occurred",
                "details": {},
            }

    return response

