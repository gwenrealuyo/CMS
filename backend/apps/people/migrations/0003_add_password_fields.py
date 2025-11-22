# Generated manually for Person password fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0002_family_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="person",
            name="must_change_password",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="person",
            name="first_login",
            field=models.BooleanField(default=True),
        ),
    ]
