from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.lessons.services import (
    reconcile_person_lessons_finished_at,
    trustworthy_lessons_finished_at,
)
from apps.people.models import Person


class Command(BaseCommand):
    help = (
        "Reconcile Person.lessons_finished_at for legacy/module completers: "
        "set from LESSON session reports or varied progress milestones, and "
        "clear untrusted uniform stamps. Keeps has_finished_lessons unchanged."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show proposed changes without writing.",
        )
        parser.add_argument(
            "--branch",
            type=int,
            default=None,
            help="Limit to people in this branch id.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        branch_id = options.get("branch")

        qs = (
            Person.objects.exclude(role="ADMIN")
            .filter(Q(has_finished_lessons=True) | Q(lessons_finished_at__isnull=False))
            .order_by("id")
        )
        if branch_id is not None:
            qs = qs.filter(branch_id=branch_id)

        set_count = 0
        cleared = 0
        unchanged = 0
        skipped = 0

        for person in qs.iterator(chunk_size=200):
            before = person.lessons_finished_at
            trusted = trustworthy_lessons_finished_at(person)
            action = reconcile_person_lessons_finished_at(person, dry_run=dry_run)
            if action == "set":
                set_count += 1
                after = trusted if dry_run else person.lessons_finished_at
                self.stdout.write(
                    f"  set: {person.pk} {person.username} {before} -> {after}"
                )
            elif action == "cleared":
                cleared += 1
                self.stdout.write(
                    f"  cleared: {person.pk} {person.username} {before} -> None"
                )
            elif action == "unchanged":
                unchanged += 1
            else:
                skipped += 1

        prefix = "Dry-run: " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}set={set_count} cleared={cleared} "
                f"unchanged={unchanged} skipped={skipped}"
            )
        )
