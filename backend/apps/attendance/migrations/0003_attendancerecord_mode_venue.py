import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0002_collapse_one_off_attendance"),
        ("events", "0008_attendancevenue"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancerecord",
            name="attendance_mode",
            field=models.CharField(
                choices=[("ONSITE", "Onsite"), ("ONLINE", "Online")],
                default="ONSITE",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="attendancerecord",
            name="attendance_venue",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="attendance_records",
                to="events.attendancevenue",
            ),
        ),
    ]
