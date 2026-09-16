# Backfill EvangelismGroup.branch from cluster, then coordinator.

from django.db import migrations
from django.db.models import OuterRef, Subquery


def backfill_group_branch(apps, schema_editor):
    EvangelismGroup = apps.get_model("evangelism", "EvangelismGroup")
    Cluster = apps.get_model("clusters", "Cluster")
    Person = apps.get_model("people", "Person")

    cluster_branch = Subquery(
        Cluster.objects.filter(pk=OuterRef("cluster_id")).values("branch_id")[:1]
    )
    EvangelismGroup.objects.filter(
        branch_id__isnull=True, cluster_id__isnull=False
    ).update(branch_id=cluster_branch)

    coordinator_branch = Subquery(
        Person.objects.filter(pk=OuterRef("coordinator_id")).values("branch_id")[:1]
    )
    EvangelismGroup.objects.filter(
        branch_id__isnull=True, coordinator_id__isnull=False
    ).update(branch_id=coordinator_branch)


class Migration(migrations.Migration):

    dependencies = [
        ("evangelism", "0006_evangelismgroup_branch"),
    ]

    operations = [
        migrations.RunPython(backfill_group_branch, migrations.RunPython.noop),
    ]
