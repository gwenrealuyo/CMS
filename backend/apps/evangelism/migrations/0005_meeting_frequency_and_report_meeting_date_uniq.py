# Add group meeting_frequency and unique (group, meeting_date) on reports.

from django.db import migrations, models


def dedupe_reports_same_meeting_date(apps, schema_editor):
    EvangelismWeeklyReport = apps.get_model("evangelism", "EvangelismWeeklyReport")
    seen = set()
    to_delete = []
    qs = EvangelismWeeklyReport.objects.order_by("-updated_at", "-id")
    for report in qs.iterator():
        key = (report.evangelism_group_id, report.meeting_date)
        if key in seen:
            to_delete.append(report.pk)
        else:
            seen.add(key)
    if to_delete:
        EvangelismWeeklyReport.objects.filter(pk__in=to_delete).delete()


def force_cluster_bs_weekly(apps, schema_editor):
    EvangelismGroup = apps.get_model("evangelism", "EvangelismGroup")
    EvangelismGroup.objects.filter(cluster_id__isnull=False).exclude(
        meeting_frequency="WEEKLY"
    ).update(meeting_frequency="WEEKLY")


class Migration(migrations.Migration):

    dependencies = [
        ("evangelism", "0004_recalculate_each1reach1_targets"),
    ]

    operations = [
        migrations.AddField(
            model_name="evangelismgroup",
            name="meeting_frequency",
            field=models.CharField(
                choices=[
                    ("WEEKLY", "Weekly"),
                    ("BIWEEKLY", "Biweekly"),
                    ("MONTHLY", "Monthly"),
                    ("IRREGULAR", "Irregular"),
                ],
                default="WEEKLY",
                help_text="How often this group meets. Drives report due reminders.",
                max_length=20,
            ),
        ),
        migrations.RunPython(
            force_cluster_bs_weekly,
            migrations.RunPython.noop,
        ),
        migrations.RunPython(
            dedupe_reports_same_meeting_date,
            migrations.RunPython.noop,
        ),
        migrations.AlterUniqueTogether(
            name="evangelismweeklyreport",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="evangelismweeklyreport",
            constraint=models.UniqueConstraint(
                fields=("evangelism_group", "meeting_date"),
                name="evangelism_report_group_meeting_date_uniq",
            ),
        ),
        migrations.AlterField(
            model_name="evangelismweeklyreport",
            name="meeting_date",
            field=models.DateField(help_text="Date the meeting was held"),
        ),
    ]
