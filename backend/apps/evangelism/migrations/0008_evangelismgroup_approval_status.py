from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("evangelism", "0007_backfill_evangelismgroup_branch"),
    ]

    operations = [
        migrations.AddField(
            model_name="evangelismgroup",
            name="approval_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                ],
                db_index=True,
                default="approved",
                help_text="Coordinator-created groups start pending until a senior "
                "coordinator, pastor, or admin approves them.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="evangelismgroup",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="created_evangelism_groups",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="evangelismgroup",
            name="review_note",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="evangelismgroup",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="evangelismgroup",
            name="reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reviewed_evangelism_groups",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
