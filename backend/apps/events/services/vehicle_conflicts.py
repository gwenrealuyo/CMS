"""Vehicle schedule conflict checks."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from rest_framework.exceptions import ValidationError

from apps.events.models import VehicleBooking

SLOT_STATUSES = (
    VehicleBooking.BookingStatus.PENDING,
    VehicleBooking.BookingStatus.APPROVED,
)


def validate_vehicle_booking(
    *,
    vehicle_id: int,
    start: datetime,
    end: datetime,
    exclude_booking_id: Optional[int] = None,
) -> None:
    if start is None or end is None or end <= start:
        raise ValidationError({"end_date": "End must be after start."})

    qs = VehicleBooking.objects.filter(
        vehicle_id=vehicle_id,
        booking_status__in=SLOT_STATUSES,
        start_date__lt=end,
        end_date__gt=start,
    )
    if exclude_booking_id:
        qs = qs.exclude(pk=exclude_booking_id)
    other = qs.select_related("vehicle").first()
    if other:
        raise ValidationError(
            {
                "vehicle": (
                    f"{other.vehicle.name} is already booked "
                    f'("{other.title}"). Choose another time.'
                )
            }
        )
