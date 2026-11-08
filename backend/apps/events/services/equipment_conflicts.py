"""Equipment quantity conflict checks for overlapping bookings."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional

from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from apps.events.models import EquipmentBooking, EquipmentBookingItem, EquipmentType

SLOT_STATUSES = (
    EquipmentBooking.BookingStatus.PENDING,
    EquipmentBooking.BookingStatus.APPROVED,
)


def validate_equipment_quantities(
    *,
    branch_id: int,
    start: datetime,
    end: datetime,
    items: Iterable[dict],
    exclude_booking_id: Optional[int] = None,
) -> None:
    if start is None or end is None or end <= start:
        raise ValidationError(
            {"end_date": "End must be after start."}
        )

    requested: dict[int, int] = {}
    for item in items:
        eq = item.get("equipment_type")
        eq_id = getattr(eq, "pk", eq)
        qty = int(item.get("quantity") or 0)
        if not eq_id or qty < 1:
            raise ValidationError(
                {"items": "Each item needs an equipment type and quantity ≥ 1."}
            )
        requested[eq_id] = requested.get(eq_id, 0) + qty

    if not requested:
        raise ValidationError({"items": "Select at least one equipment item."})

    types = {
        row.id: row
        for row in EquipmentType.objects.filter(
            id__in=requested.keys(), branch_id=branch_id
        )
    }
    for eq_id, qty in requested.items():
        eq_type = types.get(eq_id)
        if eq_type is None:
            raise ValidationError(
                {"items": "Equipment must belong to the selected branch."}
            )
        if not eq_type.is_active:
            raise ValidationError(
                {"items": f'"{eq_type.name}" is not available.'}
            )
        overlapping = EquipmentBookingItem.objects.filter(
            equipment_type_id=eq_id,
            booking__booking_status__in=SLOT_STATUSES,
            booking__start_date__lt=end,
            booking__end_date__gt=start,
        )
        if exclude_booking_id:
            overlapping = overlapping.exclude(booking_id=exclude_booking_id)
        used = overlapping.aggregate(total=Sum("quantity"))["total"] or 0
        if used + qty > eq_type.quantity_available:
            raise ValidationError(
                {
                    "items": (
                        f'Not enough "{eq_type.name}" available for this window '
                        f"(need {qty}, {eq_type.quantity_available - used} left)."
                    )
                }
            )
