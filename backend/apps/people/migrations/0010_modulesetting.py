from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_module_settings(apps, schema_editor):
    ModuleSetting = apps.get_model("people", "ModuleSetting")
    module_values = [
        "CLUSTER",
        "FINANCE",
        "EVANGELISM",
        "SUNDAY_SCHOOL",
        "LESSONS",
        "EVENTS",
        "MINISTRIES",
    ]
    for module in module_values:
        ModuleSetting.objects.get_or_create(
            module=module,
            defaults={"is_enabled": True},
        )


def unseed_module_settings(apps, schema_editor):
    ModuleSetting = apps.get_model("people", "ModuleSetting")
    ModuleSetting.objects.filter(
        module__in=[
            "CLUSTER",
            "FINANCE",
            "EVANGELISM",
            "SUNDAY_SCHOOL",
            "LESSONS",
            "EVENTS",
            "MINISTRIES",
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("people", "0009_person_date_first_invited"),
    ]

    operations = [
        migrations.CreateModel(
            name="ModuleSetting",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "module",
                    models.CharField(
                        choices=[
                            ("CLUSTER", "Cluster"),
                            ("FINANCE", "Finance"),
                            ("EVANGELISM", "Evangelism"),
                            ("SUNDAY_SCHOOL", "Sunday School"),
                            ("LESSONS", "Lessons"),
                            ("EVENTS", "Events"),
                            ("MINISTRIES", "Ministries"),
                        ],
                        max_length=50,
                        unique=True,
                    ),
                ),
                ("is_enabled", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_module_settings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Module Setting",
                "verbose_name_plural": "Module Settings",
                "ordering": ["module"],
            },
        ),
        migrations.RunPython(seed_module_settings, unseed_module_settings),
    ]
