from django.db import migrations, models


STATUS_CHOICES = [
    ("ACTIVE", "Active"),
    ("SEMIACTIVE", "Semiactive"),
    ("INACTIVE", "Inactive"),
    ("DORMANT", "Dormant"),
    ("FALLAWAY", "Fall Away"),
    ("DECEASED", "Deceased"),
    ("ONGOING", "Ongoing"),
    ("NO_RESPONSE", "No Response"),
]


def remap_visitor_statuses(apps, schema_editor):
    Person = apps.get_model("people", "Person")
    Person.objects.filter(status__in=["INVITED", "ATTENDED"]).update(status="ONGOING")


def noop_reverse(apps, schema_editor):
    # Irreversible: cannot distinguish former INVITED vs ATTENDED after remap.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0016_person_country_max_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="person",
            name="maiden_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.RunPython(remap_visitor_statuses, noop_reverse),
        migrations.AlterField(
            model_name="person",
            name="status",
            field=models.CharField(
                blank=True,
                choices=STATUS_CHOICES,
                max_length=20,
            ),
        ),
    ]
