"""
Ensure events_eventtype has color and is_system before people.0011 touches EventType.

events.0001 was consolidated in-place to include these columns. DBs that applied
an older 0001 (or fresh installs where state/DB must be aligned) are repaired here.
On a DB already created from the current 0001, this is a no-op.
"""

from django.db import migrations, models

from apps.events.models import hex_color_validator


def _eventtype_columns(schema_editor):
    with schema_editor.connection.cursor() as cursor:
        description = schema_editor.connection.introspection.get_table_description(
            cursor, "events_eventtype"
        )
    return {col.name for col in description}


def ensure_eventtype_color_columns(apps, schema_editor):
    from apps.events.event_type_seed import DEFAULT_EVENT_TYPE_COLOR, EVENT_TYPE_SEED

    EventType = apps.get_model("events", "EventType")
    existing = _eventtype_columns(schema_editor)

    if "color" not in existing:
        color_field = models.CharField(
            max_length=7,
            default="#9CA3AF",
            validators=[hex_color_validator],
        )
        color_field.set_attributes_from_name("color")
        schema_editor.add_field(EventType, color_field)

    if "is_system" not in existing:
        is_system_field = models.BooleanField(default=False)
        is_system_field.set_attributes_from_name("is_system")
        schema_editor.add_field(EventType, is_system_field)

    color_by_code = {code: color for code, _label, _sort, color in EVENT_TYPE_SEED}
    for event_type in EventType.objects.all():
        updates = {}
        if event_type.code in color_by_code:
            updates["color"] = color_by_code[event_type.code]
            updates["is_system"] = True
        elif not getattr(event_type, "color", None):
            updates["color"] = DEFAULT_EVENT_TYPE_COLOR
        if updates:
            for attr, value in updates.items():
                setattr(event_type, attr, value)
            event_type.save(update_fields=list(updates.keys()))


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0002_event_audit_fields"),
    ]

    operations = [
        migrations.RunPython(ensure_eventtype_color_columns, noop_reverse),
    ]
