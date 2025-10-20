# Revised migration to include Family.notes and new Person fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("people", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="family",
            name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="person",
            name="water_baptism_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="person",
            name="spirit_baptism_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="person",
            name="first_activity_attended",
            field=models.CharField(
                blank=True,
                max_length=50,
                choices=[
                    ("CLUSTER_BS_EVANGELISM", "Cluster/BS Evangelism"),
                    ("CLUSTERING", "Clustering"),
                    ("SUNDAY_SERVICE", "Sunday Service"),
                    ("DOCTRINAL_CLASS", "Doctrinal Class"),
                    ("PRAYER_MEETING", "Prayer Meeting"),
                    ("CYM_CLASS", "CYM Class"),
                    ("MINI_WORSHIP", "Mini Worship"),
                    ("GOLDEN_WARRIORS", "Golden Warriors"),
                    ("CAMPING", "Camping"),
                    ("AWTA", "AWTA"),
                    ("CONFERENCE", "Conference"),
                    ("CONCERT_CRUSADE", "Concert/Crusade"),
                ],
            ),
        ),
        migrations.AlterField(
            model_name="person",
            name="status",
            field=models.CharField(
                blank=True,
                max_length=20,
                choices=[
                    ("ACTIVE", "Active"),
                    ("SEMIACTIVE", "Semiactive"),
                    ("INACTIVE", "Inactive"),
                    ("DECEASED", "Deceased"),
                    ("INVITED", "Invited"),
                    ("ATTENDED", "Attended"),
                ],
            ),
        ),
    ]
