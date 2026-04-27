from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0006_branch_alter_journey_type_delete_cluster_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="journey",
            name="type",
            field=models.CharField(
                max_length=20,
                choices=[
                    ("LESSON", "Lesson"),
                    ("BAPTISM", "Baptism"),
                    ("SPIRIT", "Spirit"),
                    ("CLUSTER", "Cluster"),
                    ("NOTE", "Note"),
                    ("EVENT_ATTENDANCE", "Event Attendance"),
                    ("SUNDAY_SCHOOL", "Sunday School"),
                    ("MINISTRY", "Ministry"),
                    ("BRANCH_TRANSFER", "Branch Transfer"),
                ],
            ),
        ),
        migrations.AddField(
            model_name="journey",
            name="updated_at",
            field=models.DateTimeField(
                auto_now=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
    ]
