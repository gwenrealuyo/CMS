from datetime import date, datetime
from zoneinfo import ZoneInfo

from rest_framework.test import APITestCase

from apps.attendance.models import AttendanceRecord
from apps.events.models import AttendanceVenue, Event, EventType
from apps.people.models import Branch, Person


MANILA = ZoneInfo("Asia/Manila")
TODAY = date(2026, 9, 13)


def manila_dt(year, month, day, hour=9):
    return datetime(year, month, day, hour, 0, 0, tzinfo=MANILA)


class QrPresentedAttendanceTests(APITestCase):
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
        AttendanceVenue.objects.get_or_create(
            code="HOME_ALTAR",
            defaults={
                "label": "Home altar",
                "sort_order": 10,
                "color": "#0EA5E9",
                "is_active": True,
                "is_system": True,
            },
        )
        self.branch = Branch.objects.create(
            name="HQ QR",
            code="HQQR",
            is_headquarters=True,
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="qradmin",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="qrmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            member_id="LAMP30001",
            water_baptism_date=date(2020, 1, 1),
        )
        self.other = Person.objects.create_user(
            username="qrother",
            password="pass12345",
            first_name="Olive",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            member_id="LAMP30002",
            water_baptism_date=date(2020, 1, 1),
        )
        self.event = Event.objects.create(
            title="Sunday Service QR",
            description="",
            start_date=manila_dt(2026, 9, 13, 9),
            end_date=manila_dt(2026, 9, 13, 12),
            event_type=self.event_type,
            location="Main Hall",
            branch=self.branch,
            is_recurring=True,
            recurrence_pattern={
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2026-12-31",
            },
            created_by=self.admin,
        )
        self.url = f"/api/events/{self.event.id}/attendance/"

    def _post(self, person, **extra):
        payload = {
            "person_id": person.id,
            "occurrence_date": TODAY.isoformat(),
            "status": "PRESENT",
            **extra,
        }
        return self.client.post(self.url, payload, format="json")

    def _record(self, person):
        return AttendanceRecord.objects.get(
            event=self.event, person=person, occurrence_date=TODAY
        )

    def test_onsite_omitted_defaults_to_brought_qr(self):
        self.client.force_authenticate(self.admin)
        response = self._post(self.member, attendance_mode="ONSITE")
        self.assertIn(response.status_code, (200, 201), response.data)
        self.assertIs(self._record(self.member).qr_presented, True)
        self.assertIs(response.data["attendance_record"]["qr_presented"], True)

    def test_onsite_explicit_no_qr_is_stored(self):
        self.client.force_authenticate(self.admin)
        response = self._post(
            self.member, attendance_mode="ONSITE", qr_presented=False
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        self.assertIs(self._record(self.member).qr_presented, False)

    def test_online_forces_qr_to_none(self):
        self.client.force_authenticate(self.admin)
        response = self._post(
            self.member,
            attendance_mode="ONLINE",
            attendance_venue="HOME_ALTAR",
            qr_presented=False,
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        self.assertIsNone(self._record(self.member).qr_presented)

    def test_patch_toggles_qr_presented(self):
        self.client.force_authenticate(self.admin)
        self._post(self.member, attendance_mode="ONSITE")
        record = self._record(self.member)
        response = self.client.patch(
            f"{self.url}{record.id}/",
            {"qr_presented": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        record.refresh_from_db()
        self.assertIs(record.qr_presented, False)
        self.assertEqual(record.attendance_mode, "ONSITE")

    def test_patch_to_online_clears_qr(self):
        self.client.force_authenticate(self.admin)
        self._post(self.member, attendance_mode="ONSITE", qr_presented=False)
        record = self._record(self.member)
        response = self.client.patch(
            f"{self.url}{record.id}/",
            {"attendance_mode": "ONLINE", "attendance_venue": "HOME_ALTAR"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        record.refresh_from_db()
        self.assertEqual(record.attendance_mode, "ONLINE")
        self.assertIsNone(record.qr_presented)

    def test_member_viewer_cannot_see_others_qr_status(self):
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.other,
            occurrence_date=TODAY,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
            qr_presented=False,
        )
        self.client.force_authenticate(self.member)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 1)
        self.assertIsNone(response.data[0]["qr_presented"])
