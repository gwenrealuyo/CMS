import django.core.validators
from django.db import migrations, models


def seed_attendance_venues(apps, schema_editor):
    AttendanceVenue = apps.get_model("events", "AttendanceVenue")
    seeds = [
        ("HOME_ALTAR", "Home altar", 10, "#0EA5E9"),
        ("CLUSTER_HOUSE", "Cluster house", 20, "#8B5CF6"),
    ]
    for code, label, sort_order, color in seeds:
        AttendanceVenue.objects.update_or_create(
            code=code,
            defaults={
                "label": label,
                "sort_order": sort_order,
                "color": color,
                "is_active": True,
                "is_system": True,
            },
        )


def unseed_attendance_venues(apps, schema_editor):
    AttendanceVenue = apps.get_model("events", "AttendanceVenue")
    AttendanceVenue.objects.filter(
        code__in=["HOME_ALTAR", "CLUSTER_HOUSE"], is_system=True
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0007_event_booking_status_event_review_note_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="AttendanceVenue",
            fields=[
                (
                    "code",
                    models.CharField(max_length=50, primary_key=True, serialize=False),
                ),
                ("label", models.CharField(max_length=100)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "color",
                    models.CharField(
                        default="#9CA3AF",
                        max_length=7,
                        validators=[
                            django.core.validators.RegexValidator(
                                message="Color must be a hex value like #RRGGBB.",
                                regex="^#[0-9A-Fa-f]{6}$",
                            )
                        ],
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("is_system", models.BooleanField(default=False)),
            ],
            options={
                "verbose_name": "Attendance Venue",
                "verbose_name_plural": "Attendance Venues",
                "ordering": ["sort_order", "code"],
            },
        ),
        migrations.RunPython(seed_attendance_venues, unseed_attendance_venues),
    ]
