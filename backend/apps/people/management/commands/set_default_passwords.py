from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

User = get_user_model()


class Command(BaseCommand):
    help = "Set default passwords for existing users who don't have passwords set"

    def add_arguments(self, parser):
        parser.add_argument(
            "--default-password",
            type=str,
            default="changeme123",
            help="Default password to set (default: changeme123)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force password reset even if password is already set",
        )

    def handle(self, *args, **options):
        default_password = options.get("default_password", "changeme123")
        force = options.get("force", False)

        users = User.objects.all()
        updated_count = 0

        for user in users:
            # Check if user needs password set
            if not user.has_usable_password() or force:
                user.set_password(default_password)
                user.save()
                updated_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Set password for user: {user.username} (ID: {user.id})"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuccessfully set passwords for {updated_count} user(s)."
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"\nDefault password: {default_password}\n"
                "Please inform users to change their passwords on first login."
            )
        )
