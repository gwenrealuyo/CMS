"""Room-hold lead-time rules (24h advance / last-minute fallback)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.events.models import EventRoom
from core.datetime_utils import get_church_timezone

ROOM_HOLD_ADVANCE = timedelta(hours=24)
ROOM_HOLD_LAST_MINUTE_BUFFER = timedelta(minutes=15)


def church_now() -> datetime:
    return timezone.now().astimezone(get_church_timezone())


def validate_room_hold_lead_time(
    *,
    is_room_hold: bool,
    start: Optional[datetime],
    room: Optional[EventRoom],
) -> None:
    """Enforce 24h lead time for room holds, or last-minute fallback + 15m."""
    if not is_room_hold or start is None:
        return

    now = church_now()
    if timezone.is_naive(start):
        start_local = timezone.make_aware(start, get_church_timezone())
    else:
        start_local = start.astimezone(get_church_timezone())

    # Past / already-started holds are not subject to advance booking rules
    # (historical edits). Future holds must meet 24h or last-minute rules.
    if start_local <= now:
        return

    advance_deadline = now + ROOM_HOLD_ADVANCE
    if start_local >= advance_deadline:
        return

    min_start = now + ROOM_HOLD_LAST_MINUTE_BUFFER
    if start_local < min_start:
        raise ValidationError(
            {
                "start_date": (
                    "Last-minute room holds must start at least 15 minutes "
                    "from now. Contact church building administrators if you "
                    "still need a room."
                )
            }
        )

    branch_id = getattr(room, "branch_id", None) if room is not None else None
    fallback = None
    if branch_id is not None:
        fallback = (
            EventRoom.objects.filter(
                branch_id=branch_id,
                is_active=True,
                is_last_minute_fallback=True,
            )
            .order_by("sort_order", "name")
            .first()
        )

    if fallback is None:
        raise ValidationError(
            {
                "start_date": (
                    "Room holds must be booked at least 24 hours ahead. "
                    "No last-minute room is configured for this branch. "
                    "Contact church building administrators if you still "
                    "need a room."
                )
            }
        )

    if room is None or room.pk != fallback.pk:
        raise ValidationError(
            {
                "room": (
                    f"Room holds within 24 hours may only use the last-minute "
                    f'room ("{fallback.name}"). Contact church building '
                    "administrators if you need a different room."
                )
            }
        )
