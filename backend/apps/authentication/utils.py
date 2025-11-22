from django.contrib.auth import get_user_model
from .models import AuditLog

User = get_user_model()


def get_client_ip(request):
    """
    Extract client IP address from request.
    Handles proxy headers (X-Forwarded-For, X-Real-IP).
    """
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.META.get("HTTP_X_REAL_IP") or request.META.get(
            "REMOTE_ADDR", "unknown"
        )
    return ip


def get_user_agent(request):
    """Extract user agent from request."""
    return request.META.get("HTTP_USER_AGENT", "")


def log_audit_event(user, action, request, details=None):
    """
    Helper function to log audit events.
    
    Args:
        user: User object (can be None for failed login attempts)
        action: Action string (must match AuditLog.ACTION_CHOICES)
        request: Django request object
        details: Optional dict with additional context
    """
    if details is None:
        details = {}

    AuditLog.objects.create(
        user=user,
        action=action,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        details=details,
    )

