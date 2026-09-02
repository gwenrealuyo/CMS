from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("evangelism", "0002_weekly_report_year_week_index"),
    ]

    operations = [
        migrations.AlterField(
            model_name="prospect",
            name="inviter_cluster",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Cluster this visitor was recorded against (cluster weekly report). "
                    "Not copied from the inviter's cluster membership."
                ),
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="prospects_by_inviter",
                to="clusters.cluster",
            ),
        ),
    ]
