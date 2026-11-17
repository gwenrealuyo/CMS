from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("lessons", "0008_lesson_follow_up_case"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="short_title",
            field=models.CharField(
                blank=True,
                help_text="Optional short label for compact UI (timeline, filters). Falls back to title when blank.",
                max_length=100,
            ),
        ),
        migrations.AlterModelOptions(
            name="lesson",
            options={
                "ordering": ["order", "title"],
                "verbose_name": "Lesson",
                "verbose_name_plural": "Lessons",
            },
        ),
        migrations.AlterModelOptions(
            name="lessonassignmentrequest",
            options={
                "ordering": ["-created_at"],
                "verbose_name": "Assignment Request",
                "verbose_name_plural": "Assignment Requests",
            },
        ),
        migrations.AlterModelOptions(
            name="lessonfollowupcase",
            options={
                "ordering": ["-updated_at", "-id"],
                "verbose_name": "Follow-up Case",
                "verbose_name_plural": "Follow-up Cases",
            },
        ),
        migrations.AlterModelOptions(
            name="lessonjourney",
            options={
                "verbose_name": "Journey Configuration",
                "verbose_name_plural": "Journey Configurations",
            },
        ),
        migrations.AlterModelOptions(
            name="lessonsessionreport",
            options={
                "ordering": ("-session_date", "-session_start", "-created_at"),
                "verbose_name": "Session Report",
                "verbose_name_plural": "Session Reports",
            },
        ),
        migrations.AlterModelOptions(
            name="lessonsettings",
            options={
                "verbose_name": "Setting",
                "verbose_name_plural": "Settings",
            },
        ),
        migrations.AlterModelOptions(
            name="lessonstudentenrollment",
            options={
                "ordering": ["student__last_name", "student__first_name"],
                "verbose_name": "Student Enrollment",
                "verbose_name_plural": "Student Enrollments",
            },
        ),
        migrations.AlterModelOptions(
            name="lessonteachertransfer",
            options={
                "ordering": ["-created_at"],
                "verbose_name": "Teacher Transfer",
                "verbose_name_plural": "Teacher Transfers",
            },
        ),
        migrations.AlterModelOptions(
            name="personlessonprogress",
            options={
                "ordering": [
                    "lesson__order",
                    "person__last_name",
                    "person__first_name",
                ],
                "verbose_name": "Person Progress",
                "verbose_name_plural": "Person Progress",
            },
        ),
    ]
