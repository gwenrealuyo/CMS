from django.db import migrations, models


def enable_sunday_service_self_checkin(apps, schema_editor):
    Event = apps.get_model("events", "Event")
    Event.objects.filter(event_type_id="SUNDAY_SERVICE").update(
        self_checkin_enabled=True
    )


def backfill_track_expected_attendees(apps, schema_editor):
    Event = apps.get_model("events", "Event")
    Event.objects.all().update(track_expected_attendees=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0011_event_tardy_grace_minutes"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="self_checkin_enabled",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When enabled, this approved activity event opens for online "
                    "member self-check-in (public LAMP ID and logged-in household) "
                    "on occurrence days. Meeting room holds cannot enable this."
                ),
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="attendance_format",
            field=models.CharField(
                choices=[
                    ("hybrid", "Hybrid"),
                    ("online_only", "Online only"),
                    ("onsite_only", "Onsite only"),
                ],
                default="hybrid",
                help_text=(
                    "Hybrid allows onsite and online (online requires a venue). "
                    "Online only is remote attendance without a venue. "
                    "Onsite only is door/station check-in only."
                ),
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="track_expected_attendees",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When enabled, check-in Total/Remaining and attendance reports use "
                    "the expected-include status flags (duty-style). When disabled, "
                    "the event is open headcount-only (no expected pool)."
                ),
            ),
        ),
        migrations.AddField(
            model_name="event",
            name="allow_cross_branch_attendance",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When enabled on a branch-hosted event, people from other branches "
                    "may check in and self-check-in. The expected pool (when tracking) "
                    "still uses only the event's branch. Ignored for church-wide events."
                ),
            ),
        ),
        migrations.RunPython(enable_sunday_service_self_checkin, noop_reverse),
        migrations.RunPython(backfill_track_expected_attendees, noop_reverse),
        migrations.AlterField(
            model_name="eventsetting",
            name="member_self_checkin_enabled",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When enabled, members can check in online from the public "
                    "self-check-in link (LAMP ID / member QR) without logging in, "
                    "for events that have self-check-in enabled. When disabled, "
                    "only admins and Events coordinators can use logged-in "
                    "household and guest self-check-in."
                ),
            ),
        ),
    ]
