from django.core.management.base import BaseCommand

from apps.events.event_type_seed import EVENT_TYPE_SEED, NON_ACTIVITY_EVENT_TYPE_CODES
from apps.events.models import EventType


class Command(BaseCommand):
    help = "Ensures EventType rows exist (get_or_create); safe for dev/staging."

    def handle(self, *args, **options):
        seed_codes = {code for code, _label, _sort_order, _color in EVENT_TYPE_SEED}

        for code, label, sort_order, color in EVENT_TYPE_SEED:
            event_type, was_created = EventType.objects.update_or_create(
                code=code,
                defaults={"label": label, "sort_order": sort_order},
            )
            counts_as_activity = code not in NON_ACTIVITY_EVENT_TYPE_CODES
            extra_fields = []
            if was_created:
                event_type.color = color
                event_type.is_system = True
                extra_fields.extend(["color", "is_system"])
            elif not event_type.is_system:
                event_type.is_system = True
                extra_fields.append("is_system")
            if event_type.counts_as_activity != counts_as_activity:
                event_type.counts_as_activity = counts_as_activity
                extra_fields.append("counts_as_activity")
            if extra_fields:
                event_type.save(update_fields=extra_fields)
            action = "created" if was_created else "updated"
            self.stdout.write(f"{action}: {code}")

        for event_type in EventType.objects.filter(is_system=True).exclude(
            code__in=seed_codes
        ):
            if event_type.events.exists():
                self.stdout.write(
                    self.style.WARNING(
                        f"skipped prune: {event_type.code} is still used by events"
                    )
                )
                continue
            if event_type.first_activity_people.exists():
                self.stdout.write(
                    self.style.WARNING(
                        f"skipped prune: {event_type.code} is still used as "
                        "first activity attended"
                    )
                )
                continue
            code = event_type.code
            event_type.delete()
            self.stdout.write(self.style.SUCCESS(f"pruned: {code}"))
