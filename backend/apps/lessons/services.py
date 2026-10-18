from __future__ import annotations

from datetime import date, datetime, time
from dataclasses import dataclass
from typing import Iterable, Optional

from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q, QuerySet
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


def sync_person_lessons_finished_from_progress(person: Person) -> None:
    """
    Mirror module lesson completion onto Person.has_finished_lessons /
    lessons_finished_at when the person has PersonLessonProgress rows.
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
        completed_dates = [
            milestone
            for progress in progresses
            if (milestone := _milestone_date_for_progress(progress)) is not None
        ]
        lessons_finished_at = max(completed_dates) if completed_dates else None
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


@transaction.atomic
def set_enrollment_commitment_signed(
    enrollment: LessonStudentEnrollment,
    *,
    signed_by: Optional[Person] = None,
    signed_at=None,
    note: Optional[str] = None,
) -> Journey:
    """
    Records a one-time commitment signature on enrollment and upserts a NOTE journey.
    """

    signed_at = signed_at or timezone.now()
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

    signed_milestone = church_calendar_date(signed_at)

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
    existing = (
        LessonStudentEnrollment.objects.filter(student=student)
        .select_related("teacher", "student")
        .first()
    )
    if existing:
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
    if person.has_finished_lessons:
        return "has finished lessons"
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

    Uses the latest progress ``completed_at`` (church calendar). If those
    timestamps are missing (common after bulk import), falls back to
    ``Person.lessons_finished_at``. Does not use ``assigned_at``.
    """
    completed_dates = []
    person = None
    for record in person_records:
        person = record.person
        if record.status != PersonLessonProgress.Status.COMPLETED:
            continue
        milestone = church_calendar_date(record.completed_at)
        if milestone is not None:
            completed_dates.append(milestone)
    if completed_dates:
        return max(completed_dates)
    if person is None:
        return None
    return church_calendar_date(person.lessons_finished_at)


def build_lesson_progress_summary(
    progress_qs,
    *,
    year: Optional[int] = None,
    lesson_id: Optional[int] = None,
    version_label: Optional[str] = None,
    include_superseded: bool = False,
) -> dict:
    """Aggregate lesson progress for a pre-filtered PersonLessonProgress queryset.

    Person-level COMPLETED counts only students whose course finish date
    (``completed_at`` or ``lessons_finished_at``) falls in ``year``. Historical
    graduates and undated bulk imports are excluded from the yearly cohort.

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
    year_start_date = date(target_year, 1, 1)
    year_end_date = date(target_year, 12, 31)

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

        if completed_count == 0:
            person_status_totals[PersonLessonProgress.Status.ASSIGNED] += 1
            cohort_person_ids.append(person_id)
            continue

        finished_all = (
            lessons_in_scope_count > 0 and completed_count >= lessons_in_scope_count
        )
        if finished_all:
            finish_date = _course_finish_calendar_date(person_records)
            if (
                finish_date is not None
                and year_start_date <= finish_date <= year_end_date
            ):
                person_status_totals[PersonLessonProgress.Status.COMPLETED] += 1
                cohort_person_ids.append(person_id)
            continue

        person_status_totals[PersonLessonProgress.Status.IN_PROGRESS] += 1
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


def build_lesson_timeline(people: QuerySet[Person]) -> dict:
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
    ).prefetch_related(
        "clusters",
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
                "cluster_codes": sorted(
                    code for cluster in person.clusters.all() if (code := cluster.code)
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

    students.sort(
        key=lambda row: (
            row["days_since_last_session"] is None,
            -(row["days_since_last_session"] or 0),
            (row["person"]["last_name"] or "").lower(),
            (row["person"]["first_name"] or "").lower(),
        )
    )
    return {
        "lessons": [
            {
                "id": lesson.id,
                "title": lesson.title,
                "order": lesson.order,
                "code": lesson.code,
            }
            for lesson in catalog
        ],
        "students": students,
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
