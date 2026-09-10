from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("lessons", "0003_nullable_teacher_historical_names"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lessonteachertransfer",
            name="to_teacher",
            field=models.ForeignKey(
                blank=True,
                limit_choices_to=models.Q(("role", "VISITOR"), _negated=True),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="lesson_transfers_to",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
