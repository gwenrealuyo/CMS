from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.people.models import Branch, Person

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

    def _report(self, week_number, meeting_date):
        return ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=week_number,
            meeting_date=meeting_date,
            gathering_type="PHYSICAL",
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
