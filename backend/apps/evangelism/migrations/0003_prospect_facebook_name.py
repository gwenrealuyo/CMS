from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("evangelism", "0002_evangelismgroup_is_bible_sharers_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="prospect",
            name="facebook_name",
            field=models.CharField(blank=True, max_length=200),
        ),
    ]
