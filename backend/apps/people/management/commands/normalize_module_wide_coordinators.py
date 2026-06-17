"""Promote legacy module-wide COORDINATOR rows to SENIOR_COORDINATOR."""

from django.core.management.base import BaseCommand

from apps.people.coordinator_assignment_validation import RESOURCE_SCOPED_MODULES
from apps.people.models import ModuleCoordinator


class Command(BaseCommand):
    help = (
        "Promote ModuleCoordinator rows with level=COORDINATOR and no resource_id "
        "for scoped modules (CLUSTER, EVANGELISM, SUNDAY_SCHOOL) to SENIOR_COORDINATOR."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print rows that would be updated without saving.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        qs = ModuleCoordinator.objects.filter(
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id__isnull=True,
            module__in=RESOURCE_SCOPED_MODULES,
        ).select_related("person")

        count = qs.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("No legacy module-wide coordinators found."))
            return

        for row in qs:
            person_label = row.person.get_full_name() or row.person.username
            self.stdout.write(
                f"{'Would promote' if dry_run else 'Promoting'} "
                f"id={row.id} person={person_label} module={row.module}"
            )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"Dry run: {count} row(s) would be promoted.")
            )
            return

        updated = qs.update(
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR
        )
        self.stdout.write(
            self.style.SUCCESS(f"Promoted {updated} module-wide coordinator row(s).")
        )
