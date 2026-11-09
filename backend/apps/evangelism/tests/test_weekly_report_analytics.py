from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.people.models import Branch, Person

ANALYTICS_URL = "/api/evangelism/weekly-reports/analytics/"


class EvangelismWeeklyReportAnalyticsAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTEVANAL",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="evanaladmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="evanalmember",
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
            code="EVANAL-N",
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

    def test_analytics_ignore_cancelled_reports(self):
        held = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=2026,
            week_number=40,
            meeting_date=date(2026, 9, 28),
            gathering_type="PHYSICAL",
        )
        held.members_attended.add(self.member)
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=2026,
            week_number=41,
            meeting_date=date(2026, 10, 5),
            cancelled=True,
            cancellation_reason="Storm",
        )

        response = self.client.get(
            ANALYTICS_URL,
            {"branch": self.branch.id, "year": 2026},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total_reports"], 1)
        self.assertEqual(response.data["total_attendance"]["members"], 1)
        self.assertEqual(response.data["average_member_attendance_rate"], 100.0)
        types = {
            row["gathering_type"]
            for row in response.data["gathering_type_distribution"]
        }
        self.assertEqual(types, {"PHYSICAL"})
        groups = response.data["chart_series"]["group_comparison"]
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["group_id"], self.group.id)
        self.assertEqual(groups[0]["report_count"], 1)

    def test_analytics_member_rate_zero_when_roster_empty(self):
        empty_group = EvangelismGroup.objects.create(
            name="Empty Group",
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        EvangelismWeeklyReport.objects.create(
            evangelism_group=empty_group,
            year=2026,
            week_number=40,
            meeting_date=date(2026, 9, 28),
            gathering_type="ONLINE",
        )

        response = self.client.get(
            ANALYTICS_URL,
            {"evangelism_group": empty_group.id, "year": 2026},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total_reports"], 1)
        self.assertEqual(response.data["average_member_attendance_rate"], 0.0)
