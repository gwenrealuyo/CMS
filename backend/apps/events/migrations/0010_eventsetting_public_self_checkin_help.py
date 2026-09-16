from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0009_eventtype_counts_as_activity"),
    ]

    operations = [
        migrations.AlterField(
            model_name="eventsetting",
            name="member_self_checkin_enabled",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "When enabled, members can check in online from the public Sunday "
                    "link (LAMP ID / member QR) without logging in. When disabled, only "
                    "admins and Events coordinators can use logged-in household and "
                    "guest self-check-in."
                ),
            ),
        ),
    ]
