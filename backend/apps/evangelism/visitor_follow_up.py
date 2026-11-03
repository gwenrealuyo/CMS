"""Visitor / prospect follow-up caseload sync (inviter-owned until Lessons enrollment)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from django.db import transaction
from django.utils import timezone

from core.datetime_utils import church_today

from .models import FollowUpTask, Prospect, VisitorFollowUpCase

NEEDS_ATTENTION_DAYS = 14
OPEN_CASE_STATUSES = (
    VisitorFollowUpCase.CaseStatus.OPEN,
    VisitorFollowUpCase.CaseStatus.IN_PROGRESS,
    VisitorFollowUpCase.CaseStatus.NO_ACTION,
)


def prospect_has_active_lesson_enrollment(prospect: Prospect) -> bool:
    person = prospect.person
    if person is None:
        return False
    enrollment = getattr(person, "lesson_enrollment", None)
    if enrollment is None:
        try:
            from apps.lessons.models import LessonStudentEnrollment

            enrollment = LessonStudentEnrollment.objects.filter(student=person).first()
        except Exception:
            return False
    return bool(enrollment and enrollment.is_active)


def effective_last_activity_date(prospect: Prospect) -> Optional[date]:
    return prospect.last_activity_date or prospect.date_first_invited


def prospect_needs_attention(prospect: Prospect, *, today: Optional[date] = None) -> bool:
    anchor = effective_last_activity_date(prospect)
    if anchor is None:
        return True
    today = today or church_today()
    return (today - anchor).days >= NEEDS_ATTENTION_DAYS


def touch_prospect_activity(
    prospect: Prospect,
    activity_date: Optional[date] = None,
) -> Prospect:
    """Bump last_activity_date when activity_date is newer (or set if empty)."""
    activity_date = activity_date or church_today()
    current = prospect.last_activity_date
    if current is not None and current >= activity_date:
        return prospect
    prospect.last_activity_date = activity_date
    prospect.save(update_fields=["last_activity_date", "updated_at"])
    return prospect


def _cancel_open_tasks(prospect: Prospect) -> None:
    FollowUpTask.objects.filter(
        prospect=prospect,
        status__in=[
            FollowUpTask.Status.PENDING,
            FollowUpTask.Status.IN_PROGRESS,
        ],
    ).update(
        status=FollowUpTask.Status.CANCELLED,
        updated_at=timezone.now(),
    )


def _has_open_tasks(prospect: Prospect) -> bool:
    return FollowUpTask.objects.filter(
        prospect=prospect,
        status__in=[
            FollowUpTask.Status.PENDING,
            FollowUpTask.Status.IN_PROGRESS,
        ],
    ).exists()


def case_is_low_priority(case: VisitorFollowUpCase) -> bool:
    return case.case_status == VisitorFollowUpCase.CaseStatus.NO_ACTION


def case_is_deceased_closed(case: VisitorFollowUpCase) -> bool:
    return (
        case.case_status == VisitorFollowUpCase.CaseStatus.CLOSED
        and case.closed_reason == VisitorFollowUpCase.ClosedReason.DECEASED
    )


@transaction.atomic
def sync_visitor_case_status_from_tasks(
    prospect: Prospect,
    *,
    updated_by=None,
    clear_low_priority: bool = False,
) -> Optional[VisitorFollowUpCase]:
    """
    Derive OPEN vs Ongoing from open tasks.

    Skips CLOSED cases. Low-priority (NO_ACTION) stays until resume or
    clear_low_priority=True (e.g. adding a new task).
    """
    case = (
        VisitorFollowUpCase.objects.filter(prospect=prospect)
        .select_for_update()
        .first()
    )
    if case is None:
        return None
    if case.case_status == VisitorFollowUpCase.CaseStatus.CLOSED:
        return case
    if case_is_low_priority(case) and not clear_low_priority:
        return case

    desired = (
        VisitorFollowUpCase.CaseStatus.IN_PROGRESS
        if _has_open_tasks(prospect)
        else VisitorFollowUpCase.CaseStatus.OPEN
    )
    updates = []
    if case.case_status != desired:
        case.case_status = desired
        updates.append("case_status")
    if clear_low_priority and (case.remarks or "").strip():
        case.remarks = ""
        updates.append("remarks")
    if updated_by is not None:
        case.updated_by = updated_by
        updates.append("updated_by")
    if updates:
        case.save(update_fields=list(dict.fromkeys(updates + ["updated_at"])))
    return case


@transaction.atomic
def mark_visitor_follow_up_low_priority(
    case: VisitorFollowUpCase,
    *,
    reason: str = "",
    updated_by=None,
    cancel_tasks: bool = True,
) -> VisitorFollowUpCase:
    """Park an open case as low priority (soft pause — not closed)."""
    locked = (
        VisitorFollowUpCase.objects.select_for_update().get(pk=case.pk)
    )
    if locked.case_status == VisitorFollowUpCase.CaseStatus.CLOSED:
        raise ValueError("Closed cases cannot be marked low priority.")

    locked.case_status = VisitorFollowUpCase.CaseStatus.NO_ACTION
    locked.remarks = (reason or "").strip()
    updates = ["case_status", "remarks", "updated_at"]
    if updated_by is not None:
        locked.updated_by = updated_by
        updates.append("updated_by")
    locked.save(update_fields=updates)
    if cancel_tasks:
        _cancel_open_tasks(locked.prospect)
    return locked


@transaction.atomic
def resume_visitor_follow_up(
    case: VisitorFollowUpCase,
    *,
    updated_by=None,
) -> VisitorFollowUpCase:
    """Clear low priority and re-derive status from tasks."""
    locked = VisitorFollowUpCase.objects.select_for_update().get(pk=case.pk)
    if locked.case_status == VisitorFollowUpCase.CaseStatus.CLOSED:
        raise ValueError("Closed cases cannot be resumed.")
    locked.remarks = ""
    locked.case_status = VisitorFollowUpCase.CaseStatus.OPEN
    updates = ["remarks", "case_status", "updated_at"]
    if updated_by is not None:
        locked.updated_by = updated_by
        updates.append("updated_by")
    locked.save(update_fields=updates)
    synced = sync_visitor_case_status_from_tasks(
        locked.prospect, updated_by=updated_by
    )
    return synced or locked


@transaction.atomic
def mark_visitor_deceased(
    prospect: Prospect,
    *,
    updated_by=None,
    reason: str = "",
) -> Optional[VisitorFollowUpCase]:
    """
    Close the visitor case as Deceased.

    When a linked Person exists, set Person.status=DECEASED (with status change).
    """
    person = prospect.person
    if person is not None and (person.status or "") != "DECEASED":
        from apps.people.models import PersonStatusChange
        from apps.people.utils import record_person_status_change

        old_status = person.status or ""
        person.status = "DECEASED"
        person.save(update_fields=["status"])
        record_person_status_change(
            person=person,
            from_status=old_status,
            to_status="DECEASED",
            source=PersonStatusChange.Source.MANUAL,
            reason=(reason or "").strip() or "Marked deceased from My visitors.",
            changed_by=updated_by,
        )

    return close_visitor_follow_up_case(
        prospect,
        reason=VisitorFollowUpCase.ClosedReason.DECEASED,
        updated_by=updated_by,
    )


def close_visitor_follow_up_for_deceased_person(
    person,
    *,
    updated_by=None,
) -> None:
    """Close visitor cases when a Person is marked DECEASED elsewhere."""
    if person is None:
        return
    for prospect in Prospect.objects.filter(person=person):
        close_visitor_follow_up_case(
            prospect,
            reason=VisitorFollowUpCase.ClosedReason.DECEASED,
            updated_by=updated_by,
        )


@transaction.atomic
def ensure_prospect_for_person(person) -> Optional[Prospect]:
    """
    Return the Prospect linked to this Person, creating one when missing.

    Encoded VISITOR people (Person created first, no Prospect) need this so
    My visitors / inviter caseload can attach a case.
    """
    if person is None:
        return None

    existing = (
        Prospect.objects.filter(person=person)
        .order_by("id")
        .select_for_update()
        .first()
    )
    if existing is not None:
        updates = []
        # Person.inviter is authoritative for encoded visitors — keep Prospect in sync.
        if getattr(person, "inviter_id", None) and existing.invited_by_id != person.inviter_id:
            existing.invited_by_id = person.inviter_id
            updates.append("invited_by")
        if updates:
            existing.save(update_fields=updates + ["updated_at"])
        return existing

    from .services import encoded_visitor_prospect_defaults

    defaults = encoded_visitor_prospect_defaults(person)
    defaults["person"] = person
    if not defaults.get("last_activity_date"):
        defaults["last_activity_date"] = church_today()
    if not defaults.get("date_first_invited"):
        defaults["date_first_invited"] = defaults["last_activity_date"]
    return Prospect.objects.create(**defaults)


@transaction.atomic
def ensure_visitor_follow_up_for_person(
    person,
    *,
    updated_by=None,
) -> Optional[VisitorFollowUpCase]:
    """Ensure Prospect + open visitor follow-up case for an invited Person."""
    prospect = ensure_prospect_for_person(person)
    if prospect is None:
        return None
    return ensure_visitor_follow_up_case(prospect, updated_by=updated_by)


@transaction.atomic
def sync_visitor_follow_up_after_person_inviter_change(
    person,
    *,
    previous_inviter_id=None,
    updated_by=None,
) -> Optional[VisitorFollowUpCase]:
    """
    When Person.inviter is set/changed, open (or reassign) My visitors ownership.

    Only VISITOR people (not deceased) enter the caseload — members stay out.
    """
    if person is None or not getattr(person, "inviter_id", None):
        return None
    if (person.role or "") != "VISITOR":
        return None
    if (person.status or "") == "DECEASED":
        return None

    # Sync invited_by on every linked prospect (group + ungrouped).
    for prospect in Prospect.objects.filter(person=person).select_for_update():
        updates = []
        if prospect.invited_by_id != person.inviter_id:
            if (
                prospect.invited_by_id is None
                or prospect.invited_by_id == previous_inviter_id
                or previous_inviter_id is None
            ):
                prospect.invited_by_id = person.inviter_id
                updates.append("invited_by")
        if updates:
            prospect.save(update_fields=updates + ["updated_at"])

    case = ensure_visitor_follow_up_for_person(person, updated_by=updated_by)
    if case is None:
        return None

    assignee_id = person.inviter_id
    locked = (
        VisitorFollowUpCase.objects.select_for_update()
        .select_related("prospect")
        .filter(pk=case.pk)
        .first()
    )
    if locked is None:
        return case
    updates = []
    if locked.assigned_to_id is None or locked.assigned_to_id == previous_inviter_id:
        if locked.assigned_to_id != assignee_id:
            locked.assigned_to_id = assignee_id
            updates.append("assigned_to")
    if locked.prospect_id and locked.prospect.invited_by_id != assignee_id:
        if (
            locked.prospect.invited_by_id is None
            or locked.prospect.invited_by_id == previous_inviter_id
        ):
            locked.prospect.invited_by_id = assignee_id
            locked.prospect.save(update_fields=["invited_by", "updated_at"])
    if updated_by is not None:
        locked.updated_by = updated_by
        updates.append("updated_by")
    if updates:
        locked.save(update_fields=list(dict.fromkeys(updates + ["updated_at"])))
    return locked


def ensure_visitor_follow_up_for_inviter(inviter, *, updated_by=None) -> int:
    """
    Lazy backfill: open cases for VISITOR people this inviter owns.

    Returns how many ensure attempts ran (including already-open cases).
    """
    if inviter is None:
        return 0
    from apps.people.models import Person

    people = Person.objects.filter(inviter=inviter, role="VISITOR").exclude(
        status="DECEASED"
    )
    count = 0
    for person in people.iterator():
        ensure_visitor_follow_up_for_person(person, updated_by=updated_by)
        count += 1
    return count


def linked_person_blocks_visitor_follow_up(person) -> bool:
    """
    Linked Person must still be a living VISITOR.

    Unlinked prospects (person is None) stay eligible — they are invite-only
    rows that have not been encoded yet.
    """
    if person is None:
        return False
    if (person.status or "") == "DECEASED":
        return True
    return (person.role or "") != "VISITOR"


@transaction.atomic
def ensure_visitor_follow_up_case(
    prospect: Prospect,
    *,
    updated_by=None,
) -> Optional[VisitorFollowUpCase]:
    """
    Open (or reopen) a visitor follow-up case when the prospect is eligible.

    Not eligible when dropped off, linked person is not a VISITOR / is deceased,
    or the linked person has an active Lessons enrollment.
    """
    if prospect is None:
        return None
    if prospect.is_dropped_off:
        return None
    if prospect_has_active_lesson_enrollment(prospect):
        return None
    person = prospect.person
    if linked_person_blocks_visitor_follow_up(person):
        # Close leftover open cases (e.g. person promoted to Member).
        case = (
            VisitorFollowUpCase.objects.filter(prospect=prospect)
            .select_for_update()
            .first()
        )
        if (
            case is not None
            and case.case_status != VisitorFollowUpCase.CaseStatus.CLOSED
        ):
            close_visitor_follow_up_case(
                prospect,
                reason=VisitorFollowUpCase.ClosedReason.MANUAL,
                updated_by=updated_by,
            )
        return None

    case = VisitorFollowUpCase.objects.filter(prospect=prospect).select_for_update().first()
    assignee = prospect.invited_by
    if case is None:
        # One open My visitors case per Person — extra group prospects share it.
        if person is not None:
            existing_for_person = (
                VisitorFollowUpCase.objects.filter(
                    prospect__person=person,
                    case_status__in=OPEN_CASE_STATUSES,
                )
                .select_for_update()
                .order_by("-id")
                .first()
            )
            if existing_for_person is not None:
                return existing_for_person
        return VisitorFollowUpCase.objects.create(
            prospect=prospect,
            assigned_to=assignee,
            case_status=VisitorFollowUpCase.CaseStatus.OPEN,
            updated_by=updated_by,
        )

    updates = []
    if case.case_status == VisitorFollowUpCase.CaseStatus.CLOSED:
        # Deceased is final — do not reopen via ensure.
        if case.closed_reason == VisitorFollowUpCase.ClosedReason.DECEASED:
            return case
        case.case_status = VisitorFollowUpCase.CaseStatus.OPEN
        case.closed_reason = ""
        case.closed_at = None
        updates.extend(["case_status", "closed_reason", "closed_at"])
    if assignee is not None and case.assigned_to_id is None:
        case.assigned_to = assignee
        updates.append("assigned_to")
    if updated_by is not None:
        case.updated_by = updated_by
        updates.append("updated_by")
    if updates:
        case.save(update_fields=list(dict.fromkeys(updates + ["updated_at"])))
    return case


@transaction.atomic
def close_visitor_follow_up_case(
    prospect: Prospect,
    *,
    reason: str,
    updated_by=None,
    cancel_tasks: bool = True,
) -> Optional[VisitorFollowUpCase]:
    case = VisitorFollowUpCase.objects.filter(prospect=prospect).select_for_update().first()
    if case is None:
        return None
    if case.case_status == VisitorFollowUpCase.CaseStatus.CLOSED and case.closed_reason == reason:
        return case

    case.case_status = VisitorFollowUpCase.CaseStatus.CLOSED
    case.closed_reason = reason
    case.closed_at = timezone.now()
    updates = ["case_status", "closed_reason", "closed_at", "updated_at"]
    if updated_by is not None:
        case.updated_by = updated_by
        updates.append("updated_by")
    case.save(update_fields=updates)
    if cancel_tasks:
        _cancel_open_tasks(prospect)
    return case


def close_visitor_follow_up_for_enrollment(
    person,
    *,
    updated_by=None,
) -> None:
    """Close open visitor cases for prospects linked to this person (active enroll)."""
    if person is None:
        return
    from apps.lessons.models import LessonStudentEnrollment

    enrollment = LessonStudentEnrollment.objects.filter(
        student=person, is_active=True
    ).first()
    if enrollment is None:
        return

    for prospect in Prospect.objects.filter(person=person, is_dropped_off=False):
        close_visitor_follow_up_case(
            prospect,
            reason=VisitorFollowUpCase.ClosedReason.ENROLLED,
            updated_by=updated_by,
        )


def reopen_visitor_follow_up_for_inactive_enrollment(
    person,
    *,
    updated_by=None,
) -> None:
    """Reopen visitor cases when Lessons enrollment is no longer active."""
    if person is None:
        return
    from apps.lessons.models import LessonStudentEnrollment

    enrollment = LessonStudentEnrollment.objects.filter(student=person).first()
    if enrollment is not None and enrollment.is_active:
        return

    for prospect in Prospect.objects.filter(person=person, is_dropped_off=False):
        ensure_visitor_follow_up_case(prospect, updated_by=updated_by)


def close_visitor_follow_up_for_drop_off(
    prospect: Prospect,
    *,
    updated_by=None,
) -> Optional[VisitorFollowUpCase]:
    return close_visitor_follow_up_case(
        prospect,
        reason=VisitorFollowUpCase.ClosedReason.DROPPED_OFF,
        updated_by=updated_by,
    )


def touch_prospects_activity(prospects, activity_date: Optional[date] = None) -> None:
    activity_date = activity_date or church_today()
    for prospect in prospects:
        if prospect is None:
            continue
        touch_prospect_activity(prospect, activity_date)


def bump_activity_for_attended_people(
    people,
    activity_date: Optional[date] = None,
) -> None:
    """Bump last_activity on prospects linked to attended visitor Persons."""
    person_ids = [p.pk for p in people if p is not None and getattr(p, "pk", None)]
    if not person_ids:
        return
    activity_date = activity_date or church_today()
    prospects = Prospect.objects.filter(
        person_id__in=person_ids,
        is_dropped_off=False,
    )
    touch_prospects_activity(prospects, activity_date)


def bump_activity_from_report_links(
    *,
    invited_prospects=None,
    attended_people=None,
    activity_date: Optional[date] = None,
) -> None:
    """Warm prospects listed as invited or whose Person attended a report."""
    activity_date = activity_date or church_today()
    if invited_prospects:
        touch_prospects_activity(invited_prospects, activity_date)
    if attended_people:
        bump_activity_for_attended_people(attended_people, activity_date)


def needs_attention_cutoff(*, today: Optional[date] = None) -> date:
    today = today or church_today()
    return today - timedelta(days=NEEDS_ATTENTION_DAYS)


def visitor_follow_up_caseload_eligible_q():
    """Open-caseload rows: unlinked prospects or linked living VISITORs only."""
    from django.db.models import Q

    return Q(prospect__person__isnull=True) | Q(prospect__person__role="VISITOR")


def dedupe_visitor_follow_up_cases_by_person(queryset):
    """
    Keep one open caseload card per linked Person.

    Prefer the prospect that already has an evangelism_group, then newest case.
    Prospects without a person are left untouched.
    """
    from django.db.models import Case as DjCase, IntegerField, OuterRef, Q, Subquery, When

    preferred_id = (
        VisitorFollowUpCase.objects.filter(
            prospect__person_id=OuterRef("prospect__person_id")
        )
        .annotate(
            _pref=DjCase(
                When(prospect__evangelism_group_id__isnull=False, then=0),
                default=1,
                output_field=IntegerField(),
            )
        )
        .order_by("_pref", "-id")
        .values("id")[:1]
    )
    return queryset.filter(
        Q(prospect__person_id__isnull=True) | Q(id=Subquery(preferred_id))
    )
