"""
Management command to populate sample authentication data
Usage: python manage.py populate_auth_sample_data
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.authentication.models import PasswordResetRequest, AccountLockout
from datetime import timedelta
import random

User = get_user_model()


class Command(BaseCommand):
    help = "Populates the database with sample authentication data (password reset requests and locked accounts)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-requests",
            type=int,
            default=8,
            help="Number of password reset requests to create (default: 8)",
        )
        parser.add_argument(
            "--locked-accounts",
            type=int,
            default=5,
            help="Number of locked accounts to create (default: 5)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing authentication sample data before populating",
        )

    def handle(self, *args, **options):
        num_reset_requests = options["reset_requests"]
        num_locked_accounts = options["locked_accounts"]
        clear_existing = options["clear"]

        if clear_existing:
            self.stdout.write("Clearing existing authentication sample data...")
            PasswordResetRequest.objects.all().delete()
            AccountLockout.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(
                    "Note: This only clears sample data. Real authentication data may still exist."
                )
            )

        self.stdout.write("Creating sample authentication data...")

        # Get users (exclude ADMIN users)
        users = list(User.objects.exclude(role="ADMIN"))
        if not users:
            self.stdout.write(
                self.style.ERROR(
                    "No users found in database. Please run populate_sample_data first."
                )
            )
            return

        # Get an admin user for approvals (if exists)
        admin_users = list(User.objects.filter(role="ADMIN"))
        admin_user = admin_users[0] if admin_users else None

        # Create Password Reset Requests
        reset_requests = []
        statuses = ["PENDING", "APPROVED", "REJECTED"]
        status_weights = [0.5, 0.3, 0.2]  # More pending requests

        notes_options = [
            "User forgot password",
            "User requested password reset via email",
            "Account security concern",
            "User cannot access account",
            "Password reset needed for new device",
            "",
        ]

        for i in range(num_reset_requests):
            user = random.choice(users)
            status = random.choices(statuses, weights=status_weights)[0]
            requested_at = timezone.now() - timedelta(
                days=random.randint(0, 30), hours=random.randint(0, 23)
            )

            approved_at = None
            approved_by = None
            if status == "APPROVED":
                approved_at = requested_at + timedelta(hours=random.randint(1, 48))
                approved_by = admin_user

            reset_request = PasswordResetRequest(
                user=user,
                requested_at=requested_at,
                approved_at=approved_at,
                approved_by=approved_by,
                status=status,
                notes=random.choice(notes_options),
            )
            reset_request.save()
            reset_requests.append(reset_request)

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Created {len(reset_requests)} password reset requests"
            )
        )

        # Create Account Lockouts
        locked_accounts = []
        # Select different users for lockouts (avoid overlap with reset requests if possible)
        available_users = [
            u for u in users if u not in [r.user for r in reset_requests]
        ]
        if len(available_users) < num_locked_accounts:
            available_users = users

        selected_users = random.sample(
            available_users, min(num_locked_accounts, len(available_users))
        )

        for user in selected_users:
            # Different lockout scenarios
            lockout_scenario = random.choice(
                ["temporary", "permanent", "failed_attempts"]
            )

            if lockout_scenario == "temporary":
                # Temporarily locked (will auto-unlock)
                locked_until = timezone.now() + timedelta(minutes=random.randint(5, 15))
                failed_attempts = 5
                lockout_count = random.randint(1, 2)
            elif lockout_scenario == "permanent":
                # Requires admin unlock (3rd lockout)
                locked_until = None  # Permanent lock
                failed_attempts = 5
                lockout_count = 3
            else:
                # Just failed attempts, not locked yet
                locked_until = None
                failed_attempts = random.randint(1, 4)
                lockout_count = 0

            lockout = AccountLockout(
                user=user,
                failed_attempts=failed_attempts,
                locked_until=locked_until,
                lockout_count=lockout_count,
                last_attempt=timezone.now() - timedelta(minutes=random.randint(1, 60)),
            )
            lockout.save()
            locked_accounts.append(lockout)

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Created {len(locked_accounts)} account lockout records"
            )
        )

        # Summary
        self.stdout.write(
            self.style.SUCCESS("\n✓ Authentication sample data created successfully!")
        )
        self.stdout.write(
            f"  • Password Reset Requests: {PasswordResetRequest.objects.count()}"
        )
        self.stdout.write(
            f"    - Pending: {PasswordResetRequest.objects.filter(status='PENDING').count()}"
        )
        self.stdout.write(
            f"    - Approved: {PasswordResetRequest.objects.filter(status='APPROVED').count()}"
        )
        self.stdout.write(
            f"    - Rejected: {PasswordResetRequest.objects.filter(status='REJECTED').count()}"
        )
        self.stdout.write(f"  • Locked Accounts: {AccountLockout.objects.count()}")
        self.stdout.write(
            f"    - Currently Locked: {AccountLockout.objects.exclude(locked_until__isnull=True).filter(locked_until__gt=timezone.now()).count()}"
        )
        self.stdout.write(
            f"    - Requires Admin Unlock: {AccountLockout.objects.filter(lockout_count__gte=3).count()}"
        )
