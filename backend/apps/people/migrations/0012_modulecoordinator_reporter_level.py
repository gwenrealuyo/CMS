from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0011_first_activity_attended_fk"),
    ]

    operations = [
        migrations.AlterField(
            model_name="modulecoordinator",
            name="level",
            field=models.CharField(
                choices=[
                    ("COORDINATOR", "Coordinator"),
                    ("SENIOR_COORDINATOR", "Senior Coordinator"),
                    ("TEACHER", "Teacher"),
                    ("BIBLE_SHARER", "Bible Sharer"),
                    ("REPORTER", "Reporter"),
                ],
                max_length=50,
            ),
        ),
    ]
