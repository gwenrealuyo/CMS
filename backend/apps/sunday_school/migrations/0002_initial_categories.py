# Generated manually

from django.db import migrations


def create_initial_categories(apps, schema_editor):
    SundaySchoolCategory = apps.get_model("sunday_school", "SundaySchoolCategory")

    categories = [
        {"name": "Kids Primary", "min_age": 3, "max_age": 7, "order": 1},
        {"name": "Kids Intermediate", "min_age": 8, "max_age": 11, "order": 2},
        {"name": "Teens", "min_age": 12, "max_age": 16, "order": 3},
        {"name": "Young Adults", "min_age": 17, "max_age": 22, "order": 4},
        {"name": "Young Professionals", "min_age": 23, "max_age": None, "order": 5},
    ]

    for cat_data in categories:
        SundaySchoolCategory.objects.get_or_create(
            name=cat_data["name"],
            defaults={
                "min_age": cat_data["min_age"],
                "max_age": cat_data["max_age"],
                "order": cat_data["order"],
                "is_active": True,
            },
        )


def reverse_initial_categories(apps, schema_editor):
    SundaySchoolCategory = apps.get_model("sunday_school", "SundaySchoolCategory")
    category_names = [
        "Kids Primary",
        "Kids Intermediate",
        "Teens",
        "Young Adults",
        "Young Professionals",
    ]
    SundaySchoolCategory.objects.filter(name__in=category_names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("sunday_school", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_initial_categories, reverse_initial_categories),
    ]

