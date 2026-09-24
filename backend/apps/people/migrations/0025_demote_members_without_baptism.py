from django.db import migrations

DEMOTION_REASON = "Status set because Member requires water baptism date."


def demote_members_without_baptism(apps, schema_editor):
    Person = apps.get_model("people", "Person")
    PersonStatusChange = apps.get_model("people", "PersonStatusChange")

    members = Person.objects.filter(
        role="MEMBER",
        water_baptism_date__isnull=True,
    )
    for person in members.iterator():
        old_status = person.status or ""
        person.role = "VISITOR"
        if old_status == "DECEASED":
            new_status = "DECEASED"
        elif person.date_first_attended:
            new_status = "ONGOING"
        else:
            new_status = "NO_RESPONSE"
        person.status = new_status
        person.save(update_fields=["role", "status"])
        if old_status == new_status:
            continue
        PersonStatusChange.objects.create(
            person=person,
            from_status=old_status,
            to_status=new_status,
            source="SYSTEM",
            reason=DEMOTION_REASON,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0024_journey_historical_verified_names"),
    ]

    operations = [
        migrations.RunPython(demote_members_without_baptism, noop_reverse),
    ]
