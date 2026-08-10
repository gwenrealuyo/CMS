"""Church-local calendar helpers for milestone DateFields.

Datetimes stay UTC in the DB (USE_TZ). When deriving a calendar day for people /
journeys / tallies, use CHURCH_TIME_ZONE — not UTC `.date()`.
"""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.utils import timezone


def get_church_timezone() -> ZoneInfo:
    tz_name = getattr(settings, "CHURCH_TIME_ZONE", None) or settings.TIME_ZONE
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def church_calendar_date(value: date | datetime | None) -> date | None:
    """
    Return the church calendar day for a date or datetime.

    Plain ``date`` values are returned unchanged (already a calendar day).
    Datetimes are converted to CHURCH_TIME_ZONE before taking ``.date()``.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, ZoneInfo("UTC"))
        return timezone.localtime(dt, get_church_timezone()).date()
    if isinstance(value, date):
        return value
    raise TypeError(f"Expected date or datetime, got {type(value)!r}")
