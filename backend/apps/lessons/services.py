from __future__ import annotations

from datetime import date, datetime, time
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable, Optional

from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Prefetch, Q, QuerySet
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.people.models import Journey, Person
from core.datetime_utils import church_calendar_date, church_today, get_church_timezone

from .models import (
    Lesson,
    LessonAssignmentRequest,
    LessonFollowUpCase,
    LessonJourney,
    LessonStudentEnrollment,
    LessonSessionReport,
    LessonTeacherTransfer,
    PersonLessonProgress,
)

FOLLOW_UP_DROPPED_TITLE = "Lessons follow-up dropped"
FOLLOW_UP_PLAN_TITLE = "Lessons follow-up plan"


@dataclass
class LessonCompletionResult:
    progress: PersonLessonProgress
    journey: Journey


def _as_aware_datetime(value) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.combine(value, time.min)
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, get_church_timezone())
    return dt


def _session_date_for_progress(progress: PersonLessonProgress) -> Optional[date]:
    """Prefer the LESSON session report calendar day for this progress."""
    return (
        LessonSessionReport.objects.filter(
            student_id=progress.person_id,
            lesson_id=progress.lesson_id,
            session_type=LessonSessionReport.SessionType.LESSON,
        )
        .order_by("-session_date", "-session_start", "-id")
        .values_list("session_date", flat=True)
        .first()
    )


def _milestone_date_for_progress(progress: PersonLessonProgress) -> Optional[date]:
    """
    Calendar day for lesson completion milestones.

    Prefer session_date from the related LESSON report; otherwise convert
    completed_at using CHURCH_TIME_ZONE (never bare UTC ``.date()``).
    """
    session_date = _session_date_for_progress(progress)
    if session_date is not None:
        return session_date
    return church_calendar_date(progress.completed_at)


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


def sync_person_lessons_started_from_report(report: LessonSessionReport) -> None:
    """
    Set-once Person.lessons_started_at and empty Conversion.lesson_start_date
    from a newly created NCC session report.

    Skips people who already finished lessons (legacy completers) and does not
    overwrite an existing start date.
    """
    student = report.student
    if student is None or report.session_date is None:
        return
    if student.has_finished_lessons:
        return
    if student.lessons_started_at:
        return

    student.lessons_started_at = report.session_date
    student.save(update_fields=["lessons_started_at"])

    from apps.evangelism.models import Conversion

    Conversion.objects.filter(
        person=student,
        lesson_start_date__isnull=True,
    ).update(lesson_start_date=report.session_date)


def latest_lesson_session_date(person: Person) -> Optional[date]:
    """Latest LESSON-type session report calendar day for this student."""
    return (
        LessonSessionReport.objects.filter(
            student_id=person.pk,
            session_type=LessonSessionReport.SessionType.LESSON,
            session_date__isnull=False,
        )
        .order_by("-session_date", "-id")
        .values_list("session_date", flat=True)
        .first()
    )


def trustworthy_lessons_finished_at(person: Person) -> Optional[date]:
    """
    Course-finish calendar day from evidence only.

    Prefer the latest LESSON session report date. Otherwise, when every active
    latest lesson is COMPLETED:
    - varied ``completed_at`` calendar days → latest of those
    - all ``completed_at`` null → fall back to ``Person.lessons_finished_at``
    - uniform stamped ``completed_at`` (typical legacy backfill) → None

    Flag-only legacy completers with no progress/sessions return None so the
    finish date can stay blank while ``has_finished_lessons`` remains True.
    """
    session_finish = latest_lesson_session_date(person)
    if session_finish is not None:
        return session_finish

    lesson_ids = list(
        Lesson.objects.filter(is_latest=True, is_active=True).values_list("id", flat=True)
    )
    if not lesson_ids:
        return None

    progresses = list(
        PersonLessonProgress.objects.filter(person=person, lesson_id__in=lesson_ids)
    )
    if not progresses:
        return None

    if len(progresses) != len(lesson_ids):
        return None
    if any(p.status != PersonLessonProgress.Status.COMPLETED for p in progresses):
        return None

    completed_days = [
        day
        for progress in progresses
        if (day := church_calendar_date(progress.completed_at)) is not None
    ]
    if len(set(completed_days)) > 1:
        return max(completed_days)
    if progresses and all(progress.completed_at is None for progress in progresses):
        return church_calendar_date(person.lessons_finished_at)
    return None


def reconcile_person_lessons_finished_at(
    person: Person, *, dry_run: bool = False
) -> str:
    """
    Keep ``has_finished_lessons``; set ``lessons_finished_at`` from trustworthy
    evidence or clear untrusted legacy stamps.

    Returns ``unchanged``, ``set``, ``cleared``, or ``skipped``.
    """
    if not person.has_finished_lessons and person.lessons_finished_at is None:
        return "skipped"

    trusted = trustworthy_lessons_finished_at(person)
    if not person.has_finished_lessons:
        trusted = None

    if person.lessons_finished_at == trusted:
        return "unchanged"

    action = "set" if trusted is not None else "cleared"
    if dry_run:
        return action

    person.lessons_finished_at = trusted
    person.save(update_fields=["lessons_finished_at"])
    return action


def sync_person_lessons_finished_from_progress(person: Person) -> None:
    """
    Mirror module lesson completion onto Person.has_finished_lessons /
    lessons_finished_at when the person has PersonLessonProgress rows.

    Finish dates prefer session reports and varied progress milestones. Uniform
    legacy stamps are not written onto the person (date stays blank / unchanged
    when already blank); ``has_finished_lessons`` still flips True when complete.
    """
    lesson_ids = list(
        Lesson.objects.filter(is_latest=True, is_active=True).values_list("id", flat=True)
    )
    if not lesson_ids:
        return

    progresses = PersonLessonProgress.objects.filter(
        person=person,
        lesson_id__in=lesson_ids,
    )
    if not progresses.exists():
        return

    lesson_count = len(lesson_ids)
    all_completed = (
        progresses.count() == lesson_count
        and not progresses.exclude(
            status=PersonLessonProgress.Status.COMPLETED
        ).exists()
    )

    if all_completed:
        lessons_finished_at = trustworthy_lessons_finished_at(person)
        # Preserve an existing person date when evidence is only a uniform stamp
        # (manual entry just backfilled progress with that same day).
        if lessons_finished_at is None and person.lessons_finished_at is not None:
            lessons_finished_at = person.lessons_finished_at
        if (
            person.has_finished_lessons
            and person.lessons_finished_at == lessons_finished_at
        ):
            return
        person.has_finished_lessons = True
        person.lessons_finished_at = lessons_finished_at
        person.save(update_fields=["has_finished_lessons", "lessons_finished_at"])
        return

    if not person.has_finished_lessons and person.lessons_finished_at is None:
        return
    person.has_finished_lessons = False
    person.lessons_finished_at = None
    person.save(update_fields=["has_finished_lessons", "lessons_finished_at"])


@transaction.atomic
def mark_progress_completed(
    progress: PersonLessonProgress,
    *,
    completed_by: Optional[Person] = None,
    note: Optional[str] = None,
    completed_at=None,
    completion_date: Optional[date] = None,
) -> LessonCompletionResult:
    """
    Transitions a progress record to the COMPLETED state, producing a journey entry
    in the conversion timeline (NOTE type by default).

    ``completion_date`` is the calendar milestone day (prefer session_date from
    reports). When omitted, falls back to the related report's session_date or
    the church-local day of ``completed_at``.
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

    milestone_date = (
        completion_date
        or _session_date_for_progress(progress)
        or church_calendar_date(completed_at)
    )

    journey_config = _get_or_create_journey_config(progress.lesson)
    journey_title = journey_config.title_template or progress.lesson.title
    journey_description = note or journey_config.note_template

    if progress.journey:
        journey = progress.journey
        journey.type = journey_config.journey_type
        journey.title = journey_title
        journey.description = journey_description
        journey.date = milestone_date
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
            date=milestone_date,
            verified_by=completed_by,
        )
        progress.journey = journey
        progress.save(update_fields=["journey", "updated_at"])

    progress.refresh_from_db(fields=None)

    sync_person_lessons_finished_from_progress(progress.person)

    return LessonCompletionResult(progress=progress, journey=progress.journey)


_SIGNED_AT_DEFAULT = object()


@transaction.atomic
def set_enrollment_commitment_signed(
    enrollment: LessonStudentEnrollment,
    *,
    signed_by: Optional[Person] = None,
    signed_at=_SIGNED_AT_DEFAULT,
    note: Optional[str] = None,
) -> Journey:
    """
    Records a one-time commitment signature on enrollment and upserts a NOTE journey.

    Omit ``signed_at`` (default) to stamp now. Pass ``None`` when the signed day
    is unknown (stores null on enrollment; journey date uses church today as
    the recorded-on day).
    """

    if signed_at is _SIGNED_AT_DEFAULT:
        signed_at = timezone.now()
    enrollment.commitment_signed = True
    enrollment.commitment_signed_at = signed_at
    enrollment.commitment_signed_by = signed_by
    enrollment.save(
        update_fields=[
            "commitment_signed",
            "commitment_signed_at",
            "commitment_signed_by",
            "updated_at",
        ]
    )

    # Unknown signed day: journey uses recorded-on (church today), not a fake signed day.
    signed_milestone = church_calendar_date(signed_at) or church_today()

    commitment_journey, created = Journey.objects.get_or_create(
        user=enrollment.student,
        type="NOTE",
        title="Commitment Form Signed",
        defaults={
            "description": "Signed the New Converts Course commitment form.",
            "date": signed_milestone,
            "verified_by": signed_by,
        },
    )

    if not created:
        commitment_journey.description = (
            note or "Signed the New Converts Course commitment form."
        )
        commitment_journey.date = signed_milestone
        commitment_journey.verified_by = signed_by
        commitment_journey.save(update_fields=["description", "date", "verified_by"])

    return commitment_journey


@transaction.atomic
def clear_enrollment_commitment_signed(enrollment: LessonStudentEnrollment) -> None:
    """
    Clears enrollment commitment signature and removes the related NOTE journey.
    """

    enrollment.commitment_signed = False
    enrollment.commitment_signed_at = None
    enrollment.commitment_signed_by = None
    enrollment.save(
        update_fields=[
            "commitment_signed",
            "commitment_signed_at",
            "commitment_signed_by",
            "updated_at",
        ]
    )

    Journey.objects.filter(
        user=enrollment.student,
        type="NOTE",
        title="Commitment Form Signed",
    ).delete()


def _pre_lesson_journey_title(kind: Optional[str]) -> str:
    if not kind:
        return LessonSessionReport.PreLessonKind.OTHER.label
    try:
        return LessonSessionReport.PreLessonKind(kind).label
    except ValueError:
        return LessonSessionReport.PreLessonKind.OTHER.label


@transaction.atomic
def sync_pre_lesson_session_journey(report: LessonSessionReport) -> Optional[Journey]:
    """
    Upserts a LESSON journey for a PRE_LESSON session report.

    Title comes from the pre-lesson kind label (Introduction / Other).
    Description is the session remarks. Catalog progress is not completed.
    """
    if (
        report.session_type != LessonSessionReport.SessionType.PRE_LESSON
        or not report.pre_lesson_kind
        or not report.student_id
    ):
        clear_pre_lesson_session_journey(report)
        return None

    title = _pre_lesson_journey_title(report.pre_lesson_kind)
    description = report.remarks or ""
    verified_by = report.teacher or report.submitted_by

    if report.journey_id:
        journey = report.journey
        journey.user = report.student
        journey.type = "LESSON"
        journey.title = title
        journey.description = description
        journey.date = report.session_date
        journey.verified_by = verified_by
        journey.save(
            update_fields=["user", "type", "title", "description", "date", "verified_by"]
        )
        return journey

    journey = Journey.objects.create(
        user=report.student,
        type="LESSON",
        title=title,
        description=description,
        date=report.session_date,
        verified_by=verified_by,
    )
    report.journey = journey
    report.save(update_fields=["journey", "updated_at"])
    return journey


@transaction.atomic
def clear_pre_lesson_session_journey(report: LessonSessionReport) -> None:
    """Unlink and delete the LESSON journey owned by a pre-lesson session report."""
    journey_id = report.journey_id
    if not journey_id:
        return

    journey = report.journey
    report.journey = None
    if report.pk:
        report.save(update_fields=["journey", "updated_at"])
    if journey is not None:
        journey.delete()
    else:
        Journey.objects.filter(pk=journey_id).delete()


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

    sync_person_lessons_finished_from_progress(progress.person)


@transaction.atomic
def ensure_lesson_enrollment(
    student: Person,
    teacher: Optional[Person] = None,
    *,
    assigned_by: Optional[Person] = None,
    note: str = "",
    historical_teacher_first_name: str = "",
    historical_teacher_last_name: str = "",
) -> LessonStudentEnrollment:
    """
    Create enrollment and initial transfer record if the student has none.
    Does not change teacher when enrollment already exists.

    Provide either a live ``teacher`` Person or both historical name parts
    (former / unknown teacher for legacy records).
    """
    from apps.evangelism.visitor_follow_up import (
        close_visitor_follow_up_for_enrollment,
    )

    existing = (
        LessonStudentEnrollment.objects.filter(student=student)
        .select_related("teacher", "student")
        .first()
    )
    if existing:
        if existing.is_active:
            close_visitor_follow_up_for_enrollment(student, updated_by=assigned_by)
        return existing

    if teacher is not None:
        reason = student_cannot_be_own_teacher_error(student, teacher)
        if reason:
            raise ValueError(reason)

    hist_first = (historical_teacher_first_name or "").strip()
    hist_last = (historical_teacher_last_name or "").strip()
    if teacher is None and not (hist_first and hist_last):
        raise ValueError(
            "Lesson enrollment requires a teacher or historical teacher first and last name."
        )

    enrollment = LessonStudentEnrollment.objects.create(
        student=student,
        teacher=teacher,
        historical_teacher_first_name="" if teacher else hist_first,
        historical_teacher_last_name="" if teacher else hist_last,
        assigned_by=assigned_by,
    )
    if teacher is not None:
        transfer_note = note or "Initial teacher assignment."
    else:
        transfer_note = note or (
            f"Initial historical teacher: {hist_first} {hist_last}."
        )
    LessonTeacherTransfer.objects.create(
        enrollment=enrollment,
        from_teacher=None,
        to_teacher=teacher,
        transferred_by=assigned_by,
        note=transfer_note,
    )
    reject_pending_lesson_assignment_requests(
        student,
        reviewed_by=assigned_by,
        note="A lessons teacher was assigned.",
    )
    close_visitor_follow_up_for_enrollment(student, updated_by=assigned_by)
    return enrollment


@transaction.atomic
def transfer_lesson_teacher(
    enrollment: LessonStudentEnrollment,
    new_teacher: Person,
    *,
    transferred_by: Optional[Person] = None,
    note: str = "",
) -> LessonTeacherTransfer:
    reason = student_cannot_be_own_teacher_error(enrollment.student, new_teacher)
    if reason:
        raise ValueError(reason)

    transfer = LessonTeacherTransfer.objects.create(
        enrollment=enrollment,
        from_teacher=enrollment.teacher,
        to_teacher=new_teacher,
        transferred_by=transferred_by,
        note=note,
    )
    enrollment.teacher = new_teacher
    enrollment.historical_teacher_first_name = ""
    enrollment.historical_teacher_last_name = ""
    enrollment.save(
        update_fields=[
            "teacher",
            "historical_teacher_first_name",
            "historical_teacher_last_name",
            "updated_at",
        ]
    )
    return transfer


def reject_pending_lesson_assignment_requests(
    student: Person,
    *,
    reviewed_by: Optional[Person] = None,
    note: str = "",
    exclude_id: Optional[int] = None,
) -> int:
    """Mark open teacher requests for this student as rejected."""
    now = timezone.now()
    queryset = LessonAssignmentRequest.objects.filter(
        student=student,
        status=LessonAssignmentRequest.Status.PENDING,
    )
    if exclude_id is not None:
        queryset = queryset.exclude(pk=exclude_id)
    return queryset.update(
        status=LessonAssignmentRequest.Status.REJECTED,
        reviewed_by=reviewed_by,
        reviewed_at=now,
        review_note=note or "",
        updated_at=now,
    )


def _assert_teacher_on_student_ncc_roster(teacher: Person, student: Person) -> None:
    from apps.ministries.ncc import ensure_ncc_ministry, person_on_ncc_roster

    branch = getattr(student, "branch", None)
    if branch is None:
        raise ValidationError(
            {
                "student_id": (
                    "Student must have a branch before assigning a lessons teacher."
                )
            }
        )
    ensure_ncc_ministry(branch)
    if not person_on_ncc_roster(teacher, branch):
        raise ValidationError(
            {
                "teacher_id": (
                    "Select a teacher from this branch's NCC / Lessons roster "
                    "(Ministries). Inactive teachers remain selectable."
                )
            }
        )


def submit_lesson_assignment_request(
    *,
    student: Person,
    teacher: Person,
    requested_by: Optional[Person] = None,
    lessons: Optional[Iterable[Lesson]] = None,
    add_lessons_if_pending: bool = False,
) -> LessonAssignmentRequest:
    """
    Record a teacher's request to take a student.
    Does not create an enrollment or lesson progress.
    """
    lesson_list = list(lessons or [])
    if not getattr(teacher, "branch_id", None):
        raise ValidationError(
            {"teacher_id": "You must belong to a branch to request a student."}
        )
    if student.branch_id != teacher.branch_id:
        raise ValidationError({"student_id": "Student must be in your branch."})

    reason = student_cannot_be_own_teacher_error(student, teacher)
    if reason:
        raise ValidationError({"teacher_id": reason})
    if getattr(student, "role", None) != "VISITOR":
        raise ValidationError(
            {"student_id": "Only visitors can be requested for lesson assignment."}
        )
    if student.has_finished_lessons:
        raise ValidationError({"student_id": "This person has finished lessons."})
    if LessonStudentEnrollment.objects.filter(student=student).exists():
        raise ValidationError(
            {"student_id": "This student already has a lessons teacher assigned."}
        )
    _assert_teacher_on_student_ncc_roster(teacher, student)

    ineligible = []
    for lesson in lesson_list:
        lesson_reason = person_assignment_eligibility_error(student, lesson=lesson)
        if lesson_reason:
            title = lesson.title or f"Lesson {lesson.pk}"
            ineligible.append(f"{title} ({lesson_reason})")
    if ineligible:
        raise ValidationError(
            {"lesson_ids": "Cannot assign lessons: " + "; ".join(ineligible) + "."}
        )

    existing = LessonAssignmentRequest.objects.filter(
        student=student,
        teacher=teacher,
        status=LessonAssignmentRequest.Status.PENDING,
    ).first()
    if existing:
        if add_lessons_if_pending:
            if lesson_list:
                existing.lessons.add(*lesson_list)
            return existing
        raise ValidationError(
            {"student_id": "You already have a pending request for this student."}
        )

    try:
        assignment_request = LessonAssignmentRequest.objects.create(
            student=student,
            teacher=teacher,
            requested_by=requested_by,
        )
    except IntegrityError as exc:
        raise ValidationError(
            {"student_id": "You already have a pending request for this student."}
        ) from exc
    if lesson_list:
        assignment_request.lessons.set(lesson_list)
    return assignment_request


@transaction.atomic
def approve_lesson_assignment_request(
    assignment_request: LessonAssignmentRequest,
    reviewer: Person,
    *,
    note: str = "",
) -> LessonAssignmentRequest:
    """Create the enrollment and lesson progress, then close sibling requests."""
    locked = (
        LessonAssignmentRequest.objects.select_for_update()
        .select_related("student", "teacher")
        .get(pk=assignment_request.pk)
    )
    if locked.status != LessonAssignmentRequest.Status.PENDING:
        raise ValidationError("Only pending requests can be approved.")
    if LessonStudentEnrollment.objects.filter(student_id=locked.student_id).exists():
        raise ValidationError("This student already has a lessons teacher assigned.")

    now = timezone.now()
    locked.status = LessonAssignmentRequest.Status.APPROVED
    locked.reviewed_by = reviewer
    locked.reviewed_at = now
    locked.review_note = note or ""
    locked.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"]
    )
    ensure_lesson_enrollment(
        locked.student,
        locked.teacher,
        assigned_by=reviewer,
        note=note or "Approved teacher assignment request.",
    )
    for lesson in locked.lessons.all():
        bulk_assign_lessons(
            lesson,
            [locked.student],
            assigned_by=reviewer,
            teacher=locked.teacher,
        )
    return locked


@transaction.atomic
def reject_lesson_assignment_request(
    assignment_request: LessonAssignmentRequest,
    reviewer: Person,
    *,
    note: str = "",
) -> LessonAssignmentRequest:
    """Leave the student unassigned and mark the request rejected."""
    locked = LessonAssignmentRequest.objects.select_for_update().get(
        pk=assignment_request.pk
    )
    if locked.status != LessonAssignmentRequest.Status.PENDING:
        raise ValidationError("Only pending requests can be rejected.")
    now = timezone.now()
    locked.status = LessonAssignmentRequest.Status.REJECTED
    locked.reviewed_by = reviewer
    locked.reviewed_at = now
    locked.review_note = note or ""
    locked.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"]
    )
    from apps.evangelism.visitor_follow_up import ensure_visitor_follow_up_for_person

    ensure_visitor_follow_up_for_person(locked.student, updated_by=reviewer)
    return locked


STUDENT_CANNOT_BE_OWN_TEACHER_MESSAGE = (
    "A person cannot be assigned as their own lessons teacher."
)


def student_cannot_be_own_teacher_error(
    student: Person,
    teacher: Optional[Person],
) -> str | None:
    """Return an error message when student and teacher are the same person."""
    if teacher is None or student.pk is None or teacher.pk is None:
        return None
    if student.pk == teacher.pk:
        return STUDENT_CANNOT_BE_OWN_TEACHER_MESSAGE
    return None


def person_assignment_eligibility_error(
    person: Person,
    *,
    lesson: Lesson | None = None,
) -> str | None:
    """
    Return a human-readable reason when a person cannot receive lesson assignment.
    """
    if getattr(person, "role", None) != "VISITOR":
        return "is not a visitor"
    if person.has_finished_lessons:
        return "has finished lessons"
    # Pending assignment requests must not block here: other teachers may still
    # request the same student, and coordinator bulk assign closes open requests.
    # Existing enrollment must not block progress assign: coordinators assign
    # multiple active lessons in sequence, and the first call creates the
    # enrollment that later calls would otherwise reject.
    if lesson is not None and PersonLessonProgress.objects.filter(
        person=person, lesson=lesson
    ).exists():
        return "already has lesson progress"
    return None


@transaction.atomic
def bulk_assign_lessons(
    lesson: Lesson,
    persons: Iterable[Person],
    *,
    assigned_by: Optional[Person] = None,
    teacher: Optional[Person] = None,
) -> int:
    """
    Ensures each target person has an assignment entry for the given lesson.
    Returns the number of records created.
    When teacher is provided, creates lesson enrollment for students who lack one.
    """

    created_count = 0
    for person in persons:
        if teacher and not LessonStudentEnrollment.objects.filter(student=person).exists():
            ensure_lesson_enrollment(
                person,
                teacher,
                assigned_by=assigned_by,
            )

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


@transaction.atomic
def backfill_missing_completed_lessons_for_person(
    person: Person,
    *,
    lessons_finished_at,
    completed_by: Optional[Person] = None,
) -> int:
    """
    Create missing progress records as COMPLETED for active latest lessons.
    Existing progress records are left unchanged.
    """
    completed_at = _as_aware_datetime(lessons_finished_at)
    created_count = 0

    lessons = Lesson.objects.filter(is_latest=True, is_active=True).order_by("order", "id")
    for lesson in lessons:
        progress, created = PersonLessonProgress.objects.get_or_create(
            person=person,
            lesson=lesson,
            defaults={
                "status": PersonLessonProgress.Status.ASSIGNED,
                "assigned_by": completed_by,
            },
        )
        if not created:
            continue

        mark_progress_completed(
            progress,
            completed_by=completed_by,
            completed_at=completed_at,
            completion_date=church_calendar_date(lessons_finished_at),
        )
        created_count += 1

    return created_count


@transaction.atomic
def reconcile_student_progress_from_reports(
    student: Person, *, force_report_rules: bool = False
) -> None:
    """
    Reconcile lesson progress with LESSON-type session report coverage.

    Legacy safeguard:
    - If the student has zero LESSON-type reports, do not mutate progress statuses
      unless force_report_rules=True (used by report-deletion paths).
    """
    active_latest_lessons = list(
        Lesson.objects.filter(is_latest=True, is_active=True).only("id")
    )
    if not active_latest_lessons:
        return

    lesson_ids = {lesson.id for lesson in active_latest_lessons}
    progresses = list(
        PersonLessonProgress.objects.filter(person=student, lesson_id__in=lesson_ids)
        .select_related("lesson", "completed_by")
        .order_by("lesson__order", "id")
    )
    if not progresses:
        return

    report_lesson_ids = set(
        LessonSessionReport.objects.filter(
            student=student,
            session_type=LessonSessionReport.SessionType.LESSON,
            lesson_id__isnull=False,
            lesson_id__in=lesson_ids,
        ).values_list("lesson_id", flat=True)
    )

    if not report_lesson_ids and not force_report_rules:
        # Legacy students may remain completed without session report records.
        return

    for progress in progresses:
        has_report = progress.lesson_id in report_lesson_ids
        if has_report:
            if progress.status != PersonLessonProgress.Status.COMPLETED:
                completed_by = progress.completed_by
                completed_at = progress.completed_at or timezone.now()
                mark_progress_completed(
                    progress,
                    completed_by=completed_by,
                    note=progress.notes,
                    completed_at=completed_at,
                    completion_date=_session_date_for_progress(progress),
                )
            continue

        previous_status = progress.status
        if previous_status == PersonLessonProgress.Status.COMPLETED:
            progress.status = PersonLessonProgress.Status.ASSIGNED
            progress.save(update_fields=["status", "updated_at"])
            revert_progress_completion(progress, previous_status=previous_status)

    enrollment = (
        LessonStudentEnrollment.objects.filter(student=student, is_active=True).first()
    )
    if not enrollment or not enrollment.commitment_signed:
        return

    refreshed_progresses = PersonLessonProgress.objects.filter(
        person=student,
        lesson_id__in=lesson_ids,
    )
    all_completed = (
        refreshed_progresses.exists()
        and refreshed_progresses.count() == len(lesson_ids)
        and not refreshed_progresses.exclude(
            status=PersonLessonProgress.Status.COMPLETED
        ).exists()
    )
    if not all_completed:
        clear_enrollment_commitment_signed(enrollment)


def _course_finish_calendar_date(person_records) -> Optional[date]:
    """
    Real course-finish day for a person who completed every in-scope lesson.

    1. :func:`trustworthy_lessons_finished_at` (session reports / full-catalog
       progress evidence)
    2. Varied ``completed_at`` days on the in-scope progress rows (when the
       full catalog is larger than this summary cohort)
    3. ``Person.lessons_finished_at`` for legacy graduates (including uniform
       stamped progress)

    Does not use ``assigned_at``.
    """
    person = None
    for record in person_records:
        person = record.person
        break
    if person is None:
        return None

    trusted = trustworthy_lessons_finished_at(person)
    if trusted is not None:
        return trusted

    completed_days = [
        day
        for record in person_records
        if record.status == PersonLessonProgress.Status.COMPLETED
        and (day := church_calendar_date(record.completed_at)) is not None
    ]
    if len(set(completed_days)) > 1:
        return max(completed_days)

    return church_calendar_date(person.lessons_finished_at)


def person_in_lessons_year_cohort(
    *,
    completed_count: int,
    total_lessons: int,
    person_records,
    year: int,
    include_historical_finished: bool = False,
) -> bool:
    """
    Whether a student belongs in the yearly Lessons browse / stats cohort.

    Ongoing and not-started students are always included. Course finishers are
    included when their trustworthy finish date falls in ``year``, or when
    ``include_historical_finished`` is True (including undated finishers).
    """
    if total_lessons <= 0 or completed_count <= 0:
        return True
    if completed_count < total_lessons:
        return True
    if include_historical_finished:
        return True
    finish_date = _course_finish_calendar_date(person_records)
    if finish_date is None:
        return False
    return date(year, 1, 1) <= finish_date <= date(year, 12, 31)


def build_lesson_progress_summary(
    progress_qs,
    *,
    year: Optional[int] = None,
    lesson_id: Optional[int] = None,
    version_label: Optional[str] = None,
    include_superseded: bool = False,
) -> dict:
    """Aggregate lesson progress for a pre-filtered PersonLessonProgress queryset.

    Person-level COMPLETED counts only students whose course finish date falls
    in ``year`` (trustworthy evidence first, else ``Person.lessons_finished_at``).
    Historical graduates and undated imports without a finish date are excluded
    from the yearly cohort.

    Lesson rows use that same cohort: students still in the course, plus
    students who finished every in-scope lesson in ``year``. Each lesson's
    completed/total counts are current status for those students, not
    all-time progress records.
    """
    queryset = progress_qs

    if lesson_id:
        queryset = queryset.filter(lesson_id=lesson_id)
    if version_label:
        queryset = queryset.filter(lesson__version_label=version_label)
    if not include_superseded:
        queryset = queryset.filter(lesson__is_latest=True)

    record_status_totals = {
        status: 0 for status, _ in PersonLessonProgress.Status.choices
    }
    for entry in queryset.values("status").annotate(total=Count("id")):
        record_status_totals[entry["status"]] = entry["total"]

    target_year = year if year is not None else timezone.now().year

    active_latest_queryset = queryset.filter(
        lesson__is_latest=True,
        lesson__is_active=True,
    ).select_related("lesson", "person")

    records_by_person: dict = {}
    for progress in active_latest_queryset:
        records_by_person.setdefault(progress.person_id, []).append(progress)

    lessons_in_scope_count = (
        active_latest_queryset.values("lesson_id").distinct().count()
    )
    person_status_totals = {
        status: 0 for status, _ in PersonLessonProgress.Status.choices
    }
    cohort_person_ids: list[int] = []

    for person_id, person_records in records_by_person.items():
        completed_count = sum(
            1
            for record in person_records
            if record.status == PersonLessonProgress.Status.COMPLETED
        )

        if not person_in_lessons_year_cohort(
            completed_count=completed_count,
            total_lessons=lessons_in_scope_count,
            person_records=person_records,
            year=target_year,
            include_historical_finished=False,
        ):
            continue

        lifecycle = _person_lifecycle_status(completed_count, lessons_in_scope_count)
        person_status_totals[lifecycle] += 1
        cohort_person_ids.append(person_id)

    lesson_breakdown = (
        queryset.filter(person_id__in=cohort_person_ids)
        .values(
            "lesson_id",
            "lesson__title",
            "lesson__version_label",
            "lesson__is_latest",
            "lesson__order",
        )
        .annotate(
            total=Count("id"),
            completed=Count("id", filter=Q(status="COMPLETED")),
            in_progress=Count("id", filter=Q(status="IN_PROGRESS")),
            assigned=Count("id", filter=Q(status="ASSIGNED")),
            skipped=Count("id", filter=Q(status="SKIPPED")),
        )
        .order_by("lesson__order", "lesson__version_label")
    )

    return {
        "overall": person_status_totals,
        "total_participants": len(cohort_person_ids),
        "year": target_year,
        "overall_records": record_status_totals,
        "total_records": queryset.count(),
        "lessons": [
            {
                "lesson_id": row["lesson_id"],
                "lesson_title": row["lesson__title"],
                "version_label": row["lesson__version_label"],
                "is_latest": row["lesson__is_latest"],
                "order": row["lesson__order"],
                "total": row["total"],
                "completed": row["completed"],
                "in_progress": row["in_progress"],
                "assigned": row["assigned"],
                "skipped": row["skipped"],
            }
            for row in lesson_breakdown
        ],
    }


def _person_brief(person: Person) -> dict:
    return {
        "id": person.id,
        "first_name": person.first_name or "",
        "middle_name": person.middle_name or "",
        "last_name": person.last_name or "",
        "suffix": person.suffix or "",
        "username": person.username,
    }


def _enrollment_for(person: Person) -> Optional[LessonStudentEnrollment]:
    try:
        return person.lesson_enrollment
    except LessonStudentEnrollment.DoesNotExist:
        return None


def _follow_up_for(person: Person) -> Optional[LessonFollowUpCase]:
    try:
        return person.lesson_follow_up_case
    except LessonFollowUpCase.DoesNotExist:
        return None


def _follow_up_payload(case: LessonFollowUpCase) -> dict:
    return {
        "id": case.id,
        "status": case.status,
        "action_text": case.action_text,
        "excuse_text": case.excuse_text,
        "who": case.who,
        "when": case.when_date.isoformat() if case.when_date else None,
        "remarks": case.remarks,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
    }


def _lesson_completion_date(
    lesson_id: int,
    progress: Optional[PersonLessonProgress],
    lesson_session_dates: dict[int, date],
) -> Optional[date]:
    if lesson_id in lesson_session_dates:
        return lesson_session_dates[lesson_id]
    if progress is None or progress.status != PersonLessonProgress.Status.COMPLETED:
        return None
    return church_calendar_date(progress.completed_at)


def _days_since(anchor: date, today: date) -> int:
    return (today - anchor).days


def _lesson_brief(lesson: Lesson) -> dict:
    return {
        "id": lesson.id,
        "code": lesson.code,
        "version_label": lesson.version_label,
        "title": lesson.title,
        "short_title": lesson.short_title or "",
        "order": lesson.order,
        "is_latest": lesson.is_latest,
        "is_active": lesson.is_active,
    }


def _person_nested(person: Person) -> dict:
    return {
        "id": person.id,
        "first_name": person.first_name or "",
        "middle_name": person.middle_name or "",
        "last_name": person.last_name or "",
        "suffix": person.suffix or "",
        "username": person.username,
        "member_id": person.member_id or "",
        "status": person.status or "",
        "cluster_codes": sorted(
            code for cluster in person.clusters.all() if (code := cluster.code)
        ),
        "evangelism_group_names": sorted(
            {
                group.name
                for group in person.evangelism_groups.all()
                if group.name
            }
        ),
        "branch": person.branch_id,
    }


def _teacher_brief_from_roster(row: dict) -> dict:
    return {
        "id": row["id"],
        "first_name": row.get("first_name") or "",
        "middle_name": row.get("middle_name") or "",
        "last_name": row.get("last_name") or "",
        "suffix": row.get("suffix") or "",
        "username": row.get("username") or "",
        "member_id": row.get("member_id") or "",
        "nickname": row.get("nickname") or "",
        "role": row.get("role") or "",
        "branch": row.get("branch") or row.get("branch_id"),
        "branch_id": row.get("branch_id") or row.get("branch"),
    }


def _person_lifecycle_status(completed_count: int, total_lessons: int) -> str:
    if total_lessons <= 0 or completed_count <= 0:
        return PersonLessonProgress.Status.ASSIGNED
    if completed_count >= total_lessons:
        return PersonLessonProgress.Status.COMPLETED
    return PersonLessonProgress.Status.IN_PROGRESS


def _activity_iso_from_parts(
    *,
    enrollment_assigned_at,
    progress_assigned_values: Iterable,
    session_iso: Optional[str],
) -> Optional[str]:
    best_iso: Optional[str] = None
    best_ms = 0

    def consider(value) -> None:
        nonlocal best_iso, best_ms
        if value is None:
            return
        if isinstance(value, datetime):
            iso = value.isoformat()
            ms = value.timestamp()
        elif isinstance(value, date):
            iso = value.isoformat()
            ms = datetime.combine(value, time.min).timestamp()
        else:
            iso = str(value)
            try:
                parsed = datetime.fromisoformat(iso.replace("Z", "+00:00"))
                ms = parsed.timestamp()
            except ValueError:
                return
        if ms > best_ms:
            best_ms = ms
            best_iso = iso

    consider(enrollment_assigned_at)
    consider(session_iso)
    for assigned_at in progress_assigned_values:
        consider(assigned_at)
    return best_iso


def build_latest_session_activity(student_ids_or_qs) -> dict[str, str]:
    """Map student id (str) -> ISO datetime of latest lesson session activity."""
    if isinstance(student_ids_or_qs, QuerySet):
        if getattr(student_ids_or_qs.model, "_meta", None) and (
            student_ids_or_qs.model is Person
        ):
            student_ids = list(student_ids_or_qs.values_list("pk", flat=True))
        else:
            student_ids = list(student_ids_or_qs)
    else:
        student_ids = list(student_ids_or_qs)

    if not student_ids:
        return {}

    rows = (
        LessonSessionReport.objects.filter(student_id__in=student_ids)
        .values("student_id")
        .annotate(max_start=Max("session_start"), max_date=Max("session_date"))
    )
    result: dict[str, str] = {}
    for row in rows:
        sid = str(row["student_id"])
        start = row["max_start"]
        session_day = row["max_date"]
        chosen: Optional[str] = None
        chosen_ms = 0.0

        if start is not None:
            if timezone.is_naive(start):
                start = timezone.make_aware(start, get_church_timezone())
            chosen = start.isoformat()
            chosen_ms = start.timestamp()

        if session_day is not None:
            day_dt = _as_aware_datetime(session_day)
            day_ms = day_dt.timestamp()
            if day_ms > chosen_ms:
                chosen = day_dt.isoformat()
                chosen_ms = day_ms

        if chosen:
            result[sid] = chosen
    return result


def build_lesson_teacher_overview(
    *,
    people_qs,
    roster_rows: list[dict],
    year: Optional[int] = None,
    include_historical_finished: bool = False,
) -> list[dict]:
    catalog = list(
        Lesson.objects.filter(is_latest=True, is_active=True).order_by("order", "id")
    )
    total_lessons = len(catalog)
    target_year = year if year is not None else timezone.now().year

    people = list(
        people_qs.prefetch_related(
            Prefetch(
                "lesson_progress",
                queryset=PersonLessonProgress.objects.filter(
                    lesson__is_latest=True,
                    lesson__is_active=True,
                ).select_related("lesson", "person"),
            ),
            "lesson_enrollment__teacher",
        )
    )

    def empty_bucket(*, key: str, teacher: Optional[dict], is_active) -> dict:
        return {
            "key": key,
            "teacher": teacher,
            "total": 0,
            "in_progress": 0,
            "completed": 0,
            "not_started": 0,
            "number": None,
            "is_active": is_active,
        }

    buckets: dict[str, dict] = {}

    for person in people:
        progress_list = list(person.lesson_progress.all())
        completed_count = sum(
            1
            for progress in progress_list
            if progress.status == PersonLessonProgress.Status.COMPLETED
        )
        if not person_in_lessons_year_cohort(
            completed_count=completed_count,
            total_lessons=total_lessons,
            person_records=progress_list,
            year=target_year,
            include_historical_finished=include_historical_finished,
        ):
            continue
        lifecycle = _person_lifecycle_status(completed_count, total_lessons)

        enrollment = _enrollment_for(person)
        teacher_brief = None
        key = "no-teacher"
        if (
            enrollment is not None
            and enrollment.is_active
            and enrollment.teacher_id
            and enrollment.teacher is not None
        ):
            key = str(enrollment.teacher_id)
            teacher_brief = _person_brief(enrollment.teacher)

        bucket = buckets.get(key)
        if bucket is None:
            bucket = empty_bucket(
                key=key,
                teacher=teacher_brief,
                is_active=True if key != "no-teacher" else None,
            )
            buckets[key] = bucket

        bucket["total"] += 1
        if lifecycle == PersonLessonProgress.Status.COMPLETED:
            bucket["completed"] += 1
        elif lifecycle == PersonLessonProgress.Status.IN_PROGRESS:
            bucket["in_progress"] += 1
        else:
            bucket["not_started"] += 1

    for row in roster_rows:
        key = str(row["id"])
        teacher_brief = _teacher_brief_from_roster(row)
        is_active = row.get("is_active")
        if key in buckets:
            buckets[key]["teacher"] = teacher_brief
            buckets[key]["is_active"] = is_active
        else:
            buckets[key] = empty_bucket(
                key=key, teacher=teacher_brief, is_active=is_active
            )

    named: list[dict] = []
    no_teacher: Optional[dict] = None
    for key, bucket in buckets.items():
        if key == "no-teacher":
            no_teacher = bucket
        else:
            named.append(bucket)

    def sort_key(bucket: dict) -> tuple:
        teacher = bucket.get("teacher") or {}
        return (
            (teacher.get("last_name") or "").lower(),
            (teacher.get("first_name") or "").lower(),
            teacher.get("id") or 0,
        )

    named.sort(key=sort_key)
    for index, bucket in enumerate(named, start=1):
        bucket["number"] = index

    if no_teacher is not None:
        return [*named, no_teacher]
    return named


def build_lesson_student_summaries(
    *,
    progress_qs,
    enrollment_qs=None,
    people_scope_qs=None,
    search: Optional[str] = None,
    teacher_id: Optional[int] = None,
    teacher_key: Optional[str] = None,
    status: Optional[str] = None,
    next_lesson_id: Optional[int] = None,
    ordering: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    year: Optional[int] = None,
    include_historical_finished: bool = False,
) -> dict:
    catalog = list(
        Lesson.objects.filter(is_latest=True, is_active=True).order_by("order", "id")
    )
    total_lessons = len(catalog)
    catalog_ids = {lesson.id for lesson in catalog}
    target_year = year if year is not None else timezone.now().year

    base_progress = progress_qs.filter(
        lesson__is_latest=True,
        lesson__is_active=True,
    )
    # Clear model Meta.ordering — DISTINCT person_id otherwise keeps
    # lesson__order / name columns and repeats each student once per lesson.
    person_ids = list(
        base_progress.order_by().values_list("person_id", flat=True).distinct()
    )
    # Match Teachers overview: include active enrollments even with no progress yet.
    if enrollment_qs is not None:
        enrollment_person_ids = list(
            enrollment_qs.values_list("student_id", flat=True)
        )
        seen = set(person_ids)
        for student_id in enrollment_person_ids:
            if student_id not in seen:
                seen.add(student_id)
                person_ids.append(student_id)
    if people_scope_qs is not None:
        allowed_ids = set(people_scope_qs.values_list("pk", flat=True))
        person_ids = [pid for pid in person_ids if pid in allowed_ids]

    if not person_ids:
        return {"count": 0, "results": []}

    normalized_query = (search or "").strip()
    if normalized_query:
        person_ids = list(
            Person.objects.filter(pk__in=person_ids)
            .filter(
                Q(first_name__icontains=normalized_query)
                | Q(last_name__icontains=normalized_query)
                | Q(middle_name__icontains=normalized_query)
                | Q(username__icontains=normalized_query)
                | Q(member_id__icontains=normalized_query)
            )
            .values_list("pk", flat=True)
        )
        if not person_ids:
            return {"count": 0, "results": []}

    if teacher_key == "no-teacher":
        with_teacher_ids = set(
            LessonStudentEnrollment.objects.filter(
                student_id__in=person_ids,
                is_active=True,
                teacher_id__isnull=False,
            ).values_list("student_id", flat=True)
        )
        person_ids = [pid for pid in person_ids if pid not in with_teacher_ids]
    elif teacher_key:
        person_ids = list(
            LessonStudentEnrollment.objects.filter(
                student_id__in=person_ids,
                is_active=True,
                teacher_id=int(teacher_key),
            ).values_list("student_id", flat=True)
        )
    elif teacher_id is not None:
        person_ids = list(
            LessonStudentEnrollment.objects.filter(
                student_id__in=person_ids,
                is_active=True,
                teacher_id=teacher_id,
            ).values_list("student_id", flat=True)
        )

    if not person_ids:
        return {"count": 0, "results": []}

    progress_by_person: dict[int, list[PersonLessonProgress]] = defaultdict(list)
    for progress in PersonLessonProgress.objects.filter(
        person_id__in=person_ids,
        lesson_id__in=catalog_ids,
    ).select_related("lesson", "person"):
        progress_by_person[progress.person_id].append(progress)

    enrollments = {
        enrollment.student_id: enrollment
        for enrollment in LessonStudentEnrollment.objects.filter(
            student_id__in=person_ids
        ).select_related("teacher")
    }

    person_name_data = {
        row["id"]: row
        for row in Person.objects.filter(pk__in=person_ids).values(
            "id", "first_name", "last_name", "username"
        )
    }

    session_activity = build_latest_session_activity(person_ids)

    def _person_sort_name(person_id: int) -> str:
        person = person_name_data.get(person_id) or {}
        return " ".join(
            part
            for part in (
                person.get("first_name"),
                person.get("last_name"),
                person.get("username"),
            )
            if part
        ).lower()

    light_rows: list[dict] = []
    for person_id in person_ids:
        if person_id not in person_name_data:
            continue

        progress_list = progress_by_person.get(person_id, [])
        completed_progress = [
            progress
            for progress in progress_list
            if progress.status == PersonLessonProgress.Status.COMPLETED
        ]
        completed_count = len(completed_progress)
        has_skipped = any(
            progress.status == PersonLessonProgress.Status.SKIPPED
            for progress in progress_list
        )

        previous_lesson = None
        if completed_progress:
            previous_lesson = max(
                completed_progress,
                key=lambda progress: (progress.lesson.order, progress.lesson.id),
            ).lesson

        completed_lesson_ids = {
            progress.lesson_id for progress in completed_progress
        }
        next_lesson = next(
            (lesson for lesson in catalog if lesson.id not in completed_lesson_ids),
            None,
        )

        progress_percentage = (
            round((completed_count / total_lessons) * 100) if total_lessons else 0
        )
        lifecycle = _person_lifecycle_status(completed_count, total_lessons)

        if not person_in_lessons_year_cohort(
            completed_count=completed_count,
            total_lessons=total_lessons,
            person_records=progress_list,
            year=target_year,
            include_historical_finished=include_historical_finished,
        ):
            continue

        enrollment = enrollments.get(person_id)
        teacher_sort = ("", "")
        if (
            enrollment is not None
            and enrollment.is_active
            and enrollment.teacher_id
            and enrollment.teacher is not None
        ):
            teacher = enrollment.teacher
            teacher_sort = (
                (teacher.last_name or "").lower(),
                (teacher.first_name or "").lower(),
            )

        assigned_values = [
            progress.assigned_at for progress in progress_list if progress.assigned_at
        ]
        last_activity = _activity_iso_from_parts(
            enrollment_assigned_at=enrollment.assigned_at if enrollment else None,
            progress_assigned_values=assigned_values,
            session_iso=session_activity.get(str(person_id)),
        )

        light_rows.append(
            {
                "person_id": person_id,
                "completedCount": completed_count,
                "totalLessons": total_lessons,
                "progressPercentage": progress_percentage,
                "lifecycleStatus": lifecycle,
                "hasSkipped": has_skipped,
                "lastActivityAt": last_activity,
                "previousLesson": (
                    _lesson_brief(previous_lesson) if previous_lesson else None
                ),
                "nextLesson": _lesson_brief(next_lesson) if next_lesson else None,
                "person_sort_name": _person_sort_name(person_id),
                "teacher_sort": teacher_sort,
            }
        )

    if status:
        if status == PersonLessonProgress.Status.SKIPPED:
            light_rows = [row for row in light_rows if row.get("hasSkipped")]
        else:
            light_rows = [
                row for row in light_rows if row["lifecycleStatus"] == status
            ]

    if next_lesson_id is not None:
        light_rows = [
            row
            for row in light_rows
            if row["nextLesson"] and row["nextLesson"]["id"] == next_lesson_id
        ]

    order_field = ordering or "-recentActivity"
    descending = order_field.startswith("-")
    field = order_field.lstrip("-")
    if field == "recentActivity" and ordering is None:
        descending = True

    def sort_key(row: dict):
        if field == "person":
            return (row["person_sort_name"],)
        if field == "teacher":
            return row["teacher_sort"]
        if field == "previousLesson":
            lesson = row["previousLesson"]
            return (
                lesson.get("order") if lesson else float("inf"),
                (lesson.get("title") or "") if lesson else "",
            )
        if field == "nextLesson":
            lesson = row["nextLesson"]
            return (
                lesson.get("order") if lesson else float("inf"),
                (lesson.get("title") or "") if lesson else "",
            )
        if field == "progress":
            return (row["progressPercentage"], row["completedCount"])
        if field == "status":
            return (row["lifecycleStatus"],)
        iso = row.get("lastActivityAt") or ""
        try:
            ms = datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
        except ValueError:
            ms = 0
        return (ms, row["person_sort_name"])

    light_rows.sort(key=sort_key, reverse=descending)

    page = max(1, int(page or 1))
    page_size = max(1, int(page_size or 25))
    start = (page - 1) * page_size
    end = start + page_size
    page_light_rows = light_rows[start:end]
    total_count = len(light_rows)

    if not page_light_rows:
        return {"count": total_count, "results": []}

    page_person_ids = [row["person_id"] for row in page_light_rows]
    people_by_id = {
        person.id: person
        for person in Person.objects.filter(pk__in=page_person_ids)
        .prefetch_related("clusters", "evangelism_groups")
        .select_related("lesson_enrollment__teacher")
    }

    results: list[dict] = []
    for light in page_light_rows:
        person_id = light["person_id"]
        person = people_by_id.get(person_id)
        if person is None:
            continue

        enrollment = enrollments.get(person_id)
        teacher_person = None
        if enrollment and enrollment.is_active and enrollment.teacher is not None:
            teacher_person = enrollment.teacher

        results.append(
            {
                "person": _person_nested(person),
                "teacher": _person_nested(teacher_person) if teacher_person else None,
                "previousLesson": light["previousLesson"],
                "completedCount": light["completedCount"],
                "totalLessons": light["totalLessons"],
                "nextLesson": light["nextLesson"],
                "progressPercentage": light["progressPercentage"],
                "lifecycleStatus": light["lifecycleStatus"],
                "hasSkipped": light["hasSkipped"],
                "lastActivityAt": light["lastActivityAt"],
                "allProgress": [],
            }
        )

    return {"count": total_count, "results": results}


def build_lesson_timeline(
    people: QuerySet[Person],
    *,
    search: Optional[str] = None,
    filter_mode: Optional[str] = None,
    ordering: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    """
    One row per student who has lesson progress or an enrollment.

    Days since the last session are the follow-up alert. Baptism and Holy Ghost
    dates are markers only.
    """
    catalog = list(
        Lesson.objects.filter(is_latest=True, is_active=True).order_by("order", "id")
    )
    people = people.select_related(
        "lesson_enrollment__teacher",
        "lesson_follow_up_case",
        "primary_cluster",
    ).prefetch_related(
        Prefetch(
            "lesson_progress",
            queryset=PersonLessonProgress.objects.select_related("lesson"),
        ),
        Prefetch(
            "lesson_reports_as_student",
            queryset=LessonSessionReport.objects.select_related("lesson").order_by(
                "-session_date", "-session_start", "-id"
            ),
        ),
    )

    today = church_today()
    students = []
    for person in people:
        reports = list(person.lesson_reports_as_student.all())
        latest = reports[0] if reports else None
        lesson_session_dates: dict[int, date] = {}
        for report in reports:
            if (
                report.session_type != LessonSessionReport.SessionType.LESSON
                or not report.lesson_id
            ):
                continue
            lesson_session_dates.setdefault(report.lesson_id, report.session_date)

        progress_by_lesson = {
            progress.lesson_id: progress for progress in person.lesson_progress.all()
        }
        enrollment = _enrollment_for(person)
        last_session_date = latest.session_date if latest else None
        if last_session_date is not None:
            days_since = _days_since(last_session_date, today)
            days_anchor = "session"
        else:
            anchor_date = None
            days_anchor = None
            if enrollment is not None and enrollment.assigned_at:
                anchor_date = church_calendar_date(enrollment.assigned_at)
                days_anchor = "enrollment"
            else:
                assigned_at_values = [
                    progress.assigned_at
                    for progress in progress_by_lesson.values()
                    if progress.assigned_at
                ]
                if assigned_at_values:
                    anchor_date = church_calendar_date(min(assigned_at_values))
                    days_anchor = "assignment"
            days_since = (
                _days_since(anchor_date, today) if anchor_date is not None else None
            )

        teacher = None
        teacher_name = ""
        if enrollment is not None:
            if enrollment.teacher_id and enrollment.teacher is not None:
                teacher = _person_brief(enrollment.teacher)
                teacher_name = (
                    enrollment.teacher.get_full_name() or enrollment.teacher.username
                )
            else:
                teacher_name = " ".join(
                    part
                    for part in (
                        enrollment.historical_teacher_first_name,
                        enrollment.historical_teacher_last_name,
                    )
                    if part
                ).strip()

        follow_up = _follow_up_for(person)
        lesson_rows = []
        for lesson in catalog:
            progress = progress_by_lesson.get(lesson.id)
            completed_on = _lesson_completion_date(
                lesson.id, progress, lesson_session_dates
            )
            lesson_rows.append(
                {
                    "lesson_id": lesson.id,
                    "status": progress.status if progress else None,
                    "completed_on": completed_on.isoformat() if completed_on else None,
                }
            )

        completed_all_catalog = bool(catalog) and all(
            row["status"] == PersonLessonProgress.Status.COMPLETED
            or row["completed_on"] is not None
            for row in lesson_rows
        )
        has_finished_lessons = bool(person.has_finished_lessons) or completed_all_catalog
        primary_cluster = (
            person.primary_cluster if person.primary_cluster_id else None
        )
        primary_cluster_code = (
            (primary_cluster.code or "").strip() if primary_cluster is not None else ""
        )

        students.append(
            {
                "person": _person_brief(person),
                "teacher": teacher,
                "teacher_name": teacher_name,
                "has_finished_lessons": has_finished_lessons,
                "water_baptism_date": (
                    person.water_baptism_date.isoformat()
                    if person.water_baptism_date
                    else None
                ),
                "spirit_baptism_date": (
                    person.spirit_baptism_date.isoformat()
                    if person.spirit_baptism_date
                    else None
                ),
                "cluster_codes": (
                    [primary_cluster_code] if primary_cluster_code else []
                ),
                "lessons": lesson_rows,
                "last_session_date": (
                    last_session_date.isoformat() if last_session_date else None
                ),
                "days_since_last_session": days_since,
                "days_anchor": days_anchor,
                "next_session_date": (
                    latest.next_session_date.isoformat()
                    if latest and latest.next_session_date
                    else None
                ),
                "follow_up": _follow_up_payload(follow_up) if follow_up else None,
            }
        )

    mode = filter_mode or "needs_follow_up"
    if mode != "all":
        filtered_students = []
        for row in students:
            follow_up = row.get("follow_up") or {}
            is_dropped = follow_up.get("status") == LessonFollowUpCase.Status.DROPPED
            finished = row.get("has_finished_lessons", False)
            if mode == "needs_follow_up":
                if finished or is_dropped:
                    continue
            elif mode == "finished":
                if not finished:
                    continue
            elif mode == "dropped":
                if not is_dropped:
                    continue
            filtered_students.append(row)
        students = filtered_students

    normalized_query = (search or "").strip().lower()
    if normalized_query:

        def timeline_matches(row: dict) -> bool:
            person = row["person"]
            parts = [
                person.get("first_name") or "",
                person.get("middle_name") or "",
                person.get("last_name") or "",
                person.get("username") or "",
            ]
            return normalized_query in " ".join(parts).lower()

        students = [row for row in students if timeline_matches(row)]

    order_field = ordering or "-days"
    descending = order_field.startswith("-")
    field = order_field.lstrip("-")
    if field not in {"days", "name", "teacher"}:
        field = "days"
        descending = True

    if field == "days":
        students.sort(
            key=lambda row: (
                row["days_since_last_session"] is None,
                -(row["days_since_last_session"] or 0),
                (row["person"]["last_name"] or "").lower(),
                (row["person"]["first_name"] or "").lower(),
            ),
            reverse=False,
        )
        if not descending:
            students.reverse()
    elif field == "name":
        students.sort(
            key=lambda row: (
                (row["person"]["last_name"] or "").lower(),
                (row["person"]["first_name"] or "").lower(),
            ),
            reverse=descending,
        )
    else:
        students.sort(
            key=lambda row: (
                (row.get("teacher_name") or "").lower(),
                (row["person"]["last_name"] or "").lower(),
            ),
            reverse=descending,
        )

    total_count = len(students)
    page = max(1, int(page or 1))
    page_size = max(1, int(page_size or 25))
    start = (page - 1) * page_size
    end = start + page_size
    page_rows = students[start:end]

    return {
        "lessons": [
            {
                "id": lesson.id,
                "title": lesson.title,
                "short_title": lesson.short_title,
                "order": lesson.order,
                "code": lesson.code,
            }
            for lesson in catalog
        ],
        "count": total_count,
        "results": page_rows,
        "students": page_rows,
    }


def _follow_up_journey_description(
    *,
    status: str,
    action_text: str,
    excuse_text: str,
    who: str,
    when_date: Optional[date],
    remarks: str,
) -> str:
    if status == LessonFollowUpCase.Status.DROPPED:
        lines = [excuse_text.strip() or "Stopped the remaining lessons."]
    else:
        lines = [action_text.strip()]
    if who.strip():
        lines.append(f"Who: {who.strip()}")
    if when_date:
        lines.append(f"When: {when_date.isoformat()}")
    if remarks.strip():
        lines.append(remarks.strip())
    return "\n".join(line for line in lines if line)


@transaction.atomic
def save_lesson_follow_up(
    *,
    student: Person,
    actor: Optional[Person],
    status: str,
    action_text: str = "",
    excuse_text: str = "",
    who: str = "",
    when_date: Optional[date] = None,
    remarks: str = "",
) -> LessonFollowUpCase:
    action_text = (action_text or "").strip()
    excuse_text = (excuse_text or "").strip()
    who = (who or "").strip()
    remarks = (remarks or "").strip()

    if status == LessonFollowUpCase.Status.ACTION_PLANNED and not action_text:
        raise ValidationError({"action_text": "Describe the action plan."})
    if status not in LessonFollowUpCase.Status.values:
        raise ValidationError({"status": "Choose an action plan or a drop."})

    case, _created = LessonFollowUpCase.objects.update_or_create(
        student=student,
        defaults={
            "status": status,
            "action_text": action_text,
            "excuse_text": excuse_text,
            "who": who,
            "when_date": when_date,
            "remarks": remarks,
            "updated_by": actor,
        },
    )
    title = (
        FOLLOW_UP_DROPPED_TITLE
        if status == LessonFollowUpCase.Status.DROPPED
        else FOLLOW_UP_PLAN_TITLE
    )
    Journey.objects.create(
        user=student,
        type="NOTE",
        title=title,
        description=_follow_up_journey_description(
            status=status,
            action_text=action_text,
            excuse_text=excuse_text,
            who=who,
            when_date=when_date,
            remarks=remarks,
        ),
        date=church_today(),
        verified_by=actor if isinstance(actor, Person) else None,
    )
    if status == LessonFollowUpCase.Status.DROPPED:
        stop_remaining_lessons(student)
    return case


def stop_remaining_lessons(student: Person) -> None:
    """
    Close every active lesson the student has not completed.

    Completed lessons stay completed. Unfinished and not-yet-started lessons
    are marked skipped, and the enrollment is no longer active.
    """
    lessons = Lesson.objects.filter(is_latest=True, is_active=True).order_by("order", "id")
    existing = {
        progress.lesson_id: progress
        for progress in PersonLessonProgress.objects.filter(
            person=student,
            lesson__in=lessons,
        )
    }
    for lesson in lessons:
        progress = existing.get(lesson.id)
        if progress is None:
            PersonLessonProgress.objects.create(
                person=student,
                lesson=lesson,
                status=PersonLessonProgress.Status.SKIPPED,
            )
            continue
        if progress.status == PersonLessonProgress.Status.COMPLETED:
            continue
        if progress.status != PersonLessonProgress.Status.SKIPPED:
            progress.status = PersonLessonProgress.Status.SKIPPED
            progress.save(update_fields=["status", "updated_at"])

    LessonStudentEnrollment.objects.filter(student=student, is_active=True).update(
        is_active=False,
        updated_at=timezone.now(),
    )
    from apps.evangelism.visitor_follow_up import (
        reopen_visitor_follow_up_for_inactive_enrollment,
    )

    reopen_visitor_follow_up_for_inactive_enrollment(student)


def clear_lesson_follow_up_for_newer_session(report: LessonSessionReport) -> None:
    """Delete the open follow-up case when a session is logged after it. Notes stay."""
    if report.student_id is None or report.session_date is None:
        return
    try:
        case = report.student.lesson_follow_up_case
    except LessonFollowUpCase.DoesNotExist:
        return
    case_day = church_calendar_date(case.updated_at)
    if case_day is None:
        return
    session_is_newer = report.session_date > case_day or (
        report.session_date == case_day and report.created_at > case.updated_at
    )
    if session_is_newer:
        case.delete()
