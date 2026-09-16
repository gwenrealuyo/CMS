from django.db import migrations, models


def seed_meeting_type(apps, schema_editor):
    from apps.events.event_type_seed import EVENT_TYPE_SEED, NON_ACTIVITY_EVENT_TYPE_CODES

    EventType = apps.get_model("events", "EventType")
    seed_by_code = {
        code: (label, sort_order, color)
        for code, label, sort_order, color in EVENT_TYPE_SEED
    }
    for code in NON_ACTIVITY_EVENT_TYPE_CODES:
        label, sort_order, color = seed_by_code[code]
        EventType.objects.update_or_create(
            code=code,
            defaults={
                "label": label,
                "sort_order": sort_order,
                "color": color,
                "is_system": True,
                "counts_as_activity": False,
            },
        )


def unseed_meeting_type(apps, schema_editor):
    from apps.events.event_type_seed import NON_ACTIVITY_EVENT_TYPE_CODES

    EventType = apps.get_model("events", "EventType")
    EventType.objects.filter(
        code__in=NON_ACTIVITY_EVENT_TYPE_CODES,
        is_system=True,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0008_attendancevenue"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventtype",
            name="counts_as_activity",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "If false, this type is a room hold only and is not a "
                    "person's first activity attended."
                ),
            ),
        ),
        migrations.RunPython(seed_meeting_type, unseed_meeting_type),
    ]
