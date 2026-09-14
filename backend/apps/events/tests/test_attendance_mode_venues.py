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


class AttendanceModeVenueAPITests(APITestCase):
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
        self.home_altar, _ = AttendanceVenue.objects.get_or_create(
            code="HOME_ALTAR",
            defaults={
                "label": "Home altar",
                "sort_order": 10,
                "color": "#0EA5E9",
                "is_active": True,
                "is_system": True,
            },
        )
        self.cluster_house, _ = AttendanceVenue.objects.get_or_create(
            code="CLUSTER_HOUSE",
            defaults={
                "label": "Cluster house",
                "sort_order": 20,
                "color": "#8B5CF6",
                "is_active": True,
                "is_system": True,
            },
        )
        self.hq = Branch.objects.create(
            name="HQ Mode Venue",
            code="HQMV",
            is_headquarters=True,
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="mvadmin",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.member = Person.objects.create_user(
            username="mvmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            member_id="LAMP20001",
        )
        self.event = Event.objects.create(
            title="Sunday Service Mode Venue",
            description="",
            start_date=manila_dt(2026, 9, 13, 9),
            end_date=manila_dt(2026, 9, 13, 12),
            event_type=self.event_type,
            location="Main Hall",
            branch=self.hq,
            is_recurring=True,
            recurrence_pattern={
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2026-12-31",
            },
            created_by=self.admin,
        )

    def test_list_active_venues(self):
        self.client.force_authenticate(self.member)
        response = self.client.get("/api/attendance-venues/?active=true")
        self.assertEqual(response.status_code, 200, response.data)
        codes = {row["code"] for row in response.data}
        self.assertIn("HOME_ALTAR", codes)
        self.assertIn("CLUSTER_HOUSE", codes)

    def test_admin_can_create_venue_and_system_cannot_be_deleted(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            "/api/attendance-venues/",
            {
                "code": "SATELLITE",
                "label": "Satellite site",
                "color": "#14B8A6",
                "sort_order": 30,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        blocked = self.client.delete("/api/attendance-venues/HOME_ALTAR/")
        self.assertEqual(blocked.status_code, 400, blocked.data)

    def test_staff_onsite_checkin_default(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/events/{self.event.id}/attendance/",
            {
                "person_id": self.member.id,
                "occurrence_date": TODAY.isoformat(),
                "status": "PRESENT",
                "attendance_mode": "ONSITE",
            },
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        record = AttendanceRecord.objects.get(
            event=self.event, person=self.member, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONSITE")
        self.assertIsNone(record.attendance_venue_id)

    def test_staff_online_requires_venue(self):
        self.client.force_authenticate(self.admin)
        missing = self.client.post(
            f"/api/events/{self.event.id}/attendance/",
            {
                "person_id": self.member.id,
                "occurrence_date": TODAY.isoformat(),
                "status": "PRESENT",
                "attendance_mode": "ONLINE",
            },
            format="json",
        )
        self.assertEqual(missing.status_code, 400, missing.data)

        ok = self.client.post(
            f"/api/events/{self.event.id}/attendance/",
            {
                "person_id": self.member.id,
                "occurrence_date": TODAY.isoformat(),
                "status": "PRESENT",
                "attendance_mode": "ONLINE",
                "attendance_venue": "HOME_ALTAR",
            },
            format="json",
        )
        self.assertIn(ok.status_code, (200, 201), ok.data)
        record = AttendanceRecord.objects.get(
            event=self.event, person=self.member, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONLINE")
        self.assertEqual(record.attendance_venue_id, "HOME_ALTAR")

    def test_first_checkin_mode_is_final(self):
        self.client.force_authenticate(self.admin)
        first = self.client.post(
            f"/api/events/{self.event.id}/attendance/",
            {
                "person_id": self.member.id,
                "occurrence_date": TODAY.isoformat(),
                "status": "PRESENT",
                "attendance_mode": "ONSITE",
            },
            format="json",
        )
        self.assertIn(first.status_code, (200, 201), first.data)

        second = self.client.post(
            f"/api/events/{self.event.id}/attendance/",
            {
                "person_id": self.member.id,
                "occurrence_date": TODAY.isoformat(),
                "status": "PRESENT",
                "attendance_mode": "ONLINE",
                "attendance_venue": "CLUSTER_HOUSE",
            },
            format="json",
        )
        self.assertEqual(second.status_code, 409, second.data)
        record = AttendanceRecord.objects.get(
            event=self.event, person=self.member, occurrence_date=TODAY
        )
        self.assertEqual(record.attendance_mode, "ONSITE")
        self.assertIsNone(record.attendance_venue_id)
        self.assertEqual(
            AttendanceRecord.objects.filter(
                event=self.event, person=self.member, occurrence_date=TODAY
            ).count(),
            1,
        )

    def test_cannot_delete_venue_in_use(self):
        used = AttendanceVenue.objects.create(
            code="USED_VENUE",
            label="Used venue",
            sort_order=50,
            color="#EF4444",
            is_active=True,
            is_system=False,
        )
        unused = AttendanceVenue.objects.create(
            code="CUSTOM_HALL",
            label="Custom hall",
            sort_order=40,
            color="#F59E0B",
            is_active=True,
            is_system=False,
        )
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.member,
            occurrence_date=TODAY,
            status="PRESENT",
            attendance_mode="ONLINE",
            attendance_venue=used,
        )

        self.client.force_authenticate(self.admin)
        blocked = self.client.delete("/api/attendance-venues/USED_VENUE/")
        self.assertEqual(blocked.status_code, 400, blocked.data)

        unused_delete = self.client.delete("/api/attendance-venues/CUSTOM_HALL/")
        self.assertEqual(unused_delete.status_code, 204)
        self.assertFalse(AttendanceVenue.objects.filter(code=unused.code).exists())

    def test_self_checkin_requires_online_venue_and_stores_online(self):
        from apps.events.models import EventSetting
        from unittest.mock import patch

        EventSetting.get_solo()
        EventSetting.objects.filter(pk=EventSetting.SOLO_PK).update(
            member_self_checkin_enabled=True
        )
        self.client.force_authenticate(self.member)
        with patch(
            "apps.events.services.self_checkin.church_today",
            return_value=TODAY,
        ):
            missing = self.client.post(
                "/api/events/self-check-in/",
                {"person_ids": [self.member.id]},
                format="json",
            )
            self.assertEqual(missing.status_code, 400, missing.data)

            ok = self.client.post(
                "/api/events/self-check-in/",
                {
                    "person_ids": [self.member.id],
                    "attendance_venue": "CLUSTER_HOUSE",
                },
                format="json",
            )
            self.assertEqual(ok.status_code, 200, ok.data)
            self.assertIn("attendance_venues", ok.data)
            record = AttendanceRecord.objects.get(
                event=self.event, person=self.member, occurrence_date=TODAY
            )
            self.assertEqual(record.attendance_mode, "ONLINE")
            self.assertEqual(record.attendance_venue_id, "CLUSTER_HOUSE")
