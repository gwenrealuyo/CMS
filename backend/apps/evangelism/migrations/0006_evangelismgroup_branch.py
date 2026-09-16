# Add EvangelismGroup.branch.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("evangelism", "0005_meeting_frequency_and_report_meeting_date_uniq"),
        ("people", "0006_branch_alter_journey_type_delete_cluster_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="evangelismgroup",
            name="branch",
            field=models.ForeignKey(
                blank=True,
                help_text="Church branch this group belongs to. Required for directory "
                "filtering; copied from the cluster when one is linked.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="evangelism_groups",
                to="people.branch",
            ),
        ),
    ]
