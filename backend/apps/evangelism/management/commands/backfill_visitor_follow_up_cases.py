from django.core.management.base import BaseCommand

from apps.evangelism.models import Prospect, VisitorFollowUpCase
from apps.evangelism.services import sync_person_evangelism_pipeline
from apps.evangelism.visitor_follow_up import (
    OPEN_CASE_STATUSES,
    close_visitor_follow_up_case,
    close_visitor_follow_up_for_enrollment,
    ensure_visitor_follow_up_case,
    linked_person_blocks_visitor_follow_up,
    prospect_has_active_lesson_enrollment,
)


class Command(BaseCommand):
    help = (
        "Open visitor follow-up cases for invite-only or VISITOR-linked prospects "
        "who are not dropped off and not actively enrolled in Lessons. "
        "Closes leftover open cases for Members / non-VISITOR linked people. "
        "Re-syncs pipeline stage from Person milestones (Taken NCC needs "
        "lessons_started_at or an active lesson teacher)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show who would get a case / be closed without writing.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        prospects = (
            Prospect.objects.filter(is_dropped_off=False)
            .select_related("person", "person__lesson_enrollment", "invited_by")
            .order_by("last_name", "first_name", "id")
        )
        created = 0
        closed_enrolled = 0
        closed_non_visitor = 0
        pipeline_synced = 0
        skipped = 0
        for prospect in prospects:
            person = prospect.person
            if linked_person_blocks_visitor_follow_up(person):
                open_case = VisitorFollowUpCase.objects.filter(
                    prospect=prospect,
                    case_status__in=OPEN_CASE_STATUSES,
                ).first()
                if open_case is None:
                    skipped += 1
                    continue
                if dry_run:
                    self.stdout.write(
                        f"  close-non-visitor: {prospect.display_name} "
                        f"({prospect.pk}) role={getattr(person, 'role', None)}"
                    )
                    closed_non_visitor += 1
                    continue
                close_visitor_follow_up_case(
                    prospect,
                    reason=VisitorFollowUpCase.ClosedReason.MANUAL,
                )
                closed_non_visitor += 1
                continue

            if person is not None and not dry_run:
                synced = sync_person_evangelism_pipeline(person, prospect=prospect)
                if synced is not None:
                    pipeline_synced += 1
            elif person is not None and dry_run:
                pipeline_synced += 1

            enrolled = prospect_has_active_lesson_enrollment(prospect)
            if enrolled:
                if dry_run:
                    self.stdout.write(
                        f"  close-enrolled: {prospect.display_name} ({prospect.pk})"
                    )
                    closed_enrolled += 1
                    continue
                close_visitor_follow_up_for_enrollment(prospect.person)
                closed_enrolled += 1
                continue
            if dry_run:
                self.stdout.write(
                    f"  ensure: {prospect.display_name} ({prospect.pk})"
                )
                created += 1
                continue
            case = ensure_visitor_follow_up_case(prospect)
            if case is None:
                skipped += 1
            else:
                created += 1

        prefix = "DRY RUN — " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}ensured={created} closed_enrolled={closed_enrolled} "
                f"closed_non_visitor={closed_non_visitor} "
                f"pipeline_synced={pipeline_synced} skipped={skipped}"
            )
        )
