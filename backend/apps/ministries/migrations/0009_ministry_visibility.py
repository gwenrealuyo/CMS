from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ministries", "0008_cluster_committee_system_ministry"),
    ]

    operations = [
        migrations.AddField(
            model_name="ministry",
            name="visibility",
            field=models.CharField(
                choices=[("DIRECTORY", "Directory"), ("INTERNAL", "Internal")],
                default="DIRECTORY",
                help_text=(
                    "DIRECTORY = shown in the ministries directory and search by "
                    "default. INTERNAL = hidden from the directory unless the "
                    "viewer is authorized and requests internal ministries."
                ),
                max_length=20,
            ),
        ),
    ]
