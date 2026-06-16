from django.core.management.base import BaseCommand

from apps.events.event_type_seed import EVENT_TYPE_SEED
from apps.events.models import EventType


class Command(BaseCommand):
    help = "Ensures EventType rows exist (get_or_create); safe for dev/staging."

    def handle(self, *args, **options):
        for code, label, sort_order, color in EVENT_TYPE_SEED:
            event_type, was_created = EventType.objects.update_or_create(
                code=code,
                defaults={"label": label, "sort_order": sort_order},
            )
            if was_created:
                event_type.color = color
                event_type.is_system = True
                event_type.save(update_fields=["color", "is_system"])
            elif not event_type.is_system:
                event_type.is_system = True
                event_type.save(update_fields=["is_system"])
            action = "created" if was_created else "updated"
            self.stdout.write(f"{action}: {code}")
