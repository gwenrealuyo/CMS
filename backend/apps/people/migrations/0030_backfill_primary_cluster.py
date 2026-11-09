# Backfill Person.primary_cluster from current memberships.

from django.db import migrations


def backfill_primary(apps, schema_editor):
    Person = apps.get_model("people", "Person")
    Through = apps.get_model("clusters", "Cluster").members.through

    memberships_by_person = {}
    for person_id, cluster_id in Through.objects.values_list(
        "person_id", "cluster_id"
    ).iterator():
        memberships_by_person.setdefault(person_id, []).append(cluster_id)

    to_update = []
    for person in Person.objects.all().only("id", "primary_cluster_id").iterator():
        ids = sorted(memberships_by_person.get(person.id, []))
        if not ids:
            if person.primary_cluster_id is not None:
                person.primary_cluster_id = None
                to_update.append(person)
            continue
        target = ids[0] if len(ids) == 1 else min(ids)
        if person.primary_cluster_id != target:
            person.primary_cluster_id = target
            to_update.append(person)

    if to_update:
        Person.objects.bulk_update(to_update, ["primary_cluster_id"], batch_size=500)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0029_primary_cluster_and_transfer_request"),
        ("clusters", "0012_primary_cluster_and_transfer_request"),
    ]

    operations = [
        migrations.RunPython(backfill_primary, noop_reverse),
    ]
