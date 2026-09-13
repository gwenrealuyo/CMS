"""Helpers for event booking status (pending / approved / rejected)."""

from __future__ import annotations

from typing import Optional

from django.utils import timezone

from apps.events.models import Event
from apps.events.permissions import can_publish_events


def initial_booking_status(user) -> str:
    if can_publish_events(user):
        return Event.BookingStatus.APPROVED
    return Event.BookingStatus.PENDING


def schedule_fields_changed(instance: Event, attrs: dict) -> bool:
    start = attrs.get("start_date", instance.start_date)
    end = attrs.get("end_date", instance.end_date)
    room = attrs.get("room", instance.room) if "room" in attrs else instance.room
    room_id = getattr(room, "pk", room) if room is not None else None
    return (
        start != instance.start_date
        or end != instance.end_date
        or room_id != instance.room_id
    )


def booking_status_for_update(user, instance: Event, attrs: dict) -> Optional[str]:
    """Return a new booking_status, or None to leave it unchanged."""
    if can_publish_events(user):
        return None
    if instance.booking_status != Event.BookingStatus.APPROVED:
        return None
    if schedule_fields_changed(instance, attrs):
        return Event.BookingStatus.PENDING
    return None


def mark_approved(event: Event, user, *, note: str = "") -> Event:
    event.booking_status = Event.BookingStatus.APPROVED
    event.reviewed_by = user
    event.reviewed_at = timezone.now()
    event.review_note = note or ""
    event.updated_by = user
    event.save(
        update_fields=[
            "booking_status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "updated_by",
            "updated_at",
        ]
    )
    return event


def mark_rejected(event: Event, user, *, note: str = "") -> Event:
    event.booking_status = Event.BookingStatus.REJECTED
    event.reviewed_by = user
    event.reviewed_at = timezone.now()
    event.review_note = note or ""
    event.updated_by = user
    event.save(
        update_fields=[
            "booking_status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "updated_by",
            "updated_at",
        ]
    )
    return event
