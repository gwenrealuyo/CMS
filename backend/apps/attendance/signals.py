from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.people.models import Journey

from .models import AttendanceRecord


def _build_journey_defaults(record: AttendanceRecord) -> dict:
    event = record.event
    type_display = getattr(event, "get_type_display", None)
    event_type = (
        event.get_type_display() if callable(type_display) else event.type or ""
    )
    if event.type == "SUNDAY_SCHOOL":
        session = getattr(event, "sunday_school_session", None)
        class_name = event.title
        lesson_title = ""
        if session:
            class_name = session.sunday_school_class.name
            lesson_title = session.lesson_title
        description_parts = [
            "Sunday School",
            f"on {record.occurrence_date.isoformat()}",
        ]
        if lesson_title:
            description_parts.append(f"lesson {lesson_title}")
        if event.location:
            description_parts.append(f"at {event.location}")
        description = " ".join(part for part in description_parts if part)
        return {
            "title": f"Attended Sunday School - {class_name}",
            "date": record.occurrence_date,
            "type": "SUNDAY_SCHOOL",
            "description": description,
        }
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
def manage_attendance_journey(
    sender, instance: AttendanceRecord, created: bool, **kwargs
):
    is_present = (
        instance.status == AttendanceRecord.AttendanceStatus.PRESENT
    )

    if is_present:
        journey = instance.journey
        defaults = _build_journey_defaults(instance)
        if journey:
            updated = False
            for field, value in defaults.items():
                if getattr(journey, field) != value:
                    setattr(journey, field, value)
                    updated = True
            if updated:
                journey.save(update_fields=list(defaults.keys()))
        else:
            journey = Journey.objects.create(
                user=instance.person,
                **defaults,
            )
            sender.objects.filter(pk=instance.pk).update(journey=journey)
    else:
        if instance.journey_id:
            instance.journey.delete()
            sender.objects.filter(pk=instance.pk).update(journey=None)


@receiver(post_delete, sender=AttendanceRecord)
def delete_attendance_journey(
    sender, instance: AttendanceRecord, **kwargs
):
    if instance.journey_id:
        try:
            instance.journey.delete()
        except Journey.DoesNotExist:
            pass


