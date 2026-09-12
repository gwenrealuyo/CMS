"""Sunday Service self check-in: resolve today's session and household."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Iterable, List, Optional, Sequence, Tuple

from django.db.models import Q, QuerySet

from apps.attendance.models import AttendanceRecord
from apps.events.models import Event
from apps.events.services.recurrence import Occurrence, generate_occurrences
from apps.people.models import ModuleCoordinator, Person
from apps.people.name_formatting import format_person_display_name
from core.datetime_utils import church_calendar_date, church_today, get_church_timezone


SUNDAY_SERVICE_TYPE = "SUNDAY_SERVICE"

AGE_GROUP_LABELS = {
    "ADULT": "Adult (18+)",
    "YOUTH": "Youth (13–17)",
    "CHILD": "Child (under 13)",
}

REASON_NO_SERVICE = "no_service_today"
REASON_NOT_FOR_BRANCH = "no_service_for_branch"


def user_has_events_write(user) -> bool:
    """Match HasModuleAccess('EVENTS', 'write') without a request/view."""
    from apps.authentication.permissions import is_module_enabled

    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) == "ADMIN":
        return True
    if not is_module_enabled(ModuleCoordinator.ModuleType.EVENTS):
        return False
    if getattr(user, "role", None) == "PASTOR":
        return True

    assignments = user.module_coordinator_assignments.filter(
        module=ModuleCoordinator.ModuleType.EVENTS
    )
    if assignments.filter(
        level__in=(
            ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
    ).exists():
        return True
    if assignments.filter(
        level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
        resource_id__isnull=False,
    ).exists():
        return True
    return False


def user_can_encode_self_checkin_visitors(user) -> bool:
    from apps.people.coordinator_assignment_validation import user_can_add_visitor

    return user_can_add_visitor(user) or user_has_events_write(user)


def _ensure_aware(dt: datetime) -> datetime:
    from django.utils import timezone

    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def occurrence_on_date(event: Event, today: date) -> Optional[Occurrence]:
    """Return the occurrence of ``event`` that falls on church-local ``today``."""
    if not event.is_recurring:
        start = _ensure_aware(event.start_date)
        end = _ensure_aware(event.end_date)
        if church_calendar_date(start) == today:
            return Occurrence(
                event_id=event.id,
                occurrence_id=f"{event.id}:{start.isoformat()}",
                start=start,
                end=end,
                is_base_occurrence=True,
            )
        return None

    tz = get_church_timezone()
    window_start = datetime.combine(today, time.min, tzinfo=tz)
    window_end = datetime.combine(today, time.max, tzinfo=tz)
    pattern = event.recurrence_pattern or {}
    for occ in generate_occurrences(event, pattern, start=window_start, end=window_end):
        if church_calendar_date(occ.start) == today:
            return occ
    return None


def find_todays_sunday_services(
    today: Optional[date] = None,
) -> List[Tuple[Event, Occurrence]]:
    today = today or church_today()
    events = (
        Event.objects.filter(event_type_id=SUNDAY_SERVICE_TYPE)
        .select_related("event_type", "branch", "room")
        .order_by("start_date", "id")
    )
    matches: List[Tuple[Event, Occurrence]] = []
    for event in events:
        occ = occurrence_on_date(event, today)
        if occ is not None:
            matches.append((event, occ))
    return matches


def _is_visible_to_user(event: Event, user) -> bool:
    if event.branch_id is None:
        return True
    if user.can_see_all_branches():
        return True
    return event.branch_id == getattr(user, "branch_id", None)


def select_matches_for_user(
    matches: Sequence[Tuple[Event, Occurrence]],
    user,
    event_id: Optional[int] = None,
) -> Tuple[List[Tuple[Event, Occurrence]], Optional[str]]:
    visible = [(event, occ) for event, occ in matches if _is_visible_to_user(event, user)]
    if not visible:
        return [], REASON_NO_SERVICE if not matches else REASON_NOT_FOR_BRANCH

    if event_id is not None:
        chosen = [(event, occ) for event, occ in visible if event.pk == event_id]
        return chosen, None if chosen else "invalid_event"

    if user.can_see_all_branches():
        return list(visible), None

    branch_id = getattr(user, "branch_id", None)
    if branch_id:
        at_branch = [
            (event, occ) for event, occ in visible if event.branch_id == branch_id
        ]
        if at_branch:
            return at_branch, None
    return list(visible), None


@dataclass
class ResolvedSession:
    available: bool
    reason: Optional[str]
    needs_selection: bool
    event: Optional[Event]
    occurrence: Optional[Occurrence]
    occurrence_date: Optional[date]
    options: List[Tuple[Event, Occurrence]]
    can_encode_visitors: bool


def resolve_session(
    user,
    event_id: Optional[int] = None,
    today: Optional[date] = None,
) -> ResolvedSession:
    today = today or church_today()
    can_encode = user_can_encode_self_checkin_visitors(user)
    matches = find_todays_sunday_services(today)
    selected, reason = select_matches_for_user(matches, user, event_id=event_id)

    if reason == "invalid_event":
        return ResolvedSession(
            available=False,
            reason="invalid_event",
            needs_selection=False,
            event=None,
            occurrence=None,
            occurrence_date=today,
            options=[],
            can_encode_visitors=can_encode,
        )

    if not selected:
        return ResolvedSession(
            available=False,
            reason=reason or REASON_NO_SERVICE,
            needs_selection=False,
            event=None,
            occurrence=None,
            occurrence_date=today,
            options=[],
            can_encode_visitors=can_encode,
        )

    if event_id is None and len(selected) > 1:
        return ResolvedSession(
            available=True,
            reason=None,
            needs_selection=True,
            event=None,
            occurrence=None,
            occurrence_date=today,
            options=list(selected),
            can_encode_visitors=can_encode,
        )

    event, occ = selected[0]
    return ResolvedSession(
        available=True,
        reason=None,
        needs_selection=False,
        event=event,
        occurrence=occ,
        occurrence_date=today,
        options=list(selected),
        can_encode_visitors=can_encode,
    )


def household_queryset(user) -> QuerySet[Person]:
    family_ids = user.families.filter(is_active=True).values_list("id", flat=True)
    others = (
        Person.objects.filter(families__id__in=family_ids)
        .exclude(pk=user.pk)
        .exclude(role="ADMIN")
        .exclude(status="DECEASED")
    )
    return (
        Person.objects.filter(Q(pk=user.pk) | Q(pk__in=others))
        .distinct()
        .order_by("last_name", "first_name", "id")
    )


def household_person_ids(user) -> set[int]:
    return set(household_queryset(user).values_list("id", flat=True))


def undoable_person_ids(user, event: Event) -> set[int]:
    allowed = household_person_ids(user)
    if user_can_encode_self_checkin_visitors(user):
        allowed.update(
            visitor_scope_for_event(user, event).values_list("pk", flat=True)
        )
    return allowed


def checked_in_person_ids(event: Event, occurrence_date: date) -> set[int]:
    return set(
        AttendanceRecord.objects.filter(
            event=event, occurrence_date=occurrence_date
        ).values_list("person_id", flat=True)
    )


def people_scope_for_event(user, event: Event) -> QuerySet[Person]:
    qs = Person.objects.exclude(role="ADMIN").exclude(status="DECEASED")
    if event.branch_id:
        return qs.filter(branch_id=event.branch_id)
    if user.can_see_all_branches():
        return qs
    if getattr(user, "branch_id", None):
        return qs.filter(branch_id=user.branch_id)
    return qs.none()


def visitor_scope_for_event(user, event: Event) -> QuerySet[Person]:
    return people_scope_for_event(user, event).filter(role="VISITOR")


def invited_prospect_branch_q(branch_id: int) -> Q:
    return (
        Q(inviter_cluster__branch_id=branch_id)
        | Q(endorsed_cluster__branch_id=branch_id)
        | Q(person__branch_id=branch_id)
        | Q(invited_by__branch_id=branch_id)
        | Q(evangelism_group__cluster__branch_id=branch_id)
    )


def invited_prospect_scope_for_event(event: Event):
    from apps.evangelism.models import Prospect

    qs = Prospect.objects.filter(
        is_dropped_off=False,
        pipeline_stage=Prospect.PipelineStage.INVITED,
        person__isnull=True,
    )
    if event.branch_id:
        qs = qs.filter(invited_prospect_branch_q(event.branch_id))
    return qs.select_related("invited_by").distinct()


def search_prospects_by_name(qs, query: str, limit: int = 15):
    trimmed = (query or "").strip()
    if len(trimmed) < 2:
        return qs.none()
    name_filter = (
        Q(first_name__icontains=trimmed)
        | Q(last_name__icontains=trimmed)
        | Q(middle_name__icontains=trimmed)
        | Q(facebook_name__icontains=trimmed)
    )
    parts = trimmed.split()
    if len(parts) >= 2:
        name_filter |= Q(
            first_name__icontains=parts[0], last_name__icontains=parts[-1]
        )
    return qs.filter(name_filter).order_by("last_name", "first_name", "id")[:limit]


def exact_prospect_name_matches(first_name: str, last_name: str, event: Event):
    return invited_prospect_scope_for_event(event).filter(
        first_name__iexact=(first_name or "").strip(),
        last_name__iexact=(last_name or "").strip(),
    ).order_by("id")


def search_people_by_name(qs: QuerySet[Person], query: str, limit: int = 15):
    trimmed = (query or "").strip()
    if len(trimmed) < 2:
        return qs.none()
    name_filter = (
        Q(first_name__icontains=trimmed)
        | Q(last_name__icontains=trimmed)
        | Q(nickname__icontains=trimmed)
        | Q(middle_name__icontains=trimmed)
    )
    parts = trimmed.split()
    if len(parts) >= 2:
        name_filter |= Q(
            first_name__icontains=parts[0], last_name__icontains=parts[-1]
        )
    return qs.filter(name_filter).order_by("last_name", "first_name", "id")[:limit]


def exact_name_matches(
    first_name: str, last_name: str, branch_id: Optional[int]
) -> QuerySet[Person]:
    qs = Person.objects.exclude(role="ADMIN").filter(
        first_name__iexact=(first_name or "").strip(),
        last_name__iexact=(last_name or "").strip(),
    )
    if branch_id is not None:
        qs = qs.filter(branch_id=branch_id)
    return qs.order_by("id")


def serialize_event_option(event: Event, occ: Occurrence) -> dict:
    return {
        "event_id": event.pk,
        "title": event.title,
        "branch": event.branch_id,
        "branch_name": event.branch.name if event.branch_id else None,
        "location": event.location or "",
        "room_name": event.room.name if event.room_id else None,
        "start": occ.start.isoformat(),
        "end": occ.end.isoformat(),
        "occurrence_date": church_calendar_date(occ.start).isoformat()
        if church_calendar_date(occ.start)
        else None,
    }


def serialize_session_event(event: Event, occ: Occurrence) -> dict:
    payload = serialize_event_option(event, occ)
    payload["id"] = event.pk
    payload["type"] = event.event_type_id
    payload["type_display"] = event.event_type.label if event.event_type_id else ""
    return payload


def person_full_name(person: Person) -> str:
    parts = [person.first_name or ""]
    if person.nickname:
        parts.append(f'"{person.nickname}"')
    if person.middle_name:
        parts.append(person.middle_name)
    if person.last_name:
        parts.append(person.last_name)
    if person.suffix:
        parts.append(person.suffix)
    name = " ".join(p for p in parts if p).strip()
    return name or person.username or f"Person #{person.pk}"


def serialize_person_slim(
    person: Person,
    *,
    already_checked_in: bool,
    is_self: bool = False,
    request=None,
) -> dict:
    photo = None
    if person.photo:
        url = person.photo.url
        photo = request.build_absolute_uri(url) if request else url
    return {
        "id": person.pk,
        "first_name": person.first_name or "",
        "last_name": person.last_name or "",
        "nickname": person.nickname or "",
        "full_name": person_full_name(person),
        "role": person.role,
        "status": person.status or "",
        "member_id": person.member_id or "",
        "photo": photo,
        "is_self": is_self,
        "already_checked_in": already_checked_in,
        "kind": "visitor",
    }


def serialize_prospect_match(prospect) -> dict:
    invited_by = getattr(prospect, "invited_by", None)
    return {
        "id": prospect.pk,
        "prospect_id": prospect.pk,
        "first_name": prospect.first_name or "",
        "last_name": prospect.last_name or "",
        "nickname": "",
        "full_name": prospect.display_name,
        "role": "INVITED",
        "status": "INVITED",
        "member_id": "",
        "photo": None,
        "is_self": False,
        "already_checked_in": False,
        "kind": "prospect",
        "invited_by_name": (
            format_person_display_name(invited_by) if invited_by else ""
        ),
    }


def parse_event_id(raw) -> Optional[int]:
    if raw in (None, "", False):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def parse_person_ids(raw: Iterable) -> List[int]:
    ids: List[int] = []
    seen = set()
    for value in raw or []:
        try:
            pk = int(value)
        except (TypeError, ValueError):
            continue
        if pk not in seen:
            seen.add(pk)
            ids.append(pk)
    return ids
