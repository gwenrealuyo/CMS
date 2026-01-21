"""
Management command to create default Sunday School classes.
Usage: python manage.py create_default_sunday_school_classes
"""

from django.core.management.base import BaseCommand

from apps.sunday_school.models import SundaySchoolCategory, SundaySchoolClass


class Command(BaseCommand):
    help = "Creates one default Sunday School class per active category."

    def handle(self, *args, **options):
        categories = SundaySchoolCategory.objects.filter(is_active=True).order_by(
            "order", "name"
        )
        if not categories.exists():
            self.stdout.write(
                self.style.WARNING("No active Sunday School categories found.")
            )
            return

        created_count = 0
        skipped_count = 0

        for category in categories:
            sunday_school_class, created = SundaySchoolClass.objects.get_or_create(
                category=category,
                name=category.name,
                defaults={"is_active": True},
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Created class "{sunday_school_class.name}" '
                        f'for category "{category.name}"'
                    )
                )
            else:
                skipped_count += 1
                self.stdout.write(
                    f'• Skipped existing class "{sunday_school_class.name}" '
                    f'for category "{category.name}"'
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {created_count}, skipped {skipped_count}."
            )
        )
