# Backfill NCC / Lessons roster members from existing Lessons teachers.

from django.db import migrations


def forwards(apps, schema_editor):
    from apps.ministries.ncc import backfill_ncc_roster_from_lessons_teachers

    backfill_ncc_roster_from_lessons_teachers()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("ministries", "0005_remove_ministry_ministries_code_branch_uniq_and_more"),
        ("lessons", "0003_nullable_teacher_historical_names"),
        ("people", "0021_people_automation_setting"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
