from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.people.models import Branch, Person

TALLY_URL = "/api/evangelism/weekly-reports/tally/"


class WeeklyTallyFilterTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTWTALLY",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="wtallyadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="wtallymember",
            password="pass12345",
            first_name="Mia",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="North Cluster",
            code="WTALLY-N",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="North Bible Study",
            cluster=self.cluster,
            branch=self.branch,
            coordinator=self.member,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self.group.members.add(self.member)
        self.client.force_authenticate(self.admin)

        for week, meeting in (
            (40, date(2026, 9, 28)),
            (41, date(2026, 10, 5)),
            (42, date(2026, 10, 12)),
        ):
            report = EvangelismWeeklyReport.objects.create(
                evangelism_group=self.group,
                year=2026,
                week_number=week,
                meeting_date=meeting,
                gathering_type="PHYSICAL",
                conversions_this_week=1,
            )
            report.members_attended.add(self.member)

    def test_tally_filters_comma_separated_weeks(self):
        response = self.client.get(
            TALLY_URL,
            {"year": 2026, "week_number": "40,42", "cluster": self.cluster.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        weeks = sorted(row["week_number"] for row in response.data)
        self.assertEqual(weeks, [40, 42])

    def test_tally_filters_repeated_week_number_params(self):
        response = self.client.get(
            f"{TALLY_URL}?year=2026&week_number=41&week_number=42"
            f"&cluster={self.cluster.id}"
        )
        self.assertEqual(response.status_code, 200, response.data)
        weeks = sorted(row["week_number"] for row in response.data)
        self.assertEqual(weeks, [41, 42])

    def test_tally_rejects_invalid_week_number(self):
        response = self.client.get(
            TALLY_URL,
            {"year": 2026, "week_number": "99"},
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details", response.data)
        self.assertIn("week_number", details)
