from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.settings import api_settings
from datetime import timedelta
from django.utils import timezone

from .serializers import (
    LoginSerializer,
    UserSerializer,
    TokenResponseSerializer,
    PasswordChangeSerializer,
    ProfileUpdateSerializer,
    PasswordResetRequestSerializer,
    PasswordResetRequestListSerializer,
    AccountLockoutSerializer,
    AuditLogSerializer,
)
from .permissions import IsAuthenticatedAndNotVisitor, IsAdmin
from .models import AccountLockout, PasswordResetRequest, AuditLog
from .utils import log_audit_event
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics

User = get_user_model()


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login endpoint that returns JWT tokens and user data.
    Excludes VISITOR role from logging in.
    Implements rate limiting and account lockout.
    """
    username = request.data.get("username", "")
    password = request.data.get("password", "")
    remember_me = request.data.get("remember_me", False)

    # Try to get user for lockout check (before authentication)
    user = None
    try:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            try:
                user = User.objects.get(email=username)
            except User.DoesNotExist:
                pass
    except Exception:
        pass

    # Check account lockout if user exists
    if user:
        lockout, created = AccountLockout.objects.get_or_create(user=user)
        now = timezone.now()

        # Check if account is locked
        if lockout.locked_until and lockout.locked_until > now:
            # Account is still locked
            remaining_time = lockout.locked_until - now
            minutes = int(remaining_time.total_seconds() / 60)
            log_audit_event(
                None,
                "LOGIN_FAILURE",
                request,
                {
                    "reason": "account_locked",
                    "username": username,
                    "locked_until": lockout.locked_until.isoformat(),
                },
            )
            return Response(
                {
                    "error": "account_locked",
                    "message": f"Account is locked. Please try again in {minutes} minute(s) or contact an administrator.",
                    "locked_until": lockout.locked_until.isoformat(),
                },
                status=status.HTTP_423_LOCKED,
            )
        elif lockout.locked_until and lockout.locked_until <= now:
            # Lockout period has expired, clear it
            lockout.locked_until = None
            lockout.save()

    # Validate login credentials
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data["user"]
        remember_me = serializer.validated_data.get("remember_me", False)

        # Successful login - reset failed attempts and update first_login
        lockout, created = AccountLockout.objects.get_or_create(user=user)
        lockout.failed_attempts = 0
        lockout.save()

        # Mark first_login as False after successful login
        if user.first_login:
            user.first_login = False
            user.save(update_fields=["first_login"])

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        # Set refresh token lifetime based on "Remember Me"
        if remember_me:
            # 30 days for "Remember Me"
            refresh.set_exp(lifetime=timedelta(days=30))
        else:
            # 7 days default
            refresh.set_exp(lifetime=timedelta(days=7))

        # Serialize user data
        user_serializer = UserSerializer(user)
        user_data = user_serializer.data

        # Add must_change_password flag to response
        response_data = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": user_data,
        }
        if user.must_change_password or user.first_login:
            response_data["must_change_password"] = True

        # Log successful login
        log_audit_event(
            user,
            "LOGIN_SUCCESS",
            request,
            {"remember_me": remember_me},
        )

        return Response(response_data, status=status.HTTP_200_OK)

    # Failed login - track failed attempts
    if user:
        lockout, created = AccountLockout.objects.get_or_create(user=user)
        lockout.failed_attempts += 1
        lockout.last_attempt = timezone.now()

        # Apply progressive lockout
        if lockout.failed_attempts >= 5:
            if lockout.lockout_count == 0:
                # First lockout: 15 minutes
                lockout.locked_until = timezone.now() + timedelta(minutes=15)
                lockout.lockout_count = 1
                log_audit_event(
                    user,
                    "ACCOUNT_LOCKED",
                    request,
                    {
                        "reason": "failed_attempts",
                        "failed_attempts": lockout.failed_attempts,
                        "lockout_duration": "15 minutes",
                    },
                )
            elif lockout.lockout_count == 1:
                # Second lockout: 30 minutes (15 + 15)
                lockout.locked_until = timezone.now() + timedelta(minutes=30)
                lockout.lockout_count = 2
                log_audit_event(
                    user,
                    "ACCOUNT_LOCKED",
                    request,
                    {
                        "reason": "failed_attempts",
                        "failed_attempts": lockout.failed_attempts,
                        "lockout_duration": "30 minutes",
                    },
                )
            else:
                # Third+ lockout: permanent (until admin unlocks)
                lockout.locked_until = None  # None means permanent lock
                lockout.lockout_count += 1
                log_audit_event(
                    user,
                    "ACCOUNT_LOCKED",
                    request,
                    {
                        "reason": "failed_attempts",
                        "failed_attempts": lockout.failed_attempts,
                        "lockout_duration": "permanent",
                    },
                )

        lockout.save()

        # Log failed login attempt
        log_audit_event(
            None,
            "LOGIN_FAILURE",
            request,
            {
                "username": username,
                "failed_attempts": lockout.failed_attempts,
                "locked": lockout.locked_until is not None
                or (lockout.lockout_count >= 2 and lockout.failed_attempts >= 5),
            },
        )

    # Extract the actual error message from serializer errors
    error_message = "Invalid credentials"
    if serializer.errors:
        # When ValidationError is raised in validate() method with a string,
        # DRF puts it in non_field_errors as a list
        if "non_field_errors" in serializer.errors:
            non_field_errors = serializer.errors["non_field_errors"]
            if isinstance(non_field_errors, list) and len(non_field_errors) > 0:
                error_message = str(non_field_errors[0])
            elif isinstance(non_field_errors, str):
                error_message = str(non_field_errors)
        # Check if serializer.errors is a list (sometimes DRF returns list directly)
        elif isinstance(serializer.errors, list) and len(serializer.errors) > 0:
            error_message = str(serializer.errors[0])
        # Otherwise, get the first error message from any field
        else:
            for field, errors in serializer.errors.items():
                if isinstance(errors, list) and len(errors) > 0:
                    error_message = str(errors[0])
                    break
                elif isinstance(errors, str):
                    error_message = str(errors)
                    break

    return Response(
        {
            "error": "authentication_failed",
            "message": error_message,
            "details": serializer.errors,
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout endpoint. For client-side token blacklisting, just clear tokens.
    Can be upgraded to database blacklisting later if needed.
    """
    # Log logout event
    log_audit_event(
        request.user,
        "LOGOUT",
        request,
        {},
    )
    # Client-side blacklisting: tokens are cleared on frontend
    # If database blacklisting is needed later, implement here
    return Response(
        {"message": "Successfully logged out"}, status=status.HTTP_200_OK
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticatedAndNotVisitor])
def current_user_view(request):
    """
    Get or update current authenticated user data.
    GET: Returns current user data
    PATCH: Updates user profile (name, email, photo) - does NOT log in audit
    """
    if request.method == "GET":
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    elif request.method == "PATCH":
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            # Note: Profile updates are NOT logged in audit log per requirements
            # Return full user data using UserSerializer
            user_serializer = UserSerializer(request.user)
            return Response(user_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    Change password endpoint.
    Requires authentication and old password (unless first login).
    """
    serializer = PasswordChangeSerializer(data=request.data)
    if serializer.is_valid():
        user = request.user
        old_password = serializer.validated_data.get("old_password")
        new_password = serializer.validated_data.get("new_password")

        # Check if this is first login
        is_first_login = user.first_login

        # Check old password (skip if first login)
        if not is_first_login:
            if not old_password:
                return Response(
                    {"old_password": "Old password is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not user.check_password(old_password):
                return Response(
                    {"old_password": "Old password is incorrect."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Set new password
        user.set_password(new_password)
        user.must_change_password = False
        user.first_login = False
        user.save()

        # Log password change
        log_audit_event(
            user,
            "PASSWORD_CHANGE",
            request,
            {"first_login": is_first_login},
        )

        return Response(
            {"message": "Password changed successfully."}, status=status.HTTP_200_OK
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request_view(request):
    """
    Submit a password reset request.
    Users contact admin, but this endpoint allows tracking requests.
    """
    serializer = PasswordResetRequestSerializer(data=request.data)
    if serializer.is_valid():
        user_id = serializer.validated_data.get("user_id")
        notes = serializer.validated_data.get("notes", "")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"user_id": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )

        # Create password reset request
        reset_request = PasswordResetRequest.objects.create(
            user=user, status="PENDING", notes=notes
        )

        # Log request
        log_audit_event(
            user,
            "PASSWORD_RESET_REQUEST",
            request,
            {"request_id": reset_request.id, "notes": notes},
        )

        return Response(
            {
                "message": "Password reset request submitted. An administrator will review it.",
                "request_id": reset_request.id,
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAdmin])
def password_reset_requests_list_view(request):
    """
    List all password reset requests (admin only).
    """
    status_filter = request.query_params.get("status", None)
    queryset = PasswordResetRequest.objects.all().select_related("user", "approved_by")

    if status_filter:
        queryset = queryset.filter(status=status_filter)

    serializer = PasswordResetRequestListSerializer(queryset, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdmin])
def approve_password_reset_view(request, id):
    """
    Approve a password reset request and set password to default (admin only).
    """
    try:
        reset_request = PasswordResetRequest.objects.get(id=id)
    except PasswordResetRequest.DoesNotExist:
        return Response(
            {"error": "Password reset request not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if reset_request.status != "PENDING":
        return Response(
            {"error": "This request has already been processed."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Set password to default
    reset_request.user.set_password("changeme123")
    reset_request.user.must_change_password = True
    reset_request.user.save()

    # Update request
    reset_request.status = "APPROVED"
    reset_request.approved_at = timezone.now()
    reset_request.approved_by = request.user
    reset_request.save()

    # Log approval
    log_audit_event(
        reset_request.user,
        "PASSWORD_RESET_APPROVED",
        request,
        {
            "request_id": reset_request.id,
            "approved_by": request.user.username,
        },
    )

    return Response(
        {
            "message": f"Password reset approved. User {reset_request.user.username} can now log in with password 'changeme123'."
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAdmin])
def locked_accounts_list_view(request):
    """
    List all locked accounts (admin only).
    """
    from django.db.models import Q

    # Get accounts that are locked (either temporarily or permanently)
    # Temporarily locked: locked_until is not null and in the future
    # Permanently locked: lockout_count >= 2 and failed_attempts >= 5
    now = timezone.now()
    queryset = AccountLockout.objects.filter(
        Q(locked_until__isnull=False, locked_until__gt=now)
        | Q(lockout_count__gte=2, failed_attempts__gte=5, locked_until__isnull=True)
    ).select_related("user").distinct()

    serializer = AccountLockoutSerializer(queryset, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAdmin])
def unlock_account_view(request, user_id):
    """
    Unlock a locked account (admin only).
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {"error": "User not found."}, status=status.HTTP_404_NOT_FOUND
        )

    lockout, created = AccountLockout.objects.get_or_create(user=user)

    # Reset lockout
    lockout.failed_attempts = 0
    lockout.locked_until = None
    lockout.lockout_count += 1  # Increment to track unlock
    lockout.save()

    # Log unlock
    log_audit_event(
        user,
        "ACCOUNT_UNLOCKED",
        request,
        {
            "unlocked_by": request.user.username,
            "lockout_count_before": lockout.lockout_count - 1,
        },
    )

    return Response(
        {"message": f"Account for {user.username} has been unlocked."},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAdmin])
def audit_logs_view(request):
    """
    List audit logs with filtering (admin only).
    """
    queryset = AuditLog.objects.all().select_related("user")

    # Filters
    user_id = request.query_params.get("user_id", None)
    action = request.query_params.get("action", None)
    start_date = request.query_params.get("start_date", None)
    end_date = request.query_params.get("end_date", None)

    if user_id:
        queryset = queryset.filter(user_id=user_id)
    if action:
        queryset = queryset.filter(action=action)
    if start_date:
        queryset = queryset.filter(timestamp__gte=start_date)
    if end_date:
        queryset = queryset.filter(timestamp__lte=end_date)

    # Pagination
    page_size = int(request.query_params.get("page_size", 50))
    page = int(request.query_params.get("page", 1))
    start = (page - 1) * page_size
    end = start + page_size

    total = queryset.count()
    logs = queryset[start:end]

    serializer = AuditLogSerializer(logs, many=True)
    return Response(
        {
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": serializer.data,
        },
        status=status.HTTP_200_OK,
    )

