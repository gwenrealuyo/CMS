from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List, Optional

from django.utils import timezone

from core.datetime_utils import church_calendar_date


MAX_OCCURRENCE_DAYS = 366
ALLOWED_FREQUENCIES = {"weekly", "monthly"}
ALLOWED_MONTHLY_MODES = {"by_date", "by_weekday"}
ALLOWED_WEEK_OF_MONTH = {1, 2, 3, 4, -1}


class RecurrencePatternError(ValueError):
    """Raised when a recurrence pattern cannot be normalised."""


@dataclass
class Occurrence:
    """Represents a generated occurrence of an event."""

    event_id: int
    occurrence_id: str
    start: datetime
    end: datetime
    is_base_occurrence: bool

    def as_dict(self) -> Dict[str, str]:
        calendar_day = church_calendar_date(self.start)
        return {
            "event_id": self.event_id,
            "occurrence_id": self.occurrence_id,
            "start_date": self.start.isoformat(),
            "end_date": self.end.isoformat(),
            "occurrence_date": calendar_day.isoformat() if calendar_day else "",
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


def _is_last_weekday_of_month(day: date) -> bool:
    nxt = day + timedelta(days=7)
    return nxt.month != day.month


def _week_of_month_for(day: date) -> int:
    if _is_last_weekday_of_month(day):
        return -1
    return ((day.day - 1) // 7) + 1


def _clamp_month_day(year: int, month: int, day: int) -> date:
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(max(day, 1), last))


def _nth_weekday_of_month(
    year: int, month: int, weekday: int, week_of_month: int
) -> Optional[date]:
    first = date(year, month, 1)
    delta = (weekday - first.weekday()) % 7
    first_match = first + timedelta(days=delta)

    if week_of_month == -1:
        candidate = first_match
        while True:
            nxt = candidate + timedelta(days=7)
            if nxt.month != month:
                return candidate
            candidate = nxt

    candidate = first_match + timedelta(weeks=week_of_month - 1)
    if candidate.month != month:
        return None
    return candidate


def _iter_month_starts(from_day: date, through: date) -> Iterable[date]:
    year, month = from_day.year, from_day.month
    while date(year, month, 1) <= through:
        yield date(year, month, 1)
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1


def _clean_weekdays(raw_weekdays, base_date: date) -> List[int]:
    weekdays = raw_weekdays or []
    parsed: List[int] = []
    for day in weekdays:
        try:
            parsed.append(int(day))
        except (TypeError, ValueError):
            continue
    cleaned = sorted({day for day in parsed if 0 <= day <= 6})
    if not cleaned:
        cleaned = [base_date.weekday()]
    return cleaned


def _clean_through(raw_through, base_date: date) -> date:
    through_candidate = _parse_date(raw_through)
    if through_candidate is None:
        through_candidate = date(base_date.year, 12, 31)

    max_through = base_date + timedelta(days=MAX_OCCURRENCE_DAYS)
    if through_candidate > max_through:
        through_candidate = max_through
    if through_candidate < base_date:
        through_candidate = base_date
    return through_candidate


def _clean_excluded(raw_excluded, base_date: date, through: date) -> List[date]:
    parsed: List[date] = []
    for value in raw_excluded or []:
        parsed_value = _parse_date(str(value))
        if parsed_value and base_date <= parsed_value <= through:
            parsed.append(parsed_value)
    return sorted(set(parsed))


def clean_recurrence_pattern(pattern: Optional[Dict], start: datetime) -> Dict:
    """Normalise the stored recurrence pattern for an event."""

    if pattern is None:
        pattern = {}

    start = _ensure_timezone(start)
    base_date = church_calendar_date(start)

    frequency = str(pattern.get("frequency") or "weekly").strip().lower()
    if frequency not in ALLOWED_FREQUENCIES:
        raise RecurrencePatternError("Frequency must be weekly or monthly.")

    try:
        interval = int(pattern.get("interval") or 1)
    except (TypeError, ValueError):
        interval = 1
    if frequency != "weekly" or interval != 2:
        interval = 1

    weekdays = _clean_weekdays(pattern.get("weekdays"), base_date)
    through_candidate = _clean_through(pattern.get("through"), base_date)
    excluded_dates = _clean_excluded(
        pattern.get("excluded_dates"), base_date, through_candidate
    )

    cleaned: Dict = {
        "frequency": frequency,
        "interval": interval,
        "weekdays": weekdays,
        "through": through_candidate.isoformat(),
        "excluded_dates": [d.isoformat() for d in excluded_dates],
    }

    if frequency == "monthly":
        monthly_mode = str(pattern.get("monthly_mode") or "by_date").strip().lower()
        if monthly_mode not in ALLOWED_MONTHLY_MODES:
            monthly_mode = "by_date"

        try:
            month_day = int(pattern.get("month_day") or base_date.day)
        except (TypeError, ValueError):
            month_day = base_date.day
        month_day = min(max(month_day, 1), 31)

        try:
            week_of_month = int(pattern.get("week_of_month"))
        except (TypeError, ValueError):
            week_of_month = _week_of_month_for(base_date)
        if week_of_month not in ALLOWED_WEEK_OF_MONTH:
            week_of_month = _week_of_month_for(base_date)

        cleaned["monthly_mode"] = monthly_mode
        cleaned["month_day"] = month_day
        cleaned["week_of_month"] = week_of_month

    return cleaned


def clean_weekly_pattern(pattern: Optional[Dict], start: datetime) -> Dict:
    """Backward-compatible alias for clean_recurrence_pattern."""

    return clean_recurrence_pattern(pattern, start)


def _build_occurrence(
    event_id: int,
    base_start: datetime,
    duration,
    base_day: date,
    day: date,
    start_filter: Optional[datetime],
    end_filter: Optional[datetime],
) -> Optional[Occurrence]:
    offset = (day - base_day).days
    occurrence_start = base_start + timedelta(days=offset)
    occurrence_end = occurrence_start + duration

    if start_filter and occurrence_end < start_filter:
        return None
    if end_filter and occurrence_start > end_filter:
        return None

    return Occurrence(
        event_id=event_id,
        occurrence_id=f"{event_id}:{occurrence_start.isoformat()}",
        start=occurrence_start,
        end=occurrence_end,
        is_base_occurrence=day == base_day,
    )


def _weekly_days(
    base_day: date,
    max_end_date: date,
    weekdays: List[int],
    interval: int,
) -> List[date]:
    days: List[date] = []
    total_days = (max_end_date - base_day).days
    for offset in range(total_days + 1):
        day = base_day + timedelta(days=offset)
        if day.weekday() not in weekdays:
            continue
        weeks_from_start = (day - base_day).days // 7
        if weeks_from_start % interval != 0:
            continue
        days.append(day)
    return days


def _monthly_days(base_day: date, max_end_date: date, pattern: Dict) -> List[date]:
    monthly_mode = pattern.get("monthly_mode") or "by_date"
    month_day = int(pattern.get("month_day") or base_day.day)
    weekdays = pattern.get("weekdays") or [base_day.weekday()]
    weekday = weekdays[0]
    try:
        week_of_month = int(pattern.get("week_of_month"))
    except (TypeError, ValueError):
        week_of_month = _week_of_month_for(base_day)
    if week_of_month not in ALLOWED_WEEK_OF_MONTH:
        week_of_month = _week_of_month_for(base_day)

    days: List[date] = []
    for month_start in _iter_month_starts(base_day, max_end_date):
        if monthly_mode == "by_weekday":
            candidate = _nth_weekday_of_month(
                month_start.year, month_start.month, weekday, week_of_month
            )
        else:
            candidate = _clamp_month_day(
                month_start.year, month_start.month, month_day
            )

        if candidate is None:
            continue
        if candidate < base_day or candidate > max_end_date:
            continue
        days.append(candidate)
    return days


def generate_occurrences(
    event,
    pattern: Dict,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[Occurrence]:
    """Generate occurrences for the provided event within the range."""

    base_start = _ensure_timezone(event.start_date)
    base_end = _ensure_timezone(event.end_date)
    duration = base_end - base_start

    if not event.is_recurring:
        return [
            Occurrence(
                event_id=event.id,
                occurrence_id=f"{event.id}:{base_start.isoformat()}",
                start=base_start,
                end=base_end,
                is_base_occurrence=True,
            )
        ]

    through = _parse_date(pattern.get("through")) or church_calendar_date(base_start)
    excluded = {
        _parse_date(value)
        for value in pattern.get("excluded_dates", [])
        if _parse_date(value)
    }

    start_filter = _ensure_timezone(start) if start else None
    end_filter = _ensure_timezone(end) if end else None

    base_day = church_calendar_date(base_start)
    max_end_date = min(through, base_day + timedelta(days=MAX_OCCURRENCE_DAYS))

    frequency = str(pattern.get("frequency") or "weekly").strip().lower()
    try:
        interval = int(pattern.get("interval") or 1)
    except (TypeError, ValueError):
        interval = 1
    if interval < 1:
        interval = 1

    # If end_date was saved as the series through date, duration spans months
    # and every weekly occurrence falsely covers mid-week days.
    end_day = church_calendar_date(base_end)
    if (
        frequency == "weekly"
        and end_day is not None
        and through is not None
        and end_day >= through
        and duration.days >= 7
    ):
        same_day_end = base_start.replace(
            hour=base_end.hour,
            minute=base_end.minute,
            second=base_end.second,
            microsecond=base_end.microsecond,
        )
        if same_day_end > base_start:
            duration = same_day_end - base_start
        else:
            duration = timedelta(hours=2)

    weekdays = pattern.get("weekdays") or [base_day.weekday()]

    if frequency == "monthly":
        candidate_days = _monthly_days(base_day, max_end_date, pattern)
    else:
        candidate_days = _weekly_days(base_day, max_end_date, weekdays, interval)

    occurrences: List[Occurrence] = []
    for day in candidate_days:
        if day in excluded:
            continue
        occurrence = _build_occurrence(
            event.id,
            base_start,
            duration,
            base_day,
            day,
            start_filter,
            end_filter,
        )
        if occurrence:
            occurrences.append(occurrence)

    return occurrences
