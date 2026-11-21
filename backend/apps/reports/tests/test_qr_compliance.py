from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from rest_framework.test import APITestCase

from apps.attendance.models import AttendanceRecord
from apps.events.models import Event, EventType
from apps.people.models import Branch, Person
from core.datetime_utils import church_today


MANILA = ZoneInfo("Asia/Manila")


class QrComplianceReportTests(APITestCase):
    def setUp(self):
        self.event_type, _ = EventType.objects.get_or_create(
            code="SUNDAY_SERVICE",
            defaults={
                "label": "Sunday Service",
                "sort_order": 10,
                "color": "#1e40af",
                "is_system": True,
            },
        )
        self.hq = Branch.objects.create(
            name="HQ QRC", code="HQQRC", is_headquarters=True, is_active=True
        )
        self.satellite = Branch.objects.create(
            name="Sat QRC", code="SATQRC", is_active=True
        )
        self.admin = Person.objects.create_user(
            username="qrcadmin",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.forgetful = self._member("qrcforget", "Fern", self.hq)
        self.once = self._member("qrconce", "Owen", self.hq)
        self.sat_member = self._member("qrcsat", "Sam", self.satellite)

        today = church_today()
        self.dates = [today - timedelta(days=7 * i) for i in range(3)]
        start = datetime(today.year, today.month, today.day, 9, tzinfo=MANILA)
        self.hq_event = self._event("HQ Service", self.hq, start)
        self.sat_event = self._event("Sat Service", self.satellite, start)

        # HQ members each miss once; the satellite member misses every time.
        for index, day in enumerate(self.dates):
            self._record(self.hq_event, self.forgetful, day, index != 0)
            self._record(self.hq_event, self.once, day, index != 1)
        for day in self.dates:
            self._record(self.sat_event, self.sat_member, day, False)
        self._record(self.hq_event, self.admin, self.dates[0], None)

    def _member(self, username, first_name, branch):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=first_name,
            last_name="Test",
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
            water_baptism_date=date(2020, 1, 1),
        )

    def _event(self, title, branch, start):
        return Event.objects.create(
            title=title,
            description="",
            start_date=start,
            end_date=start + timedelta(hours=3),
            event_type=self.event_type,
            location="Main Hall",
            branch=branch,
            is_recurring=True,
            recurrence_pattern={"frequency": "weekly", "weekdays": [6]},
            created_by=self.admin,
        )

    def _record(self, event, person, day, qr_presented):
        AttendanceRecord.objects.create(
            event=event,
            person=person,
            occurrence_date=day,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
            attendance_mode=AttendanceRecord.AttendanceMode.ONSITE,
            qr_presented=qr_presented,
        )

    def test_hq_branch_summary_and_repeat_members(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/reports/qr-compliance/",
            {"branch_id": self.hq.id, "months": 6},
        )
        self.assertEqual(response.status_code, 200, response.data)
        summary = response.data["summary"]
        self.assertEqual(summary["tracked"], 6)
        self.assertEqual(summary["no_qr"], 2)
        self.assertEqual(summary["brought_qr"], 4)
        self.assertEqual(summary["compliance_rate"], 66.7)

        members = response.data["members"]
        self.assertEqual(members, [])

    def test_min_misses_filter(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/reports/qr-compliance/",
            {"branch_id": self.hq.id, "months": 6, "min_misses": 1},
        )
        self.assertEqual(response.status_code, 200, response.data)
        names = [row["person_id"] for row in response.data["members"]]
        self.assertEqual(set(names), {self.forgetful.id, self.once.id})
        for row in response.data["members"]:
            self.assertEqual(row["no_qr"], 1)
            self.assertEqual(row["tracked"], 3)

    def test_all_branches_includes_satellite_repeat_offender(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/reports/qr-compliance/", {"months": 6}
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["tracked"], 9)
        self.assertEqual(response.data["summary"]["no_qr"], 5)
        members = response.data["members"]
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0]["person_id"], self.sat_member.id)
        self.assertEqual(members[0]["no_qr"], 3)
        self.assertEqual(members[0]["no_qr_rate"], 100.0)

    def test_csv_export(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/reports/qr-compliance/export/csv/", {"months": 6}
        )
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn("QR Compliance Summary", body)
        self.assertIn("Sam Test", body)

    def test_members_forbidden(self):
        self.client.force_authenticate(self.once)
        response = self.client.get("/api/reports/qr-compliance/")
        self.assertEqual(response.status_code, 403)
