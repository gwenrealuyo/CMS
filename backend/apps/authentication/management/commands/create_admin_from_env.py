from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import os

User = get_user_model()


class Command(BaseCommand):
    help = "Create an admin user from environment variables (for deployment)"

    def handle(self, *args, **options):
        # Get values from environment variables
        username = os.getenv("ADMIN_USERNAME")
        email = os.getenv("ADMIN_EMAIL", "")
        password = os.getenv("ADMIN_PASSWORD")

        # Only run if ADMIN_USERNAME and ADMIN_PASSWORD are set
        if not username or not password:
            self.stdout.write(
                self.style.WARNING(
                    "ADMIN_USERNAME and ADMIN_PASSWORD not set. Skipping admin user creation."
                )
            )
            return

        # Check if user already exists
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f"User with username '{username}' already exists. Skipping.")
            )
            return

        # Check if email already exists (if email provided)
        if email and User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f"User with email '{email}' already exists. Skipping.")
            )
            return

        # Create admin user
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                role="ADMIN",
                is_staff=True,
                is_superuser=True,
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully created admin user '{username}' with ADMIN role."
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error creating admin user: {str(e)}")
            )
