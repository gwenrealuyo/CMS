from django.db import migrations, models
import django.db.models.deletion


def ensure_event_types_and_prepare_values(apps, schema_editor):
    """Ensure EventType rows exist for legacy codes; clear empty strings to NULL."""
    Person = apps.get_model("people", "Person")
    EventType = apps.get_model("events", "EventType")

    codes = (
        Person.objects.exclude(first_activity_attended="")
        .exclude(first_activity_attended__isnull=True)
        .values_list("first_activity_attended", flat=True)
        .distinct()
    )
    for code in codes:
        EventType.objects.get_or_create(
            code=code,
            defaults={"label": code.replace("_", " ").title(), "sort_order": 999},
        )

    Person.objects.filter(first_activity_attended="").update(
        first_activity_attended=None
    )


def copy_legacy_to_fk(apps, schema_editor):
    Person = apps.get_model("people", "Person")
    for person in Person.objects.exclude(first_activity_attended_legacy__isnull=True):
        person.first_activity_attended_new_id = person.first_activity_attended_legacy
        person.save(update_fields=["first_activity_attended_new"])


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0010_modulesetting"),
        ("events", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="person",
            name="first_activity_attended",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.RunPython(
            ensure_event_types_and_prepare_values, migrations.RunPython.noop
        ),
        migrations.RenameField(
            model_name="person",
            old_name="first_activity_attended",
            new_name="first_activity_attended_legacy",
        ),
        migrations.AddField(
            model_name="person",
            name="first_activity_attended_new",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="first_activity_people",
                to="events.eventtype",
            ),
        ),
        migrations.RunPython(copy_legacy_to_fk, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="person",
            name="first_activity_attended_legacy",
        ),
        migrations.RenameField(
            model_name="person",
            old_name="first_activity_attended_new",
            new_name="first_activity_attended",
        ),
    ]
