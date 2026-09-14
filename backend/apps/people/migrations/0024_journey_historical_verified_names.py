from django.db import migrations, models

BAPTISM_PROMOTION_REASON = "Status set after water baptism."


def promote_baptized_visitors(apps, schema_editor):
    Person = apps.get_model("people", "Person")
    PersonStatusChange = apps.get_model("people", "PersonStatusChange")

    visitors = Person.objects.filter(
        role="VISITOR",
        water_baptism_date__isnull=False,
    )
    for person in visitors.iterator():
        old_status = person.status or ""
        person.role = "MEMBER"
        person.status = "ACTIVE"
        person.save(update_fields=["role", "status"])
        if old_status == "ACTIVE":
            continue
        PersonStatusChange.objects.create(
            person=person,
            from_status=old_status,
            to_status="ACTIVE",
            source="SYSTEM",
            reason=BAPTISM_PROMOTION_REASON,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0023_member_care_case"),
    ]

    operations = [
        migrations.AddField(
            model_name="journey",
            name="historical_verified_first_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="journey",
            name="historical_verified_last_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.RunPython(promote_baptized_visitors, noop_reverse),
    ]
