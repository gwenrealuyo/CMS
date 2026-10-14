from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.people.models import Branch, Person

REPORTS_URL = "/api/evangelism/weekly-reports/"
TALLY_URL = "/api/evangelism/weekly-reports/tally/"


class CancelledEvangelismGatheringTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTEVCAN",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="evcanceladmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="evcancelmember",
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
            code="EVCAN-N",
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

    def _payload(self, **overrides):
        data = {
            "evangelism_group_id": self.group.id,
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

    def test_cancelled_report_rejects_attendance_and_conversions(self):
        attendance = self.client.post(
            REPORTS_URL,
            self._payload(members_attended=[self.member.id]),
            format="json",
        )
        self.assertEqual(attendance.status_code, 400, attendance.data)
        self.assertIn("members_attended", attendance.data["details"])

        conversions = self.client.post(
            REPORTS_URL,
            self._payload(meeting_date="2026-10-12", conversions_this_week=2),
            format="json",
        )
        self.assertEqual(conversions.status_code, 400, conversions.data)
        self.assertIn("conversions_this_week", conversions.data["details"])

    def test_cancelled_report_clears_gathering_type(self):
        response = self.client.post(
            REPORTS_URL,
            self._payload(gathering_type="PHYSICAL"),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        report = EvangelismWeeklyReport.objects.get(pk=response.data["id"])
        self.assertTrue(report.cancelled)
        self.assertEqual(report.cancellation_reason, "Storm")
        self.assertIsNone(report.gathering_type)
        self.assertEqual(report.conversions_this_week, 0)
        self.assertEqual(report.members_attended.count(), 0)

    def test_tally_ignores_cancelled_reports(self):
        held = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=2026,
            week_number=40,
            meeting_date=date(2026, 9, 28),
            gathering_type="PHYSICAL",
            conversions_this_week=2,
        )
        held.members_attended.add(self.member)
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=2026,
            week_number=41,
            meeting_date=date(2026, 10, 5),
            cancelled=True,
            cancellation_reason="Storm",
            conversions_this_week=5,
        )

        response = self.client.get(TALLY_URL, {"year": 2026, "cluster": self.cluster.id})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 1)
        row = response.data[0]
        self.assertEqual(row["week_number"], 40)
        self.assertEqual(row["evangelism_reports_count"], 1)
        self.assertEqual(row["members_count"], 1)
        self.assertEqual(row["conversions_this_week"], 2)
