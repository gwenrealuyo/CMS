"""Sunday Service online catch-up for a cluster's coordinator or reporter."""

from __future__ import annotations

from datetime import date, timedelta

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.attendance.models import AttendanceRecord
from apps.clusters.permissions import managed_cluster_ids_for_reports
from apps.events.models import AttendanceVenue, Event
from apps.events.services.registration import require_registration_for_checkin
from apps.events.services.self_checkin import occurrence_on_date
from apps.people.name_formatting import format_person_display_name
from core.datetime_utils import church_calendar_date, church_today

HOME_ALTAR_CODE = "HOME_ALTAR"
LOOKBACK_DAYS = 21
WINDOW_DAYS = 6


class SundayCatchupError(Exception):
    def __init__(self, detail, status_code=400):
        self.detail = detail
        self.status_code = status_code


def user_can_sunday_catchup(user, cluster) -> bool:
    """Admin, pastor, cluster senior, or this cluster's coordinator or reporter."""
    if not getattr(user, "is_authenticated", False) or cluster is None:
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    from apps.clusters.permissions import cluster_oversight_covers

    if cluster_oversight_covers(user, cluster):
        return True
    cluster_id = getattr(cluster, "id", None)
    if cluster_id is None:
        return False
    managed = {
        int(value)
        for value in managed_cluster_ids_for_reports(user)
        if value is not None
    }
    return int(cluster_id) in managed


def catchup_closes_on(occurrence_date: date) -> date:
    return occurrence_date + timedelta(days=WINDOW_DAYS)


def window_is_open(occurrence_date: date, today: date | None = None) -> bool:
    today = today or church_today()
    return occurrence_date <= today <= catchup_closes_on(occurrence_date)


def latest_sunday_occurrence(cluster, today: date | None = None):
    """
    Most recent approved Sunday Service occurrence on the cluster branch,
    on or before church today, within the lookback used to show a just-closed week.
    """
    today = today or church_today()
    if getattr(cluster, "branch_id", None) is None:
        return None
    start_day = today - timedelta(days=LOOKBACK_DAYS)
    events = list(
        Event.objects.filter(
            event_type_id="SUNDAY_SERVICE",
            booking_status=Event.BookingStatus.APPROVED,
            branch_id=cluster.branch_id,
        )
        .select_related("event_type", "branch")
        .order_by("start_date", "id")
    )
    best = None
    day = start_day
    while day <= today:
        for event in events:
            occurrence = occurrence_on_date(event, day)
            if occurrence is None:
                continue
            occurrence_date = church_calendar_date(occurrence.start)
            if occurrence_date is None or occurrence_date > today:
                continue
            candidate = (occurrence_date, occurrence.start, event.id, event)
            if best is None or candidate[:3] > best[:3]:
                best = candidate
        day += timedelta(days=1)
    if best is None:
        return None
    return {
        "event": best[3],
        "occurrence_date": best[0],
    }


def eligible_members(cluster):
    return (
        cluster.members.filter(role="MEMBER")
        .exclude(status="DECEASED")
        .order_by("last_name", "first_name", "id")
    )


def _person_name(person) -> str:
    return format_person_display_name(person) or person.username


def _roster_label(person) -> str:
    """Nickname only. First name when nickname is blank, since that means they go by it."""
    nickname = (getattr(person, "nickname", None) or "").strip()
    if nickname:
        return nickname
    first = (getattr(person, "first_name", None) or "").strip()
    if first:
        return first
    return (getattr(person, "username", None) or "").strip()


def _attendance_payload(record, *, window_open: bool) -> dict:
    recorded_by = record.recorded_by
    return {
        "id": record.id,
        "status": record.status,
        "attendance_mode": record.attendance_mode,
        "catchup_reason": record.catchup_reason or "",
        "catchup_note": record.catchup_note or "",
        "recorded_at": record.recorded_at,
        "recorded_by_name": _person_name(recorded_by) if recorded_by else None,
        "can_remove": bool(record.catchup_reason) and window_open,
    }


def build_sunday_catchup(cluster, today: date | None = None) -> dict:
    today = today or church_today()
    resolved = latest_sunday_occurrence(cluster, today)
    if resolved is None:
        return {
            "available": False,
            "window_open": False,
            "window_closes_on": None,
            "writes_enabled": False,
            "read_only_reason": None,
            "event": None,
            "occurrence_date": None,
            "roster": [],
        }

    event = resolved["event"]
    occurrence_date = resolved["occurrence_date"]
    open_now = window_is_open(occurrence_date, today)
    onsite_only = event.attendance_format == Event.AttendanceFormat.ONSITE_ONLY
    writes_enabled = open_now and not onsite_only
    if not open_now:
        read_only_reason = "window_closed"
    elif onsite_only:
        read_only_reason = "onsite_only"
    else:
        read_only_reason = None

    members = list(eligible_members(cluster))
    records = {
        record.person_id: record
        for record in AttendanceRecord.objects.filter(
            event=event,
            occurrence_date=occurrence_date,
            person_id__in=[person.id for person in members],
        ).select_related("recorded_by")
    }
    roster = []
    for person in members:
        record = records.get(person.id)
        roster.append(
            {
                "person_id": person.id,
                "name": _roster_label(person),
                "member_id": person.member_id or "",
                "status": person.status or "",
                "attendance": (
                    _attendance_payload(record, window_open=open_now)
                    if record is not None
                    else None
                ),
            }
        )
    return {
        "available": True,
        "window_open": open_now,
        "window_closes_on": catchup_closes_on(occurrence_date).isoformat(),
        "writes_enabled": writes_enabled,
        "read_only_reason": read_only_reason,
        "event": {
            "id": event.id,
            "title": event.title,
            "attendance_format": event.attendance_format,
        },
        "occurrence_date": occurrence_date.isoformat(),
        "roster": roster,
    }


def _require_open_sunday(cluster, today: date | None = None):
    today = today or church_today()
    resolved = latest_sunday_occurrence(cluster, today)
    if resolved is None:
        raise SundayCatchupError("No recent Sunday Service is available.")
    event = resolved["event"]
    occurrence_date = resolved["occurrence_date"]
    if not window_is_open(occurrence_date, today):
        raise SundayCatchupError("Catch-up is closed for this Sunday.")
    return event, occurrence_date


def _eligible_person(cluster, person_id):
    try:
        person_id = int(person_id)
    except (TypeError, ValueError) as exc:
        raise SundayCatchupError(
            {"person_id": "A cluster member is required."}
        ) from exc
    person = eligible_members(cluster).filter(pk=person_id).first()
    if person is None:
        raise SundayCatchupError(
            "Only living members of this cluster can be marked."
        )
    return person


def _clean_reason(reason, note):
    reason = (reason or "").strip()
    note = (note or "").strip()
    valid = {choice for choice, _label in AttendanceRecord.CatchupReason.choices}
    if reason not in valid:
        raise SundayCatchupError(
            {"reason": "Choose replay, timezone, forgot to check in, or other."}
        )
    if reason == AttendanceRecord.CatchupReason.OTHER:
        if not note:
            raise SundayCatchupError(
                {"note": "Describe the reason when you choose Other."}
            )
        if len(note) > 200:
            raise SundayCatchupError(
                {"note": "Keep the reason to 200 characters."}
            )
        return reason, note
    return reason, ""


def _online_venue(event):
    if event.attendance_format == Event.AttendanceFormat.ONSITE_ONLY:
        raise SundayCatchupError(
            "This Sunday Service is onsite only. Online catch-up is not available."
        )
    if event.attendance_format == Event.AttendanceFormat.ONLINE_ONLY:
        return None
    venue = AttendanceVenue.objects.filter(
        code=HOME_ALTAR_CODE, is_active=True
    ).first()
    if venue is None:
        raise SundayCatchupError("Home altar is not available for online catch-up.")
    return venue


def mark_sunday_catchup(cluster, user, person_id, reason, note=""):
    event, occurrence_date = _require_open_sunday(cluster)
    person = _eligible_person(cluster, person_id)
    reason, note = _clean_reason(reason, note)
    venue = _online_venue(event)

    existing = AttendanceRecord.objects.filter(
        event=event,
        person=person,
        occurrence_date=occurrence_date,
    ).first()
    if existing is not None:
        raise SundayCatchupError(
            "This person is already checked in.",
            status_code=409,
        )

    try:
        require_registration_for_checkin(
            event,
            person,
            AttendanceRecord.AttendanceMode.ONLINE,
            occurrence_date,
            is_admin_override=False,
        )
    except DRFValidationError as exc:
        raise SundayCatchupError(exc.detail) from exc

    record = AttendanceRecord(
        event=event,
        person=person,
        occurrence_date=occurrence_date,
        status=AttendanceRecord.AttendanceStatus.PRESENT,
        attendance_mode=AttendanceRecord.AttendanceMode.ONLINE,
        attendance_venue=venue,
        catchup_reason=reason,
        catchup_note=note,
        recorded_by=user,
    )
    record.full_clean()
    try:
        with transaction.atomic():
            record.save()
    except IntegrityError as exc:
        raise SundayCatchupError(
            "This person is already checked in.",
            status_code=409,
        ) from exc
    return record


def remove_sunday_catchup(cluster, attendance_id):
    event, occurrence_date = _require_open_sunday(cluster)
    try:
        attendance_id = int(attendance_id)
    except (TypeError, ValueError) as exc:
        raise SundayCatchupError(
            "Attendance record not found for this Sunday.",
            status_code=404,
        ) from exc
    record = (
        AttendanceRecord.objects.filter(
            pk=attendance_id,
            event=event,
            occurrence_date=occurrence_date,
        )
        .select_related("person")
        .first()
    )
    if record is None:
        raise SundayCatchupError(
            "Attendance record not found for this Sunday.",
            status_code=404,
        )
    if not record.catchup_reason:
        raise SundayCatchupError(
            "Only catch-up attendance can be removed here."
        )
    record.delete()
