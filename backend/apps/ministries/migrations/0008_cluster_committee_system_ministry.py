# Per-branch Cluster Committee system ministries.

from django.db import migrations, models


def seed_cluster_committee_ministries(apps, schema_editor):
    Branch = apps.get_model("people", "Branch")
    Ministry = apps.get_model("ministries", "Ministry")
    for branch in Branch.objects.filter(is_active=True):
        Ministry.objects.get_or_create(
            code="CLUSTER_COMMITTEE",
            branch=branch,
            defaults={
                "name": "Cluster Committee",
                "scope": "BRANCH",
                "is_system": True,
                "category": "care",
                "activity_cadence": "weekly",
                "description": (
                    "Cluster Committee roster for this branch. "
                    "Primary Coordinator and Support Coordinators share in-branch "
                    "Cluster oversight. All-branch Cluster oversight stays with "
                    "headquarters."
                ),
                "is_active": True,
            },
        )


def unseed_cluster_committee_ministries(apps, schema_editor):
    Ministry = apps.get_model("ministries", "Ministry")
    Ministry.objects.filter(code="CLUSTER_COMMITTEE", is_system=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("ministries", "0007_bible_sharers_system_ministry"),
        ("people", "0026_modulecoordinator_assistant_coordinator_level"),
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
                    "roster. CLUSTER_COMMITTEE is reserved for the per-branch "
                    "Cluster Committee roster."
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
                    "System ministries (e.g. NCC, Bible Sharers, and Cluster "
                    "Committee rosters) are protected from normal delete/code edits."
                ),
            ),
        ),
        migrations.RunPython(
            seed_cluster_committee_ministries,
            unseed_cluster_committee_ministries,
        ),
    ]
