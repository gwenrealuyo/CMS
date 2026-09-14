# Recalculate Each 1 Reach 1 targets using counted roster (ACTIVE / SEMIACTIVE / INACTIVE).

from django.db import migrations


def forwards(apps, schema_editor):
    from apps.evangelism.services import recalculate_each1reach1_goal_targets

    recalculate_each1reach1_goal_targets()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("evangelism", "0003_prospect_inviter_cluster_help_text"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
