from datetime import date, datetime, timedelta

from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import Event, EventRoom, EventType
from apps.people.models import Branch, ModuleCoordinator, Person


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


class NationalAwtaEventAPITests(APITestCase):
    def setUp(self):
        self.awta, _ = EventType.objects.update_or_create(
            code="AWTA",
            defaults={
                "label": "AWTA",
                "sort_order": 110,
                "color": "#dc2626",
                "is_system": True,
                "counts_as_activity": True,
            },
        )
        self.sunday, _ = EventType.objects.update_or_create(
            code="SUNDAY_SERVICE",
            defaults={
                "label": "Sunday Service",
                "sort_order": 10,
                "color": "#1e40af",
                "is_system": True,
                "counts_as_activity": True,
            },
        )
        self.hq = Branch.objects.create(
            name="HQ National",
            code="HQNAT",
            is_headquarters=True,
            is_active=True,
        )
        self.satellite = Branch.objects.create(
            name="Satellite National",
            code="SATNAT",
            is_headquarters=False,
            is_active=True,
        )
        self.hq_room = EventRoom.objects.create(
            branch=self.hq,
            name="HQ Hall",
            sort_order=10,
        )
        self.hq_coord = self._user("hqawtacoord", "HQ", "Coord", self.hq)
        ModuleCoordinator.objects.create(
            person=self.hq_coord,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.sat_coord = self._user("satawtacoord", "Sat", "Coord", self.satellite)
        ModuleCoordinator.objects.create(
            person=self.sat_coord,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.admin = Person.objects.create_user(
            username="adminawta",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.hq_pastor = Person.objects.create_user(
            username="pastorawta",
            password="pass12345",
            first_name="HQ",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.hq,
        )

    def _user(self, username, first, last, branch):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=first,
            last_name=last,
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
            water_baptism_date=date(2020, 1, 1),
        )

    def _details(self, response):
        data = response.data
        if isinstance(data, dict) and "details" in data:
            return data["details"]
        return data

    def _awta_payload(self, start, **overrides):
        data = {
            "title": "AWTA 2026",
            "description": "",
            "type": "AWTA",
            "location": "SMX Convention Center",
            "room": None,
            "branch": None,
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(hours=8)).isoformat(),
            "is_recurring": False,
            "attendance_format": "hybrid",
        }
        data.update(overrides)
        return data

    def test_hq_events_coord_can_create_church_wide_awta(self):
        self.client.force_authenticate(self.hq_coord)
        start = make_aware_local(2026, 6, 15, 8)
        response = self.client.post(
            "/api/events/", self._awta_payload(start), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["branch"])
        self.assertIsNone(response.data["room"])
        self.assertEqual(response.data["location"], "SMX Convention Center")
        self.assertEqual(response.data["type"], "AWTA")

    def test_church_wide_awta_forces_cross_branch_flag_off(self):
        self.client.force_authenticate(self.hq_coord)
        start = make_aware_local(2026, 6, 15, 14)
        response = self.client.post(
            "/api/events/",
            self._awta_payload(start, allow_cross_branch_attendance=True),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(response.data["allow_cross_branch_attendance"])
        event = Event.objects.get(pk=response.data["id"])
        self.assertFalse(event.allow_cross_branch_attendance)

    def test_admin_can_create_church_wide_awta(self):
        self.client.force_authenticate(self.admin)
        start = make_aware_local(2026, 6, 16, 8)
        response = self.client.post(
            "/api/events/", self._awta_payload(start), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_hq_pastor_can_create_church_wide_awta(self):
        self.client.force_authenticate(self.hq_pastor)
        start = make_aware_local(2026, 6, 17, 8)
        response = self.client.post(
            "/api/events/", self._awta_payload(start), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_satellite_events_coord_cannot_create_awta(self):
        self.client.force_authenticate(self.sat_coord)
        start = make_aware_local(2026, 6, 18, 8)
        response = self.client.post(
            "/api/events/",
            self._awta_payload(start, branch=self.satellite.id),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("type", self._details(response))

    def test_satellite_events_coord_cannot_create_church_wide(self):
        self.client.force_authenticate(self.sat_coord)
        start = make_aware_local(2026, 6, 19, 8)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Church-wide Sunday",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "location": "Somewhere",
                "room": None,
                "branch": None,
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=2)).isoformat(),
                "is_recurring": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("branch", self._details(response))

    def test_church_wide_awta_rejects_room(self):
        self.client.force_authenticate(self.hq_coord)
        start = make_aware_local(2026, 6, 20, 8)
        response = self.client.post(
            "/api/events/",
            self._awta_payload(start, room=self.hq_room.id, location=""),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("room", self._details(response))

    def test_non_awta_requires_branch(self):
        self.client.force_authenticate(self.admin)
        start = make_aware_local(2026, 6, 21, 9)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Sunday",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "location": "Park",
                "room": None,
                "branch": None,
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=2)).isoformat(),
                "is_recurring": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("branch", self._details(response))

    def test_hq_coord_can_create_branch_scoped_awta_with_room(self):
        self.client.force_authenticate(self.hq_coord)
        start = make_aware_local(2026, 6, 22, 8)
        response = self.client.post(
            "/api/events/",
            self._awta_payload(
                start,
                branch=self.hq.id,
                room=self.hq_room.id,
                location="",
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["branch"], self.hq.id)
        self.assertEqual(response.data["room"], self.hq_room.id)

    def test_satellite_cannot_update_church_wide_awta(self):
        self.client.force_authenticate(self.hq_coord)
        start = make_aware_local(2026, 6, 23, 8)
        created = self.client.post(
            "/api/events/", self._awta_payload(start), format="json"
        )
        self.assertEqual(created.status_code, 201, created.data)
        event_id = created.data["id"]

        self.client.force_authenticate(self.sat_coord)
        response = self.client.patch(
            f"/api/events/{event_id}/",
            {"title": "Hijacked"},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.data)
        event = Event.objects.get(pk=event_id)
        self.assertEqual(event.title, "AWTA 2026")

    def test_auth_me_exposes_can_manage_national_events(self):
        self.client.force_authenticate(self.hq_coord)
        hq_me = self.client.get("/api/auth/me/")
        self.assertEqual(hq_me.status_code, 200, hq_me.data)
        self.assertTrue(hq_me.data["can_manage_national_events"])

        self.client.force_authenticate(self.sat_coord)
        sat_me = self.client.get("/api/auth/me/")
        self.assertEqual(sat_me.status_code, 200, sat_me.data)
        self.assertFalse(sat_me.data["can_manage_national_events"])
