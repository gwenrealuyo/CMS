from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

from django.db import transaction
from django.utils import timezone

from apps.people.models import Journey, Person

from .models import Lesson, LessonJourney, PersonLessonProgress


@dataclass
class LessonCompletionResult:
    progress: PersonLessonProgress
    journey: Journey


def _get_or_create_journey_config(lesson: Lesson) -> LessonJourney:
    journey_config, _ = LessonJourney.objects.get_or_create(
        lesson=lesson,
        defaults={
            "journey_type": "LESSON",
            "title_template": "",
            "note_template": "",
        },
    )
    return journey_config


@transaction.atomic
def mark_progress_completed(
    progress: PersonLessonProgress,
    *,
    completed_by: Optional[Person] = None,
    note: Optional[str] = None,
    completed_at=None,
) -> LessonCompletionResult:
    """
    Transitions a progress record to the COMPLETED state, producing a journey entry
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

    journey_config = _get_or_create_journey_config(progress.lesson)
    journey_title = journey_config.title_template or progress.lesson.title
    journey_description = note or journey_config.note_template

    if progress.journey:
        journey = progress.journey
        journey.type = journey_config.journey_type
        journey.title = journey_title
        journey.description = journey_description
        journey.date = completed_at.date()
        journey.verified_by = completed_by
        journey.save(
            update_fields=["type", "title", "description", "date", "verified_by"]
        )
    else:
        journey = Journey.objects.create(
            user=progress.person,
            title=journey_title,
            description=journey_description,
            type=journey_config.journey_type,
            date=completed_at.date(),
            verified_by=completed_by,
        )
        progress.journey = journey
        progress.save(update_fields=["journey", "updated_at"])

    progress.refresh_from_db(fields=None)

    return LessonCompletionResult(progress=progress, journey=progress.journey)


@transaction.atomic
def mark_commitment_signed(
    progress: PersonLessonProgress,
    *,
    signed_by: Optional[Person] = None,
    signed_at=None,
    note: Optional[str] = None,
) -> Journey:
    """
    Records the commitment form signature and adds a journey entry.
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

    commitment_journey, _ = Journey.objects.get_or_create(
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
        commitment_journey.description = (
            note or "Signed the New Converts Course commitment form."
        )
        commitment_journey.date = signed_at.date()
        commitment_journey.verified_by = signed_by
        commitment_journey.save(update_fields=["description", "date", "verified_by"])

    return commitment_journey


@transaction.atomic
def revert_progress_completion(
    progress: PersonLessonProgress,
    *,
    previous_status: str,
) -> None:
    """
    Removes the journey association when a previously completed lesson is reverted
    to another state.
    """

    if previous_status != PersonLessonProgress.Status.COMPLETED:
        return

    journey = progress.journey
    progress.completed_at = None
    progress.completed_by = None
    progress.journey = None
    progress.save(
        update_fields=["completed_at", "completed_by", "journey", "updated_at"]
    )

    if journey:
        journey.delete()


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
