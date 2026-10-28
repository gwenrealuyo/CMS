"""Helpers for event activity affiliation and first-activity credit."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from apps.events.models import Event, EventType


def first_activity_type_for_event(event: "Event") -> Optional["EventType"]:
    """
    Event type to set as a person's first activity from guest check-in.

    Room holds never count. Otherwise requires counts_toward_first_activity
    and an activity-capable event type.
    """
    if getattr(event, "is_room_hold", False):
        return None
    if not getattr(event, "counts_toward_first_activity", False):
        return None
    event_type = getattr(event, "event_type", None)
    if event_type is None or not getattr(event_type, "counts_as_activity", True):
        return None
    return event_type
