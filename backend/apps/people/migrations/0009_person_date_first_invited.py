from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0008_seed_branches"),
    ]

    operations = [
        migrations.AddField(
            model_name="person",
            name="date_first_invited",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="person",
            name="lessons_finished_at",
            field=models.DateField(blank=True, null=True),
        ),
    ]
