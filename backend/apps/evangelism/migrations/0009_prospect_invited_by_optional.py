from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("evangelism", "0008_evangelismgroup_approval_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="prospect",
            name="invited_by",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Member who invited them. Optional for a returning visitor "
                    "who has no inviter on their person record."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="invited_prospects",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
