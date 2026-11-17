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
    ]
