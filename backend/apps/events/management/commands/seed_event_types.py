from django.core.management.base import BaseCommand

from apps.events.event_type_seed import EVENT_TYPE_SEED
from apps.events.models import EventType


class Command(BaseCommand):
    help = "Ensures EventType rows exist (get_or_create); safe for dev/staging."

    def handle(self, *args, **options):
        for code, label, sort_order in EVENT_TYPE_SEED:
            _, was_created = EventType.objects.update_or_create(
                code=code,
                defaults={"label": label, "sort_order": sort_order},
            )
            action = "created" if was_created else "updated"
            self.stdout.write(f"{action}: {code}")
