"""Paid event registration: capacity, pricing, check-in gates."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.events.models import (
    Event,
    EventRegistration,
    EventRegistrationPayment,
    EventRegistrationTier,
)

ZERO = Decimal("0.00")

ACTIVE_STATUSES = (
    EventRegistration.Status.PENDING_PAYMENT,
    EventRegistration.Status.CONFIRMED,
    EventRegistration.Status.WAITLISTED,
)

SEATS_HELD_STATUSES = (
    EventRegistration.Status.PENDING_PAYMENT,
    EventRegistration.Status.CONFIRMED,
)


def price_for_tier_mode(tier: EventRegistrationTier, mode: str) -> Decimal:
    if mode == EventRegistration.AttendanceMode.ONSITE:
        return Decimal(tier.onsite_price or ZERO)
    if mode == EventRegistration.AttendanceMode.ONLINE:
        return Decimal(tier.online_price or ZERO)
    raise ValidationError({"mode": "Invalid attendance mode."})


def mode_allowed_for_event(event: Event, mode: str) -> bool:
    if mode == EventRegistration.AttendanceMode.ONSITE:
        return event.allows_onsite_attendance
    if mode == EventRegistration.AttendanceMode.ONLINE:
        return event.allows_online_attendance
    return False


def seats_held_count(
    event: Event,
    mode: str,
    occurrence_date: Optional[date] = None,
) -> int:
    qs = EventRegistration.objects.filter(
        event=event,
        mode=mode,
        status__in=SEATS_HELD_STATUSES,
    )
    if occurrence_date is None:
        qs = qs.filter(occurrence_date__isnull=True)
    else:
        qs = qs.filter(occurrence_date=occurrence_date)
    return qs.count()


def capacity_for_mode(event: Event, mode: str) -> Optional[int]:
    if mode == EventRegistration.AttendanceMode.ONSITE:
        return event.onsite_capacity
    if mode == EventRegistration.AttendanceMode.ONLINE:
        return event.online_capacity
    return None


def assert_capacity_available(
    event: Event,
    mode: str,
    occurrence_date: Optional[date] = None,
    *,
    allow_override: bool = False,
) -> None:
    if allow_override:
        return
    capacity = capacity_for_mode(event, mode)
    if capacity is None:
        return
    held = seats_held_count(event, mode, occurrence_date)
    if held >= capacity:
        raise ValidationError(
            {
                "capacity": (
                    f"No {mode.lower()} seats remaining "
                    f"({held}/{capacity} held)."
                )
            }
        )


def person_may_register(
    event: Event,
    person,
    *,
    is_admin_caller: bool = False,
) -> bool:
    if is_admin_caller:
        return True
    if event.branch_id is None:
        return True
    if getattr(person, "branch_id", None) == event.branch_id:
        return True
    if event.allow_cross_branch_attendance:
        return True
    return False


def refresh_registration_payment_totals(
    registration: EventRegistration,
) -> EventRegistration:
    total = registration.payments.aggregate(total=Sum("amount"))["total"] or ZERO
    registration.amount_paid = total
    update_fields = ["amount_paid", "updated_at"]
    if (
        registration.status == EventRegistration.Status.PENDING_PAYMENT
        and registration.amount_paid >= registration.amount_due
    ):
        registration.status = EventRegistration.Status.CONFIRMED
        update_fields.append("status")
    registration.save(update_fields=update_fields)
    return registration


def _tier_offers_mode(tier: EventRegistrationTier, mode: str) -> bool:
    if mode == EventRegistration.AttendanceMode.ONSITE:
        return tier.onsite_offered
    if mode == EventRegistration.AttendanceMode.ONLINE:
        return tier.online_offered
    return False


def _assert_tier_available(tier: EventRegistrationTier) -> None:
    if not tier.is_active:
        raise ValidationError({"tier": "This registration tier is not active."})
    now = timezone.now()
    if tier.available_from and now < tier.available_from:
        raise ValidationError({"tier": "This registration tier is not yet available."})
    if tier.available_until and now > tier.available_until:
        raise ValidationError({"tier": "This registration tier is no longer available."})


@transaction.atomic
def create_registration(
    *,
    event: Event,
    person,
    mode: str,
    tier: Optional[EventRegistrationTier] = None,
    occurrence_date: Optional[date] = None,
    created_by=None,
    allow_capacity_override: bool = False,
    is_admin_caller: bool = False,
) -> EventRegistration:
    if not event.registration_enabled:
        raise ValidationError(
            {"event": "Registration is not enabled for this event."}
        )
    if not mode_allowed_for_event(event, mode):
        raise ValidationError(
            {"mode": "This attendance mode is not allowed for the event."}
        )
    if not person_may_register(event, person, is_admin_caller=is_admin_caller):
        raise ValidationError(
            {"person": "This person may not register for this event."}
        )

    active = EventRegistration.objects.filter(
        event=event,
        person=person,
        occurrence_date=occurrence_date,
    ).exclude(
        status__in=(
            EventRegistration.Status.CANCELLED,
            EventRegistration.Status.REFUNDED,
        )
    )
    if active.exists():
        raise ValidationError(
            {
                "person": (
                    "An active registration already exists for this person "
                    "and occurrence."
                )
            }
        )

    amount_due = ZERO
    if tier is not None:
        if tier.event_id != event.pk:
            raise ValidationError({"tier": "Tier does not belong to this event."})
        _assert_tier_available(tier)
        if not _tier_offers_mode(tier, mode):
            raise ValidationError(
                {"tier": "This tier does not offer the selected mode."}
            )
        amount_due = price_for_tier_mode(tier, mode)

    assert_capacity_available(
        event,
        mode,
        occurrence_date,
        allow_override=allow_capacity_override,
    )

    status = (
        EventRegistration.Status.CONFIRMED
        if amount_due <= ZERO
        else EventRegistration.Status.PENDING_PAYMENT
    )
    return EventRegistration.objects.create(
        event=event,
        person=person,
        occurrence_date=occurrence_date,
        mode=mode,
        tier=tier,
        status=status,
        amount_due=amount_due,
        amount_paid=ZERO,
        created_by=created_by,
    )


def has_confirmed_registration(
    event: Event,
    person,
    mode: str,
    occurrence_date: Optional[date] = None,
) -> bool:
    return EventRegistration.objects.filter(
        event=event,
        person=person,
        mode=mode,
        occurrence_date=occurrence_date,
        status=EventRegistration.Status.CONFIRMED,
    ).exists()


def require_registration_for_checkin(
    event: Event,
    person,
    mode: str,
    occurrence_date: Optional[date] = None,
    *,
    is_admin_override: bool = False,
) -> None:
    if is_admin_override:
        return
    if not getattr(event, "registration_enabled", False):
        return
    if mode == EventRegistration.AttendanceMode.ONSITE:
        if not event.onsite_registration_required:
            return
    elif mode == EventRegistration.AttendanceMode.ONLINE:
        if not event.online_registration_required:
            return
    else:
        return
    if has_confirmed_registration(event, person, mode, occurrence_date):
        return
    raise ValidationError(
        {
            "registration": (
                "A confirmed registration is required before check-in "
                f"for {mode.lower()} attendance."
            )
        }
    )


def record_payment(
    *,
    registration: EventRegistration,
    amount: Decimal,
    method: str,
    paid_at=None,
    recorded_by=None,
    note: str = "",
    provider: str = "",
    provider_ref: str = "",
) -> EventRegistrationPayment:
    if amount <= ZERO:
        raise ValidationError({"amount": "Payment amount must be greater than zero."})
    payment = EventRegistrationPayment.objects.create(
        registration=registration,
        amount=amount,
        method=method,
        paid_at=paid_at or timezone.now(),
        recorded_by=recorded_by,
        note=note or "",
        provider=provider or "",
        provider_ref=provider_ref or "",
    )
    refresh_registration_payment_totals(registration)
    return payment
