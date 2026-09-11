from django.db import migrations


def collapse_one_off_duplicates(apps, schema_editor):
    from apps.attendance.services import collapse_one_off_event_attendance
    from core.datetime_utils import church_calendar_date

    Event = apps.get_model("events", "Event")
    for event in Event.objects.filter(is_recurring=False).iterator():
        new_date = church_calendar_date(event.start_date)
        if new_date is None:
            continue
        collapse_one_off_event_attendance(event, new_date)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0001_initial"),
        ("events", "0005_event_expected_attendee_flags"),
    ]

    operations = [
        migrations.RunPython(collapse_one_off_duplicates, noop_reverse),
    ]
