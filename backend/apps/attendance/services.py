from collections import defaultdict
from datetime import date

from django.db import transaction

from .models import AttendanceRecord


def collapse_one_off_event_attendance(event, occurrence_date: date) -> None:
    """Keep one attendance row per person on a one-off event.

    Prefers a row already on ``occurrence_date``, then sets every kept row to
    that date and deletes extras. Safe against unique (event, person, date).
    """
    event_id = getattr(event, "pk", event)
    records = list(
        AttendanceRecord.objects.filter(event_id=event_id).order_by(
            "recorded_at", "id"
        )
    )
    if not records:
        return

    by_person = defaultdict(list)
    for record in records:
        by_person[record.person_id].append(record)

    extra_ids = []
    to_update = []
    for group in by_person.values():
        keep = next(
            (record for record in group if record.occurrence_date == occurrence_date),
            group[0],
        )
        extra_ids.extend(record.pk for record in group if record.pk != keep.pk)
        if keep.occurrence_date != occurrence_date:
            keep.occurrence_date = occurrence_date
            to_update.append(keep)

    with transaction.atomic():
        if extra_ids:
            AttendanceRecord.objects.filter(pk__in=extra_ids).delete()
        if to_update:
            AttendanceRecord.objects.bulk_update(to_update, ["occurrence_date"])
