from datetime import date
from decimal import Decimal

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.people.models import Branch, Person
from core.datetime_utils import church_today

REPORTS_URL = "/api/clusters/cluster-weekly-reports/"
ANALYTICS_URL = "/api/clusters/cluster-weekly-reports/analytics/"
OVERDUE_URL = "/api/clusters/cluster-weekly-reports/overdue/"
HISTORY_URL = "/api/clusters/cluster-weekly-reports/compliance_history/"


class CancelledGatheringTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTCANCEL",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="canceladmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="cancelmember",
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
            code="CANCEL-N",
            branch=self.branch,
            is_active=True,
        )
        self.cluster.members.add(self.member)
        self.client.force_authenticate(self.admin)

    def _payload(self, **overrides):
        data = {
            "cluster": self.cluster.id,
            "year": 2026,
            "week_number": 41,
            "meeting_date": "2026-10-05",
            "cancelled": True,
            "cancellation_reason": "Storm",
        }
        data.update(overrides)
        return data

    def test_cancelled_report_requires_a_reason(self):
        response = self.client.post(
            REPORTS_URL,
            self._payload(cancellation_reason="  "),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("cancellation_reason", response.data["details"])

    def test_cancelled_report_rejects_attendance_and_offerings(self):
        attendance = self.client.post(
            REPORTS_URL,
            self._payload(members_attended=[self.member.id]),
            format="json",
        )
        self.assertEqual(attendance.status_code, 400, attendance.data)
        self.assertIn("members_attended", attendance.data["details"])

        offerings = self.client.post(
            REPORTS_URL,
            self._payload(week_number=42, meeting_date="2026-10-12", offerings="25.00"),
            format="json",
        )
        self.assertEqual(offerings.status_code, 400, offerings.data)
        self.assertIn("offerings", offerings.data["details"])

    def test_cancelled_report_clears_gathering_type(self):
        response = self.client.post(
            REPORTS_URL,
            self._payload(gathering_type="PHYSICAL"),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        report = ClusterWeeklyReport.objects.get(pk=response.data["id"])
        self.assertTrue(report.cancelled)
        self.assertEqual(report.cancellation_reason, "Storm")
        self.assertIsNone(report.gathering_type)
        self.assertEqual(report.offerings, Decimal("0"))

    def test_switching_a_held_report_to_cancelled_clears_attendance(self):
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=40,
            meeting_date=date(2026, 9, 28),
            gathering_type="PHYSICAL",
            offerings=Decimal("80.00"),
        )
        report.members_attended.add(self.member)

        response = self.client.patch(
            f"{REPORTS_URL}{report.id}/",
            {"cancelled": True, "cancellation_reason": "Leader traveled"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        report.refresh_from_db()
        self.assertTrue(report.cancelled)
        self.assertIsNone(report.gathering_type)
        self.assertEqual(report.offerings, Decimal("0"))
        self.assertEqual(report.members_attended.count(), 0)

    def test_analytics_ignore_cancelled_reports(self):
        held = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=40,
            meeting_date=date(2026, 9, 28),
            gathering_type="PHYSICAL",
            offerings=Decimal("100.00"),
        )
        held.members_attended.add(self.member)
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=41,
            meeting_date=date(2026, 10, 5),
            cancelled=True,
            cancellation_reason="Storm",
            offerings=Decimal("50.00"),
        )

        response = self.client.get(
            ANALYTICS_URL,
            {"branch_id": self.branch.id, "year": 2026},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total_reports"], 1)
        self.assertEqual(Decimal(response.data["total_offerings"]), Decimal("100.00"))
        self.assertEqual(response.data["average_member_attendance_rate"], 100.0)
        types = {
            row["gathering_type"]
            for row in response.data["gathering_type_distribution"]
        }
        self.assertEqual(types, {"PHYSICAL"})

    def test_cancelled_current_week_is_not_overdue(self):
        today = church_today()
        iso = today.isocalendar()
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=iso.year,
            week_number=iso.week,
            meeting_date=today,
            cancelled=True,
            cancellation_reason="No venue",
        )
        quiet = Cluster.objects.create(
            name="Quiet Cluster",
            code="CANCEL-Q",
            branch=self.branch,
            is_active=True,
        )

        response = self.client.get(OVERDUE_URL)
        self.assertEqual(response.status_code, 200, response.data)
        overdue_ids = {row["id"] for row in response.data["overdue_clusters"]}
        self.assertNotIn(self.cluster.id, overdue_ids)
        self.assertIn(quiet.id, overdue_ids)

    def test_compliance_history_excuses_cancelled_weeks(self):
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=41,
            meeting_date=date(2026, 10, 5),
            cancelled=True,
            cancellation_reason="Storm",
        )
        response = self.client.get(
            HISTORY_URL,
            {"months": 6, "cluster_id": self.cluster.id, "group_by": "week"},
        )
        self.assertEqual(response.status_code, 200, response.data)
        row = next(
            item
            for item in response.data["data"]
            if item["period"] == "2026-W41"
        )
        self.assertEqual(row["reports_expected"], 0)
        self.assertEqual(row["reports_submitted"], 0)
        self.assertEqual(row["compliance_rate"], 100.0)

    def test_compliance_lists_cancelled_week_and_reason(self):
        self.client.post(REPORTS_URL, self._payload(), format="json")
        response = self.client.get(
            "/api/clusters/cluster-weekly-reports/compliance/",
            {"year": 2026, "week_number": "41"},
        )
        self.assertEqual(response.status_code, 200, response.data)
        row = next(
            item
            for item in response.data["clusters"]
            if item["cluster"]["id"] == self.cluster.id
        )
        self.assertEqual(row["compliance_rate"], 100.0)
        self.assertEqual(row["reports_expected"], 0)
        self.assertEqual(
            row["cancelled_weeks"],
            [{"week": 41, "reason": "Storm", "group": None}],
        )
