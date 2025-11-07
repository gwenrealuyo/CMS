from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.people.models import Milestone

from .models import AttendanceRecord


def _build_milestone_defaults(record: AttendanceRecord) -> dict:
    event = record.event
    type_display = getattr(event, "get_type_display", None)
    event_type = (
        event.get_type_display() if callable(type_display) else event.type or ""
    )
    description_parts = [
        event_type,
        f"on {record.occurrence_date.isoformat()}",
    ]
    if event.location:
        description_parts.append(f"at {event.location}")
    description = " ".join(part for part in description_parts if part)

    return {
        "title": f"Attended {event.title}",
        "date": record.occurrence_date,
        "type": "EVENT_ATTENDANCE",
        "description": description,
    }


@receiver(post_save, sender=AttendanceRecord)
def manage_attendance_milestone(
    sender, instance: AttendanceRecord, created: bool, **kwargs
):
    is_present = (
        instance.status == AttendanceRecord.AttendanceStatus.PRESENT
    )

    if is_present:
        milestone = instance.milestone
        defaults = _build_milestone_defaults(instance)
        if milestone:
            updated = False
            for field, value in defaults.items():
                if getattr(milestone, field) != value:
                    setattr(milestone, field, value)
                    updated = True
            if updated:
                milestone.save(update_fields=list(defaults.keys()))
        else:
            milestone = Milestone.objects.create(
                user=instance.person,
                **defaults,
            )
            sender.objects.filter(pk=instance.pk).update(milestone=milestone)
    else:
        if instance.milestone_id:
            instance.milestone.delete()
            sender.objects.filter(pk=instance.pk).update(milestone=None)


@receiver(post_delete, sender=AttendanceRecord)
def delete_attendance_milestone(
    sender, instance: AttendanceRecord, **kwargs
):
    if instance.milestone_id:
        try:
            instance.milestone.delete()
        except Milestone.DoesNotExist:
            pass


