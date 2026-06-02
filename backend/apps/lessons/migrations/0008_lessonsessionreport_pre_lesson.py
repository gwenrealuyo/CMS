from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lessons", "0007_backfill_lesson_enrollments"),
    ]

    operations = [
        migrations.AddField(
            model_name="lessonsessionreport",
            name="pre_lesson_kind",
            field=models.CharField(
                blank=True,
                choices=[
                    ("INTRODUCTION", "Introduction"),
                    ("OTHER", "Other"),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="lessonsessionreport",
            name="session_type",
            field=models.CharField(
                choices=[("LESSON", "Lesson"), ("PRE_LESSON", "Pre-lesson")],
                default="LESSON",
                max_length=20,
            ),
        ),
    ]
