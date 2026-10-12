import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0003_attendancerecord_mode_venue"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancerecord",
            name="recorded_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="attendance_records_recorded",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="attendancerecord",
            name="catchup_reason",
            field=models.CharField(
                blank=True,
                choices=[
                    ("REPLAY", "Watched the replay"),
                    ("TIMEZONE", "Another timezone"),
                    ("FORGOT_CHECKIN", "Forgot to check in"),
                    ("OTHER", "Other"),
                ],
                default="",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="attendancerecord",
            name="catchup_note",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
    ]
