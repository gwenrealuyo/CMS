from datetime import date
from unittest.mock import patch

from django.test import TestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.notifications.services import _build_evangelism_report_due
from apps.people.models import Branch, Person


CHURCH_TODAY = date(2026, 9, 15)


class EvangelismReportDueCadenceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTDUE",
            is_active=True,
        )
        self.coordinator = Person.objects.create_user(
            username="evrduecoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="Due Cluster",
            code="EVR-DUE",
            branch=self.branch,
            is_active=True,
        )

    def _group(self, name, frequency, **kwargs):
        defaults = {
            "name": name,
            "coordinator": self.coordinator,
            "is_active": True,
            "meeting_frequency": frequency,
        }
        defaults.update(kwargs)
        return EvangelismGroup.objects.create(**defaults)

    def _report(self, group, meeting_date):
        iso = meeting_date.isocalendar()
        return EvangelismWeeklyReport.objects.create(
            evangelism_group=group,
            meeting_date=meeting_date,
            year=iso[0],
            week_number=iso[1],
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )

    @patch("apps.notifications.services.church_today", return_value=CHURCH_TODAY)
    def test_weekly_due_when_missing_current_iso_week(self, _today):
        group = self._group(
            "Weekly Group",
            EvangelismGroup.MeetingFrequency.WEEKLY,
            cluster=self.cluster,
        )
        items = _build_evangelism_report_due(self.coordinator)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].type, "evangelism_report_due")
        self.assertEqual(items[0].key, f"evangelism_report_due:{group.id}:2026:38")
        self.assertIn("Week 38", items[0].title)
        self.assertIn("this week", items[0].body)
        self.assertEqual(items[0].href, f"/evangelism?tab=reports&group={group.id}")

        self._report(group, date(2026, 9, 15))
        self.assertEqual(_build_evangelism_report_due(self.coordinator), [])

    @patch("apps.notifications.services.church_today", return_value=CHURCH_TODAY)
    def test_biweekly_silent_if_report_in_last_14_days(self, _today):
        group = self._group(
            "Biweekly Group", EvangelismGroup.MeetingFrequency.BIWEEKLY
        )
        self._report(group, date(2026, 9, 2))
        self.assertEqual(_build_evangelism_report_due(self.coordinator), [])

        EvangelismWeeklyReport.objects.filter(evangelism_group=group).delete()
        self._report(group, date(2026, 9, 1))
        items = _build_evangelism_report_due(self.coordinator)
        self.assertEqual(len(items), 1)
        self.assertEqual(
            items[0].key, f"evangelism_report_due:{group.id}:biweekly:2026:38"
        )
        self.assertEqual(items[0].title, "Submit evangelism report")
        self.assertIn("last 2 weeks", items[0].body)

    @patch("apps.notifications.services.church_today", return_value=CHURCH_TODAY)
    def test_monthly_silent_if_report_this_month(self, _today):
        group = self._group(
            "Monthly Group", EvangelismGroup.MeetingFrequency.MONTHLY
        )
        self._report(group, date(2026, 9, 1))
        self.assertEqual(_build_evangelism_report_due(self.coordinator), [])

        EvangelismWeeklyReport.objects.filter(evangelism_group=group).delete()
        self._report(group, date(2026, 8, 31))
        items = _build_evangelism_report_due(self.coordinator)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].key, f"evangelism_report_due:{group.id}:2026:9")
        self.assertIn("September 2026", items[0].body)

    @patch("apps.notifications.services.church_today", return_value=CHURCH_TODAY)
    def test_irregular_never_due(self, _today):
        self._group(
            "Irregular Group", EvangelismGroup.MeetingFrequency.IRREGULAR
        )
        self.assertEqual(_build_evangelism_report_due(self.coordinator), [])

    @patch("apps.notifications.services.church_today", return_value=CHURCH_TODAY)
    def test_cluster_linked_monthly_is_treated_as_weekly(self, _today):
        group = self._group(
            "Cluster Monthly",
            EvangelismGroup.MeetingFrequency.MONTHLY,
            cluster=self.cluster,
        )
        self.assertEqual(group.meeting_frequency, EvangelismGroup.MeetingFrequency.WEEKLY)
        items = _build_evangelism_report_due(self.coordinator)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].key, f"evangelism_report_due:{group.id}:2026:38")
        self.assertIn("this week", items[0].body)

    @patch("apps.notifications.services.church_today", return_value=CHURCH_TODAY)
    def test_inactive_group_skipped(self, _today):
        self._group(
            "Inactive Weekly",
            EvangelismGroup.MeetingFrequency.WEEKLY,
            is_active=False,
        )
        self.assertEqual(_build_evangelism_report_due(self.coordinator), [])
