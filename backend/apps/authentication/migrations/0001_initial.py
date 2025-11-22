# Generated manually for authentication models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PasswordResetRequest",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("requested_at", models.DateTimeField(auto_now_add=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "Pending"),
                            ("APPROVED", "Approved"),
                            ("REJECTED", "Rejected"),
                        ],
                        default="PENDING",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="approved_password_resets",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="password_reset_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Password Reset Request",
                "verbose_name_plural": "Password Reset Requests",
                "ordering": ["-requested_at"],
            },
        ),
        migrations.CreateModel(
            name="AccountLockout",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("failed_attempts", models.IntegerField(default=0)),
                ("locked_until", models.DateTimeField(blank=True, null=True)),
                ("lockout_count", models.IntegerField(default=0)),
                ("last_attempt", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="account_lockout",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Account Lockout",
                "verbose_name_plural": "Account Lockouts",
            },
        ),
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "action",
                    models.CharField(
                        choices=[
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
                        ],
                        max_length=50,
                    ),
                ),
                ("ip_address", models.CharField(max_length=45)),
                ("user_agent", models.TextField(blank=True)),
                ("details", models.JSONField(blank=True, default=dict)),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Audit Log",
                "verbose_name_plural": "Audit Logs",
                "ordering": ["-timestamp"],
            },
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(
                fields=["user", "action", "timestamp"],
                name="authenticat_user_id_action_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(
                fields=["action", "timestamp"], name="authenticat_action_timestamp_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["timestamp"], name="authenticat_timestamp_idx"),
        ),
    ]
