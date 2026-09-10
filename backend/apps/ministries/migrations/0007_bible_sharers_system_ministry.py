# HQ Bible Sharers system ministry + backfill from existing assignments.

from django.db import migrations, models


def seed_bible_sharers_ministry(apps, schema_editor):
    from apps.ministries.bible_sharers import (
        backfill_bible_sharers_roster_from_assignments,
        ensure_bible_sharers_ministry,
    )

    ensure_bible_sharers_ministry()
    backfill_bible_sharers_roster_from_assignments()


def unseed_bible_sharers_ministry(apps, schema_editor):
    Ministry = apps.get_model("ministries", "Ministry")
    Ministry.objects.filter(code="BIBLE_SHARERS", is_system=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("ministries", "0006_backfill_ncc_lessons_teachers"),
        ("evangelism", "0003_prospect_inviter_cluster_help_text"),
        ("people", "0021_people_automation_setting"),
    ]

    operations = [
        migrations.AlterField(
            model_name="ministry",
            name="code",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Short shortcut name for the ministry (e.g. WORSHIP). "
                    "NCC is reserved for the per-branch Lessons teacher roster. "
                    "BIBLE_SHARERS is reserved for the headquarters Bible Sharers "
                    "roster."
                ),
                max_length=50,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="ministry",
            name="is_system",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "System ministries (e.g. NCC and Bible Sharers rosters) are "
                    "protected from normal delete/code edits."
                ),
            ),
        ),
        migrations.RunPython(seed_bible_sharers_ministry, unseed_bible_sharers_ministry),
    ]
