"""Apply migrations and repair known dev schema drift (events, evangelism, people)."""

from django.core.management.base import BaseCommand

from apps.people.sample_data_schema import sync_sample_data_schema


class Command(BaseCommand):
    help = (
        "Apply migrations and repair squashed-migration schema drift "
        "(events EventType, evangelism Prospect fields, people Journey.updated_at). "
        "Development only."
    )

    def handle(self, *args, **options):
        self.stdout.write("Syncing migrations and checking schema...")
        actions = sync_sample_data_schema(stdout=self.stdout)
        if actions:
            self.stdout.write(self.style.SUCCESS(f"Repaired: {', '.join(actions)}"))
            if any("events" in a for a in actions):
                self.stdout.write(
                    self.style.WARNING(
                        "Events reset clears evangelism sample data. "
                        "Run: python manage.py populate_evangelism_data --clear"
                    )
                )
        else:
            self.stdout.write(self.style.SUCCESS("Schema OK — no repairs needed."))
