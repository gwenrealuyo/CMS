from django.db import migrations, models


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
    ]
