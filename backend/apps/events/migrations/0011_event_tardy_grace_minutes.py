from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0010_eventsetting_public_self_checkin_help"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="tardy_grace_minutes",
            field=models.PositiveIntegerField(
                default=0,
                help_text=(
                    "Minutes after occurrence start before a check-in counts as "
                    "tardy. 0 means any check-in after start is tardy."
                ),
            ),
        ),
    ]
