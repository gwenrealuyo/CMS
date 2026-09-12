from django.core.management.base import BaseCommand

from apps.people.models import FOLLOW_UP_STATUSES, MemberCareCase, Person
from apps.people.utils import sync_member_care_case


class Command(BaseCommand):
    help = (
        "Open member care cases for people currently Semi-active, Inactive, "
        "Dormant, or Fall Away (excludes visitors)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show who would get a case without writing.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        people = (
            Person.objects.filter(status__in=FOLLOW_UP_STATUSES)
            .exclude(role="VISITOR")
            .order_by("last_name", "first_name", "id")
        )
        created = 0
        updated = 0
        skipped = 0
        for person in people:
            has_case = MemberCareCase.objects.filter(person=person).exists()
            latest = person.status_changes.order_by("-created_at", "-id").first()
            reason = (latest.reason if latest else "") or ""
            if dry_run:
                action = "create" if not has_case else "sync"
                self.stdout.write(
                    f"  {action}: {person.username} ({person.status})"
                )
                if has_case:
                    updated += 1
                else:
                    created += 1
                continue
            case = sync_member_care_case(
                person,
                to_status=person.status,
                reason=reason,
                source_change=latest,
            )
            if case is None:
                skipped += 1
            elif not has_case:
                created += 1
            else:
                updated += 1

        prefix = "DRY RUN — " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}created={created} synced={updated} skipped={skipped}"
            )
        )
