from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("evangelism", "0009_prospect_invited_by_optional"),
    ]

    operations = [
        migrations.AddField(
            model_name="evangelismweeklyreport",
            name="cancelled",
            field=models.BooleanField(
                default=False,
                help_text="The group excused this week; no gathering was held.",
            ),
        ),
        migrations.AddField(
            model_name="evangelismweeklyreport",
            name="cancellation_reason",
            field=models.TextField(
                blank=True,
                help_text="Why the gathering was cancelled.",
            ),
        ),
        migrations.AlterField(
            model_name="evangelismweeklyreport",
            name="gathering_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("PHYSICAL", "Physical"),
                    ("ONLINE", "Online"),
                    ("HYBRID", "Hybrid"),
                ],
                help_text="How the gathering was held. Empty when the week was cancelled.",
                max_length=20,
                null=True,
            ),
        ),
    ]
