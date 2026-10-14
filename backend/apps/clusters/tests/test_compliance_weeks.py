from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.clusters.utils import previous_iso_weeks, recent_iso_weeks
from apps.people.models import Branch, Person
from core.datetime_utils import church_today

COMPLIANCE_URL = "/api/clusters/cluster-weekly-reports/compliance/"


class ComplianceWeekFilterTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTCOMP",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="compweekadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="East Cluster",
            code="COMP-EAST",
            branch=self.branch,
            is_active=True,
        )
        self.client.force_authenticate(self.admin)
        self._report(40, date(2026, 9, 28))
        self._report(42, date(2026, 10, 12))

    def _report(self, week_number, meeting_date, **extra):
        return ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=week_number,
            meeting_date=meeting_date,
            gathering_type=extra.pop("gathering_type", "PHYSICAL"),
            **extra,
        )

    def _row(self, response):
        rows = [
            row
            for row in response.data["clusters"]
            if row["cluster"]["id"] == self.cluster.id
        ]
        self.assertEqual(len(rows), 1)
        return rows[0]

    def test_selected_weeks_ignore_reports_outside_the_selection(self):
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "41,42"},
        )
        self.assertEqual(response.status_code, 200)
        row = self._row(response)
        self.assertEqual(row["reports_expected"], 2)
        self.assertEqual(row["reports_submitted"], 1)
        self.assertEqual(row["missing_weeks"], [41])
        self.assertEqual(row["status"], "PARTIAL")
        self.assertEqual(response.data["summary"]["period"]["weeks_expected"], 2)

    def test_last_report_is_not_limited_to_selected_weeks(self):
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "40"},
        )
        self.assertEqual(response.status_code, 200)
        row = self._row(response)
        self.assertEqual(row["reports_submitted"], 1)
        self.assertEqual(row["last_report_date"], "2026-10-12")
        self.assertEqual(
            row["days_since_last_report"],
            (church_today() - date(2026, 10, 12)).days,
        )

    def test_single_submitted_week_is_compliant(self):
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "42"},
        )
        self.assertEqual(response.status_code, 200)
        row = self._row(response)
        self.assertEqual(row["reports_expected"], 1)
        self.assertEqual(row["reports_submitted"], 1)
        self.assertEqual(row["status"], "COMPLIANT")

    def test_invalid_week_is_rejected(self):
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "99"},
        )
        self.assertEqual(response.status_code, 400)

    def test_branch_filter_limits_clusters(self):
        other_branch = Branch.objects.create(
            name="Bacolod",
            code="BACCOMP",
            is_active=True,
        )
        other_cluster = Cluster.objects.create(
            name="West Cluster",
            code="COMP-WEST",
            branch=other_branch,
            is_active=True,
        )
        ClusterWeeklyReport.objects.create(
            cluster=other_cluster,
            year=2026,
            week_number=42,
            meeting_date=date(2026, 10, 12),
            gathering_type="PHYSICAL",
        )

        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "42", "branch_id": self.branch.id},
        )
        self.assertEqual(response.status_code, 200)
        ids = [row["cluster"]["id"] for row in response.data["clusters"]]
        self.assertIn(self.cluster.id, ids)
        self.assertNotIn(other_cluster.id, ids)

    def test_trend_ignores_selected_weeks(self):
        recent = recent_iso_weeks(4)
        prior = previous_iso_weeks(recent)
        for year, week in recent:
            ClusterWeeklyReport.objects.get_or_create(
                cluster=self.cluster,
                year=year,
                week_number=week,
                defaults={
                    "meeting_date": date.fromisocalendar(year, week, 1),
                    "gathering_type": "PHYSICAL",
                },
            )
        earlier_year, earlier_week = previous_iso_weeks(prior[:1])[0]
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": earlier_year, "week_number": str(earlier_week)},
        )
        self.assertEqual(response.status_code, 200)
        row = self._row(response)
        self.assertEqual(row["reports_submitted"], 0)
        self.assertEqual(row["trend"], "IMPROVING")

    def test_cancelled_week_does_not_lower_compliance(self):
        self._report(
            41,
            date(2026, 10, 5),
            cancelled=True,
            cancellation_reason="Storm",
            gathering_type=None,
        )
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "41,42"},
        )
        self.assertEqual(response.status_code, 200)
        row = self._row(response)
        self.assertEqual(row["reports_expected"], 1)
        self.assertEqual(row["reports_submitted"], 1)
        self.assertEqual(row["missing_weeks"], [])
        self.assertEqual(
            row["cancelled_weeks"],
            [{"week": 41, "reason": "Storm", "group": None}],
        )
        self.assertEqual(row["status"], "COMPLIANT")
        self.assertEqual(row["compliance_rate"], 100.0)

    def test_only_cancelled_weeks_stay_compliant(self):
        self._report(
            41,
            date(2026, 10, 5),
            cancelled=True,
            cancellation_reason="Holiday",
            gathering_type=None,
        )
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "41"},
        )
        self.assertEqual(response.status_code, 200)
        row = self._row(response)
        self.assertEqual(row["reports_expected"], 0)
        self.assertEqual(row["reports_submitted"], 0)
        self.assertEqual(row["missing_weeks"], [])
        self.assertEqual(
            row["cancelled_weeks"],
            [{"week": 41, "reason": "Holiday", "group": None}],
        )
        self.assertEqual(row["status"], "COMPLIANT")
        self.assertEqual(row["compliance_rate"], 100.0)
        self.assertEqual(row["last_report_date"], "2026-10-12")

    def test_cancellation_still_updates_last_report_date(self):
        self._report(
            43,
            date(2026, 10, 19),
            cancelled=True,
            cancellation_reason="Venue closed",
            gathering_type=None,
        )
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "43"},
        )
        self.assertEqual(response.status_code, 200)
        row = self._row(response)
        self.assertEqual(row["last_report_date"], "2026-10-19")
        self.assertEqual(row["reports_expected"], 0)
        self.assertEqual(row["status"], "COMPLIANT")

    def test_real_missing_week_beside_cancellation_stays_missing(self):
        self._report(
            41,
            date(2026, 10, 5),
            cancelled=True,
            cancellation_reason="Storm",
            gathering_type=None,
        )
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "41,43"},
        )
        self.assertEqual(response.status_code, 200)
        row = self._row(response)
        self.assertEqual(row["reports_expected"], 1)
        self.assertEqual(row["reports_submitted"], 0)
        self.assertEqual(row["missing_weeks"], [43])
        self.assertEqual(
            row["cancelled_weeks"],
            [{"week": 41, "reason": "Storm", "group": None}],
        )
        self.assertEqual(row["status"], "NON_COMPLIANT")
