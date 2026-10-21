from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0025_demote_members_without_baptism"),
    ]

    operations = [
        migrations.AlterField(
            model_name="modulecoordinator",
            name="level",
            field=models.CharField(
                choices=[
                    ("COORDINATOR", "Coordinator"),
                    ("ASSISTANT_COORDINATOR", "Assistant Coordinator"),
                    ("SENIOR_COORDINATOR", "Senior Coordinator"),
                    ("TEACHER", "Teacher"),
                    ("BIBLE_SHARER", "Bible Sharer"),
                    ("REPORTER", "Reporter"),
                ],
                max_length=50,
            ),
        ),
    ]
