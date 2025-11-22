from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("people", "0002_family_notes"),
    ]

    operations = [
        migrations.CreateModel(
            name="Lesson",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(help_text="Stable identifier used to group lesson versions together.", max_length=50)),
                ("version_label", models.CharField(default="v1", help_text="Short label that indicates the lesson revision (e.g., v1, v2).", max_length=20)),
                ("title", models.CharField(max_length=200)),
                ("summary", models.TextField(blank=True)),
                ("outline", models.TextField(blank=True, help_text="Optional structured outline or talking points for the lesson.")),
                ("order", models.PositiveSmallIntegerField(help_text="Display order within the conversion journey.")),
                ("is_latest", models.BooleanField(default=True, help_text="Marks the latest published version for this lesson code.")),
                ("is_active", models.BooleanField(default=True, help_text="Allows disabling a lesson version without deleting it.")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["order", "title"],
            },
        ),
        migrations.CreateModel(
            name="LessonJourney",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("journey_type", models.CharField(choices=[("LESSON", "Lesson"), ("BAPTISM", "Baptism"), ("SPIRIT", "Spirit"), ("CLUSTER", "Cluster"), ("NOTE", "Note"), ("EVENT_ATTENDANCE", "Event Attendance")], default="LESSON", help_text="Journey type to create when the lesson is completed.", max_length=20)),
                ("title_template", models.CharField(blank=True, help_text="Optional override for the journey title (defaults to lesson title).", max_length=100)),
                ("note_template", models.TextField(blank=True, help_text="Optional note body saved on the journey when the lesson is completed.")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("lesson", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="journey_config", to="lessons.lesson")),
            ],
            options={
                "verbose_name": "Lesson Journey Configuration",
                "verbose_name_plural": "Lesson Journey Configurations",
            },
        ),
        migrations.CreateModel(
            name="PersonLessonProgress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("ASSIGNED", "Assigned"), ("IN_PROGRESS", "In progress"), ("COMPLETED", "Completed"), ("SKIPPED", "Skipped")], default="ASSIGNED", max_length=20)),
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assigned_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lessons_assigned", to="people.person")),
                ("completed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lessons_verified", to="people.person")),
                ("lesson", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="progress_records", to="lessons.lesson")),
                ("journey", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lesson_progress", to="people.journey")),
                ("person", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lesson_progress", to="people.person")),
            ],
            options={
                "ordering": ["lesson__order", "person__last_name", "person__first_name"],
            },
        ),
        migrations.AddConstraint(
            model_name="lesson",
            constraint=models.UniqueConstraint(fields=("code", "version_label"), name="unique_lesson_code_version"),
        ),
        migrations.AddConstraint(
            model_name="lesson",
            constraint=models.UniqueConstraint(condition=models.Q(("is_latest", True)), fields=("code",), name="unique_latest_lesson_per_code"),
        ),
        migrations.AlterUniqueTogether(
            name="personlessonprogress",
            unique_together={("person", "lesson")},
        ),
    ]




