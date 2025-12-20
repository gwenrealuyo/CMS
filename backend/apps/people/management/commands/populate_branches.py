from django.core.management.base import BaseCommand
from apps.people.models import Branch


class Command(BaseCommand):
    help = "Populate sample branch data"

    def handle(self, *args, **options):
        branches_data = [
            {"name": "Muntinlupa", "code": "MUNTI", "is_headquarters": True},
            {"name": "Biñan", "code": "BIN"},
            {"name": "Pateros", "code": "PAT"},
            {"name": "Tarlac", "code": "TAR"},
            {"name": "Isabela", "code": "ISA"},
            {"name": "Canlubang", "code": "CAN"},
            {"name": "Dasmariñas", "code": "DAS"},
            {"name": "Bacolod", "code": "BAC"},
            {"name": "Granada", "code": "GRA"},
            {"name": "Cauayan", "code": "CAU"},
            {"name": "Hinigaran", "code": "HIN"},
        ]

        created_count = 0
        updated_count = 0

        for branch_data in branches_data:
            branch, created = Branch.objects.update_or_create(
                name=branch_data["name"],
                defaults={
                    "code": branch_data.get("code", ""),
                    "is_headquarters": branch_data.get("is_headquarters", False),
                    "is_active": True,
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created branch: {branch.name}"))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f"Updated branch: {branch.name}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuccessfully processed {len(branches_data)} branches: "
                f"{created_count} created, {updated_count} updated"
            )
        )
