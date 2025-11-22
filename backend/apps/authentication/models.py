from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class PasswordResetRequest(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="password_reset_requests"
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_password_resets",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-requested_at"]
        verbose_name = "Password Reset Request"
        verbose_name_plural = "Password Reset Requests"

    def __str__(self):
        return f"Password reset request for {self.user.username} - {self.status}"


class AccountLockout(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="account_lockout"
    )
    failed_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    lockout_count = models.IntegerField(
        default=0
    )  # Tracks how many times account has been locked
    last_attempt = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Account Lockout"
        verbose_name_plural = "Account Lockouts"

    def __str__(self):
        return f"Lockout for {self.user.username} - {self.failed_attempts} attempts"


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ("LOGIN_SUCCESS", "Login Success"),
        ("LOGIN_FAILURE", "Login Failure"),
        ("LOGOUT", "Logout"),
        ("PASSWORD_CHANGE", "Password Change"),
        ("PASSWORD_RESET_REQUEST", "Password Reset Request"),
        ("PASSWORD_RESET_APPROVED", "Password Reset Approved"),
        ("ACCOUNT_LOCKED", "Account Locked"),
        ("ACCOUNT_UNLOCKED", "Account Unlocked"),
        ("TOKEN_REFRESH", "Token Refresh"),
        ("ROLE_CHANGE", "Role Change"),
        ("ACCOUNT_ACTIVATED", "Account Activated"),
        ("ACCOUNT_DEACTIVATED", "Account Deactivated"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )  # null for failed login attempts
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    ip_address = models.CharField(max_length=45)
    user_agent = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)  # Additional context
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "action", "timestamp"]),
            models.Index(fields=["action", "timestamp"]),
            models.Index(fields=["timestamp"]),
        ]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self):
        user_str = self.user.username if self.user else "Unknown"
        return f"{self.action} - {user_str} - {self.timestamp}"
