from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from getpass import getpass

User = get_user_model()


class Command(BaseCommand):
    help = "Create an admin user with ADMIN role"

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            help="Username for the admin user",
        )
        parser.add_argument(
            "--email",
            type=str,
            help="Email for the admin user",
        )
        parser.add_argument(
            "--password",
            type=str,
            help="Password for the admin user (will prompt if not provided)",
        )

    def handle(self, *args, **options):
        username = options.get("username")
        email = options.get("email")
        password = options.get("password")

        # Prompt for username if not provided
        if not username:
            username = input("Username: ")

        # Check if user already exists
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.ERROR(f"User with username '{username}' already exists.")
            )
            return

        # Prompt for email if not provided
        if not email:
            email = input("Email: ")

        # Check if email already exists
        if email and User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.ERROR(f"User with email '{email}' already exists.")
            )
            return

        # Prompt for password if not provided
        if not password:
            password = getpass("Password: ")
            password_confirm = getpass("Password (again): ")
            if password != password_confirm:
                self.stdout.write(self.style.ERROR("Passwords do not match."))
                return

        # Create admin user
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

