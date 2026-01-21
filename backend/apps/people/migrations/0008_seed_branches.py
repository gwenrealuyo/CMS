# Generated manually

from django.db import migrations


def seed_branches(apps, schema_editor):
    Branch = apps.get_model("people", "Branch")

    branches_data = [
        {"name": "Muntinlupa", "code": "MUNTI", "is_headquarters": True},
        {"name": "Biñan", "code": "BIN"},
        {"name": "Pateros", "code": "PAT"},
        {"name": "Tarlac", "code": "TAR"},
        {"name": "Isabela", "code": "ISA"},
        {"name": "Canlubang", "code": "CAN"},
        {"name": "Dasmariñas", "code": "DAS"},
        {"name": "Bacolod", "code": "BAC"},
        {"name": "Granada", "code": "GRA"},
        {"name": "Cauayan", "code": "CAU"},
        {"name": "Hinigaran", "code": "HIN"},
    ]

    for branch_data in branches_data:
        Branch.objects.get_or_create(
            name=branch_data["name"],
            defaults={
                "code": branch_data.get("code", ""),
                "is_headquarters": branch_data.get("is_headquarters", False),
                "is_active": True,
            },
        )


def reverse_seed_branches(apps, schema_editor):
    Branch = apps.get_model("people", "Branch")
    branch_names = [
        "Muntinlupa",
        "Biñan",
        "Pateros",
        "Tarlac",
        "Isabela",
        "Canlubang",
        "Dasmariñas",
        "Bacolod",
        "Granada",
        "Cauayan",
        "Hinigaran",
    ]
    Branch.objects.filter(name__in=branch_names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0007_add_sunday_school_journey_type"),
    ]

    operations = [
        migrations.RunPython(seed_branches, reverse_seed_branches),
    ]
