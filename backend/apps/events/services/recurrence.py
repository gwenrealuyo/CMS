from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List, Optional

from django.utils import timezone


MAX_OCCURRENCE_DAYS = 366


@dataclass
class Occurrence:
    """Represents a generated occurrence of an event."""

    event_id: int
    occurrence_id: str
    start: datetime
    end: datetime
    is_base_occurrence: bool

    def as_dict(self) -> Dict[str, str]:
        return {
            "event_id": self.event_id,
            "occurrence_id": self.occurrence_id,
            "start_date": self.start.isoformat(),
            "end_date": self.end.isoformat(),
            "is_base_occurrence": self.is_base_occurrence,
        }


def _ensure_timezone(dt: datetime) -> datetime:
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def clean_weekly_pattern(pattern: Optional[Dict], start: datetime) -> Dict:
    """Normalise the stored weekly recurrence pattern for an event."""

    if pattern is None:
        pattern = {}

    start = _ensure_timezone(start)
    base_date = start.date()

    frequency = pattern.get("frequency") or "weekly"
    if frequency != "weekly":
        frequency = "weekly"

    weekdays = pattern.get("weekdays") or []
    cleaned_weekdays = sorted(
        {int(day) for day in weekdays if isinstance(day, (int, str))}
    )
    cleaned_weekdays = [day for day in cleaned_weekdays if 0 <= day <= 6]
    if not cleaned_weekdays:
        cleaned_weekdays = [start.weekday()]

    through_candidate = _parse_date(pattern.get("through"))
    if through_candidate is None:
        through_candidate = date(base_date.year, 12, 31)

    max_through = base_date + timedelta(days=MAX_OCCURRENCE_DAYS)
    if through_candidate > max_through:
        through_candidate = max_through
    if through_candidate < base_date:
        through_candidate = base_date

    excluded_dates: Iterable[date] = []
    if pattern.get("excluded_dates"):
        raw = pattern.get("excluded_dates") or []
        parsed: List[date] = []
        for value in raw:
            parsed_value = _parse_date(str(value))
            if parsed_value and base_date <= parsed_value <= through_candidate:
                parsed.append(parsed_value)
        excluded_dates = sorted(set(parsed))

    return {
        "frequency": "weekly",
        "weekdays": cleaned_weekdays,
        "through": through_candidate.isoformat(),
        "excluded_dates": [d.isoformat() for d in excluded_dates],
    }


def generate_occurrences(
    event,
    pattern: Dict,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[Occurrence]:
    """Generate weekly occurrences for the provided event within the range."""

    occurrences: List[Occurrence] = []

    base_start = _ensure_timezone(event.start_date)
    base_end = _ensure_timezone(event.end_date)
    duration = base_end - base_start

    if not event.is_recurring:
        occurrence = Occurrence(
            event_id=event.id,
            occurrence_id=f"{event.id}:{base_start.isoformat()}",
            start=base_start,
            end=base_end,
            is_base_occurrence=True,
        )
        return [occurrence]

    through = _parse_date(pattern.get("through")) or base_start.date()
    weekdays = pattern.get("weekdays") or [base_start.weekday()]
    excluded = {
        _parse_date(value)
        for value in pattern.get("excluded_dates", [])
        if _parse_date(value)
    }

    start_filter = _ensure_timezone(start) if start else None
    end_filter = _ensure_timezone(end) if end else None

    max_end_date = min(
        through,
        base_start.date() + timedelta(days=MAX_OCCURRENCE_DAYS),
    )

    total_days = (max_end_date - base_start.date()).days

    for offset in range(total_days + 1):
        day = base_start.date() + timedelta(days=offset)

        if day.weekday() not in weekdays:
            continue
        if day in excluded:
            continue

        occurrence_start = base_start + timedelta(days=offset)
        occurrence_end = occurrence_start + duration

        if start_filter and occurrence_end < start_filter:
            continue
        if end_filter and occurrence_start > end_filter:
            continue

        occurrence = Occurrence(
            event_id=event.id,
            occurrence_id=f"{event.id}:{occurrence_start.isoformat()}",
            start=occurrence_start,
            end=occurrence_end,
            is_base_occurrence=offset == 0,
        )
        occurrences.append(occurrence)

    return occurrences
