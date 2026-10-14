from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.people.models import Branch, Person

COMPLIANCE_URL = "/api/reports/compliance/"


class ReportsComplianceWeekFilterTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTREPWK",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="repwkadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="North",
            code="REPWK-N",
            branch=self.branch,
            is_active=True,
        )
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=2,
            meeting_date=date(2026, 1, 5),
            gathering_type="PHYSICAL",
        )
        self.client.force_authenticate(self.admin)

    def _row(self, response):
        return next(
            item
            for item in response.data["clusters"]
            if item["cluster"]["id"] == self.cluster.id
        )

    def test_selected_weeks_limit_expected_reports(self):
        one_week = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "2"},
        )
        self.assertEqual(one_week.status_code, 200, one_week.data)
        row = self._row(one_week)
        self.assertEqual(row["reports_expected"], 1)
        self.assertEqual(row["reports_submitted"], 1)
        self.assertEqual(one_week.data["summary"]["period"]["weeks_expected"], 1)

        two_weeks = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "2,3"},
        )
        self.assertEqual(two_weeks.status_code, 200, two_weeks.data)
        row = self._row(two_weeks)
        self.assertEqual(row["reports_expected"], 2)
        self.assertEqual(row["reports_submitted"], 1)
        self.assertEqual(row["missing_weeks"], [3])
        self.assertEqual(two_weeks.data["summary"]["period"]["weeks_expected"], 2)

    def test_invalid_week_is_rejected(self):
        response = self.client.get(
            COMPLIANCE_URL,
            {"year": 2026, "week_number": "99"},
        )
        self.assertEqual(response.status_code, 400, response.data)
