from datetime import date, datetime
from zoneinfo import ZoneInfo

from rest_framework.test import APITestCase

from apps.attendance.models import AttendanceRecord
from apps.events.models import Event, EventType
from apps.people.models import Branch, Person


MANILA = ZoneInfo("Asia/Manila")
OCCURRENCE = date(2026, 10, 4)


def manila_dt(year, month, day, hour=9):
    return datetime(year, month, day, hour, 0, 0, tzinfo=MANILA)


class AttendancePayloadGateTests(APITestCase):
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
        self.branch = Branch.objects.create(
            name="Gate Branch",
            code="GATE",
            is_headquarters=True,
            is_active=True,
        )
        self.pastor = Person.objects.create_user(
            username="gatepastor",
            password="pass12345",
            first_name="Pia",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="gatemember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            member_id="LAMP91001",
            phone="+639171000001",
            water_baptism_date=date(2020, 1, 1),
        )
        self.other = Person.objects.create_user(
            username="gateother",
            password="pass12345",
            first_name="Leilanie",
            last_name="Del Castillo",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            member_id="LAMP91864",
            phone="+163928808244",
            water_baptism_date=date(2020, 1, 1),
        )
        self.event = Event.objects.create(
            title="Sunday Service Gate",
            description="",
            start_date=manila_dt(2026, 10, 4, 9),
            end_date=manila_dt(2026, 10, 4, 12),
            event_type=self.event_type,
            location="Main Hall",
            branch=self.branch,
            created_by=self.pastor,
        )
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.member,
            occurrence_date=OCCURRENCE,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
            notes="member private note",
        )
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.other,
            occurrence_date=OCCURRENCE,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
            notes="other private note",
        )

    def _event_from_list(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data
        match = next(row for row in rows if row["id"] == self.event.id)
        return match["attendance_records"]

    def _assert_member_records(self, records):
        self.assertEqual(len(records), 2)
        self.assertTrue(all(record["notes"] == "" for record in records))
        own = next(
            record
            for record in records
            if record["person"]["id"] == self.member.id
        )
        other = next(
            record for record in records if record["person"]["id"] is None
        )
        self.assertEqual(set(own["person"].keys()), {"id"})
        self.assertEqual(other["person"], {"id": None})
        for record in records:
            self.assertNotIn("phone", record["person"])
            self.assertNotIn("member_id", record["person"])
            self.assertNotIn("first_name", record["person"])

    def test_member_events_list_redacts_attendance_people(self):
        self.client.force_authenticate(self.member)
        response = self.client.get("/api/events/?include_attendance=true")
        self._assert_member_records(self._event_from_list(response))

    def test_member_event_attendance_endpoint_redacts_people(self):
        self.client.force_authenticate(self.member)
        response = self.client.get(f"/api/events/{self.event.id}/attendance/")
        self.assertEqual(response.status_code, 200, response.data)
        self._assert_member_records(response.data)

    def test_pastor_receives_full_attendance_person(self):
        self.client.force_authenticate(self.pastor)
        response = self.client.get("/api/events/?include_attendance=true")
        records = self._event_from_list(response)
        self.assertEqual(len(records), 2)
        other = next(
            record
            for record in records
            if record["person"]["id"] == self.other.id
        )
        self.assertEqual(other["person"]["phone"], "+163928808244")
        self.assertEqual(other["person"]["member_id"], "LAMP91864")
        self.assertEqual(other["person"]["first_name"], "Leilanie")
        self.assertEqual(other["notes"], "other private note")
