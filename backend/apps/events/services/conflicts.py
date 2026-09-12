"""Prevent duplicate Sunday Service sessions for the same branch."""

from __future__ import annotations

from datetime import date, datetime
from types import SimpleNamespace
from typing import Dict, Iterable, Optional, Set

from rest_framework.exceptions import ValidationError

from core.datetime_utils import church_calendar_date

from apps.events.models import Event
from apps.events.services.recurrence import (
    Occurrence,
    clean_weekly_pattern,
    generate_occurrences,
)

SUNDAY_SERVICE_TYPE = "SUNDAY_SERVICE"


def _event_type_code(event_type) -> Optional[str]:
    if event_type is None:
        return None
    return getattr(event_type, "pk", event_type)


def _branch_id(branch) -> Optional[int]:
    if branch is None:
        return None
    return getattr(branch, "pk", branch)


def _branches_conflict(left: Optional[int], right: Optional[int]) -> bool:
    """Church-wide events (no branch) conflict with every branch."""
    if left is None or right is None:
        return True
    return left == right


def _pattern_for(event) -> Dict:
    if not event.is_recurring:
        return {}
    return clean_weekly_pattern(event.recurrence_pattern, event.start_date)


def _as_occurrence_source(
    *,
    start: datetime,
    end: datetime,
    is_recurring: bool,
    recurrence_pattern: Optional[Dict],
    event_id: int = 0,
):
    return SimpleNamespace(
        id=event_id,
        start_date=start,
        end_date=end,
        is_recurring=is_recurring,
        recurrence_pattern=recurrence_pattern,
    )


def _occurrences_for(event, start=None, end=None) -> Iterable[Occurrence]:
    return generate_occurrences(event, _pattern_for(event), start=start, end=end)


def _should_ignore_occurrence(
    occurrence: Occurrence,
    *,
    event_id: int,
    ignore_event_id: Optional[int],
    ignore_dates: Optional[Set[date]],
    ignore_dates_gte: Optional[date],
) -> bool:
    if ignore_event_id is None or event_id != ignore_event_id:
        return False
    day = church_calendar_date(occurrence.start)
    if day is None:
        return False
    if ignore_dates and day in ignore_dates:
        return True
    if ignore_dates_gte is not None and day >= ignore_dates_gte:
        return True
    return False


def overlapping_sunday_service(
    *,
    start: datetime,
    end: datetime,
    is_recurring: bool,
    recurrence_pattern: Optional[Dict],
    branch_id: Optional[int],
    exclude_event_id: Optional[int] = None,
    ignore_event_id: Optional[int] = None,
    ignore_dates: Optional[Set[date]] = None,
    ignore_dates_gte: Optional[date] = None,
) -> Optional[tuple[Event, date]]:
    """Return the first Sunday Service that overlaps this session, if any."""

    candidate = _as_occurrence_source(
        start=start,
        end=end,
        is_recurring=is_recurring,
        recurrence_pattern=recurrence_pattern,
        event_id=exclude_event_id or 0,
    )
    candidate_occurrences = list(_occurrences_for(candidate))
    if not candidate_occurrences:
        return None

    window_start = min(occurrence.start for occurrence in candidate_occurrences)
    window_end = max(occurrence.end for occurrence in candidate_occurrences)

    others = Event.objects.filter(event_type_id=SUNDAY_SERVICE_TYPE)
    if exclude_event_id is not None:
        others = others.exclude(pk=exclude_event_id)

    for other in others.iterator():
        if not _branches_conflict(branch_id, other.branch_id):
            continue

        for other_occurrence in _occurrences_for(
            other, start=window_start, end=window_end
        ):
            if _should_ignore_occurrence(
                other_occurrence,
                event_id=other.pk,
                ignore_event_id=ignore_event_id,
                ignore_dates=ignore_dates,
                ignore_dates_gte=ignore_dates_gte,
            ):
                continue
            for candidate_occurrence in candidate_occurrences:
                if (
                    candidate_occurrence.start < other_occurrence.end
                    and other_occurrence.start < candidate_occurrence.end
                ):
                    overlap_day = church_calendar_date(candidate_occurrence.start)
                    return other, overlap_day or church_calendar_date(
                        other_occurrence.start
                    )
    return None


def validate_sunday_service_uniqueness(
    *,
    event_type,
    start: Optional[datetime],
    end: Optional[datetime],
    is_recurring: bool,
    recurrence_pattern: Optional[Dict],
    branch,
    exclude_event_id: Optional[int] = None,
    ignore_event_id: Optional[int] = None,
    ignore_dates: Optional[Set[date]] = None,
    ignore_dates_gte: Optional[date] = None,
) -> None:
    if _event_type_code(event_type) != SUNDAY_SERVICE_TYPE:
        return
    if start is None or end is None:
        return

    conflict = overlapping_sunday_service(
        start=start,
        end=end,
        is_recurring=is_recurring,
        recurrence_pattern=recurrence_pattern,
        branch_id=_branch_id(branch),
        exclude_event_id=exclude_event_id,
        ignore_event_id=ignore_event_id,
        ignore_dates=ignore_dates,
        ignore_dates_gte=ignore_dates_gte,
    )
    if not conflict:
        return

    _event, overlap_day = conflict
    day_label = overlap_day.isoformat() if overlap_day else "that day"
    raise ValidationError(
        {
            "start_date": (
                "A Sunday Service already exists for this branch at this time "
                f"on {day_label}. Edit the existing event instead of creating another."
            )
        }
    )
