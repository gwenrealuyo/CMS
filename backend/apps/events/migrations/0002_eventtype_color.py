from django.db import migrations, models

import apps.events.models


def seed_event_type_colors(apps, schema_editor):
    from apps.events.event_type_seed import EVENT_TYPE_SEED

    EventType = apps.get_model("events", "EventType")
    color_by_code = {code: color for code, _label, _sort, color in EVENT_TYPE_SEED}

    for event_type in EventType.objects.all():
        event_type.is_system = event_type.code in color_by_code
        if event_type.code in color_by_code:
            event_type.color = color_by_code[event_type.code]
        event_type.save(update_fields=["color", "is_system"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventtype",
            name="color",
            field=models.CharField(
                default="#9CA3AF",
                max_length=7,
                validators=[apps.events.models.hex_color_validator],
            ),
        ),
        migrations.AddField(
            model_name="eventtype",
            name="is_system",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(seed_event_type_colors, noop_reverse),
    ]
