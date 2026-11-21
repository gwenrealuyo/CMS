from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0004_attendancerecord_catchup"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancerecord",
            name="qr_presented",
            field=models.BooleanField(
                blank=True,
                help_text=(
                    "Onsite only: True if the member's QR was scanned, False if "
                    "they came without it. Null means not tracked."
                ),
                null=True,
            ),
        ),
    ]
