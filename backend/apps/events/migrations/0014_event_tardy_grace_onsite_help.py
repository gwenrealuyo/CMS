from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0013_event_registration"),
    ]

    operations = [
        migrations.AlterField(
            model_name="event",
            name="tardy_grace_minutes",
            field=models.PositiveIntegerField(
                default=0,
                help_text=(
                    "Minutes after occurrence start before an onsite check-in "
                    "counts as tardy. Online check-ins are not marked tardy. "
                    "0 means any onsite check-in after start is tardy."
                ),
            ),
        ),
    ]
