# Generated manually for NCC roster ministries

from django.db import migrations, models
import django.db.models.functions.text


def seed_ncc_ministries(apps, schema_editor):
    Branch = apps.get_model("people", "Branch")
    Ministry = apps.get_model("ministries", "Ministry")
    for branch in Branch.objects.filter(is_active=True):
        Ministry.objects.get_or_create(
            code="NCC",
            branch=branch,
            defaults={
                "name": "NCC / Lessons",
                "scope": "BRANCH",
                "is_system": True,
                "category": "care",
                "activity_cadence": "weekly",
                "description": (
                    "New Converts Course / Lessons teachers roster for this branch."
                ),
                "is_active": True,
            },
        )


def unseed_ncc_ministries(apps, schema_editor):
    Ministry = apps.get_model("ministries", "Ministry")
    Ministry.objects.filter(code="NCC", is_system=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("ministries", "0003_ministry_scope"),
        ("people", "0021_people_automation_setting"),
    ]

    operations = [
        migrations.AddField(
            model_name="ministry",
            name="is_system",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "System ministries (e.g. NCC roster) are protected from normal "
                    "delete/code edits."
                ),
            ),
        ),
        migrations.AlterField(
            model_name="ministry",
            name="code",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Short shortcut name for the ministry (e.g. WORSHIP). "
                    "NCC is reserved for the per-branch Lessons teacher roster."
                ),
                max_length=50,
                null=True,
            ),
        ),
        migrations.AddConstraint(
            model_name="ministry",
            constraint=models.UniqueConstraint(
                condition=models.Q(("code__isnull", False), ("branch__isnull", False)),
                fields=("code", "branch"),
                name="ministries_code_branch_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="ministry",
            constraint=models.UniqueConstraint(
                condition=models.Q(("code__isnull", False), ("branch__isnull", True)),
                fields=("code",),
                name="ministries_code_national_uniq",
            ),
        ),
        migrations.RunPython(seed_ncc_ministries, unseed_ncc_ministries),
    ]
