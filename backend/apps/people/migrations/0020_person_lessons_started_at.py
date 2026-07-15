from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0019_family_list_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="person",
            name="lessons_started_at",
            field=models.DateField(blank=True, null=True),
        ),
    ]
