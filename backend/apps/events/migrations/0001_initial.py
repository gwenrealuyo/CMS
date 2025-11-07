# Generated manually for apps.events

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
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
                    "type",
                    models.CharField(
                        choices=[
                            ("SUNDAY_SERVICE", "Sunday Service"),
                            ("BIBLE_STUDY", "Bible Study"),
                            ("PRAYER_MEETING", "Prayer Meeting"),
                            ("SPECIAL_EVENT", "Special Event"),
                        ],
                        max_length=50,
                    ),
                ),
                ("location", models.CharField(max_length=200)),
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
