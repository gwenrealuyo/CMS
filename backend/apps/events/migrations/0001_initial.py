# Consolidated apps.events schema (EventType + seeded rows + Event.event_type FK).
#
# Rollback before replacing this file (disposable DB recommended):
#   migrate evangelism zero → sunday_school zero → attendance zero → events zero
#   (or migrate zero). Clear stale django_migrations rows if migration files changed.
#
# If you ever applied the removed migration `0002_legacy_fix_event_event_type`,
# delete its row from django_migrations so Django does not expect a missing file:
#   DELETE FROM django_migrations WHERE app='events' AND name LIKE '0002%%';

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_event_types(apps, schema_editor):
    from apps.events.event_type_seed import EVENT_TYPE_SEED

    EventType = apps.get_model("events", "EventType")
    for code, label, sort_order in EVENT_TYPE_SEED:
        EventType.objects.update_or_create(
            code=code,
            defaults={"label": label, "sort_order": sort_order},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("people", "0006_branch_alter_journey_type_delete_cluster_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="EventType",
            fields=[
                ("code", models.CharField(max_length=50, primary_key=True, serialize=False)),
                ("label", models.CharField(max_length=100)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
            ],
            options={
                "ordering": ["sort_order", "code"],
            },
        ),
        migrations.RunPython(seed_event_types, noop_reverse),
        migrations.CreateModel(
            name="Event",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("start_date", models.DateTimeField()),
                ("end_date", models.DateTimeField()),
                (
                    "event_type",
                    models.ForeignKey(
                        default="SUNDAY_SERVICE",
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="events",
                        to="events.eventtype",
                    ),
                ),
                ("location", models.CharField(max_length=200)),
                (
                    "branch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="events",
                        to="people.branch",
                    ),
                ),
                ("is_recurring", models.BooleanField(default=False)),
                (
                    "recurrence_pattern",
                    models.JSONField(blank=True, null=True),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.AddField(
            model_name="event",
            name="volunteers",
            field=models.ManyToManyField(
                related_name="volunteered_events", to=settings.AUTH_USER_MODEL
            ),
        ),
    ]
