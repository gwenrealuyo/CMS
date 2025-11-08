from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

from django.db import transaction
from django.utils import timezone

from apps.people.models import Milestone, Person

from .models import Lesson, LessonMilestone, PersonLessonProgress


@dataclass
class LessonCompletionResult:
    progress: PersonLessonProgress
    milestone: Milestone


def _get_or_create_milestone_config(lesson: Lesson) -> LessonMilestone:
    milestone_config, _ = LessonMilestone.objects.get_or_create(
        lesson=lesson,
        defaults={
            "milestone_type": "LESSON",
            "title_template": "",
            "note_template": "",
        },
    )
    return milestone_config


@transaction.atomic
def mark_progress_completed(
    progress: PersonLessonProgress,
    *,
    completed_by: Optional[Person] = None,
    note: Optional[str] = None,
    completed_at=None,
) -> LessonCompletionResult:
    """
    Transitions a progress record to the COMPLETED state, producing a milestone entry
    in the conversion timeline (NOTE type by default).
    """

    completed_at = completed_at or timezone.now()

    progress.status = PersonLessonProgress.Status.COMPLETED
    progress.completed_at = completed_at
    progress.completed_by = completed_by

    if progress.started_at is None:
        progress.started_at = completed_at

    if note:
        progress.notes = note

    progress.save(
        update_fields=[
            "status",
            "completed_at",
            "completed_by",
            "started_at",
            "notes",
            "updated_at",
        ]
    )

    milestone_config = _get_or_create_milestone_config(progress.lesson)
    milestone_title = milestone_config.title_template or progress.lesson.title
    milestone_description = note or milestone_config.note_template

    if progress.milestone:
        milestone = progress.milestone
        milestone.type = milestone_config.milestone_type
        milestone.title = milestone_title
        milestone.description = milestone_description
        milestone.date = completed_at.date()
        milestone.verified_by = completed_by
        milestone.save(
            update_fields=["type", "title", "description", "date", "verified_by"]
        )
    else:
        milestone = Milestone.objects.create(
            user=progress.person,
            title=milestone_title,
            description=milestone_description,
            type=milestone_config.milestone_type,
            date=completed_at.date(),
            verified_by=completed_by,
        )
        progress.milestone = milestone
        progress.save(update_fields=["milestone", "updated_at"])

    progress.refresh_from_db(fields=None)

    return LessonCompletionResult(progress=progress, milestone=progress.milestone)


@transaction.atomic
def mark_commitment_signed(
    progress: PersonLessonProgress,
    *,
    signed_by: Optional[Person] = None,
    signed_at=None,
    note: Optional[str] = None,
) -> Milestone:
    """
    Records the commitment form signature and adds a milestone entry.
    """

    signed_at = signed_at or timezone.now()

    progress.commitment_signed = True
    progress.commitment_signed_at = signed_at
    progress.commitment_signed_by = signed_by
    if note:
        progress.notes = note
    progress.save(
        update_fields=[
            "commitment_signed",
            "commitment_signed_at",
            "commitment_signed_by",
            "notes",
            "updated_at",
        ]
    )

    commitment_milestone, _ = Milestone.objects.get_or_create(
        user=progress.person,
        type="NOTE",
        title="Commitment Form Signed",
        defaults={
            "description": "Signed the New Converts Course commitment form.",
            "date": signed_at.date(),
            "verified_by": signed_by,
        },
    )

    if not _:
        commitment_milestone.description = (
            note or "Signed the New Converts Course commitment form."
        )
        commitment_milestone.date = signed_at.date()
        commitment_milestone.verified_by = signed_by
        commitment_milestone.save(update_fields=["description", "date", "verified_by"])

    return commitment_milestone


@transaction.atomic
def revert_progress_completion(
    progress: PersonLessonProgress,
    *,
    previous_status: str,
) -> None:
    """
    Removes the milestone association when a previously completed lesson is reverted
    to another state.
    """

    if previous_status != PersonLessonProgress.Status.COMPLETED:
        return

    milestone = progress.milestone
    progress.completed_at = None
    progress.completed_by = None
    progress.milestone = None
    progress.save(
        update_fields=["completed_at", "completed_by", "milestone", "updated_at"]
    )

    if milestone:
        milestone.delete()


@transaction.atomic
def bulk_assign_lessons(
    lesson: Lesson,
    persons: Iterable[Person],
    *,
    assigned_by: Optional[Person] = None,
) -> int:
    """
    Ensures each target person has an assignment entry for the given lesson.
    Returns the number of records created.
    """

    created_count = 0
    for person in persons:
        progress, created = PersonLessonProgress.objects.get_or_create(
            person=person,
            lesson=lesson,
            defaults={
                "status": PersonLessonProgress.Status.ASSIGNED,
                "assigned_by": assigned_by,
            },
        )
        if created:
            created_count += 1
        else:
            updates = {}
            if progress.status == PersonLessonProgress.Status.SKIPPED:
                updates["status"] = PersonLessonProgress.Status.ASSIGNED
            if assigned_by and progress.assigned_by_id != assigned_by.id:
                updates["assigned_by"] = assigned_by
            if updates:
                for field, value in updates.items():
                    setattr(progress, field, value)
                progress.save(update_fields=[*updates.keys(), "updated_at"])
    return created_count
