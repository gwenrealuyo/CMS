from datetime import datetime, timedelta

from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import Event, EventRoom, EventType
from apps.people.models import Branch, ModuleCoordinator, Person


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


class EventRoomAPITests(APITestCase):
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
            name="HQ Test",
            code="HQTEST",
            is_headquarters=True,
            is_active=True,
        )
        self.satellite = Branch.objects.create(
            name="Satellite Test",
            code="SATEST",
            is_headquarters=False,
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="roomadmin",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.coordinator = Person.objects.create_user(
            username="roomcoord",
            password="pass12345",
            first_name="Events",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.sat_coordinator = Person.objects.create_user(
            username="satcoord",
            password="pass12345",
            first_name="Sat",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.satellite,
        )
        ModuleCoordinator.objects.create(
            person=self.sat_coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.teacher = Person.objects.create_user(
            username="eventteacher",
            password="pass12345",
            first_name="Events",
            last_name="Teacher",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        ModuleCoordinator.objects.create(
            person=self.teacher,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        self.member = Person.objects.create_user(
            username="roommember",
            password="pass12345",
            first_name="Plain",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.hq_room = EventRoom.objects.create(
            branch=self.hq,
            name="Main Sanctuary",
            sort_order=10,
        )
        self.sat_room = EventRoom.objects.create(
            branch=self.satellite,
            name="Fellowship Hall",
            sort_order=10,
        )

    def test_coordinator_crud_own_branch(self):
        self.client.force_authenticate(self.coordinator)
        create = self.client.post(
            "/api/event-rooms/",
            {"name": "Youth Room", "branch": self.hq.id},
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        room_id = create.data["id"]
        self.assertEqual(create.data["branch"], self.hq.id)

        listed = self.client.get("/api/event-rooms/")
        self.assertEqual(listed.status_code, 200)
        ids = {row["id"] for row in listed.data}
        self.assertIn(room_id, ids)
        self.assertIn(self.hq_room.id, ids)
        self.assertNotIn(self.sat_room.id, ids)

        patched = self.client.patch(
            f"/api/event-rooms/{room_id}/",
            {"capacity": 40},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertEqual(patched.data["capacity"], 40)

        deleted = self.client.delete(f"/api/event-rooms/{room_id}/")
        self.assertEqual(deleted.status_code, 204)

    def test_coordinator_cannot_access_other_branch_room(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(f"/api/event-rooms/{self.sat_room.id}/")
        self.assertEqual(response.status_code, 404)

        create = self.client.post(
            "/api/event-rooms/",
            {"name": "Sneaky Room", "branch": self.satellite.id},
            format="json",
        )
        self.assertEqual(create.status_code, 400)

    def test_member_cannot_mutate(self):
        self.client.force_authenticate(self.member)
        listed = self.client.get("/api/event-rooms/")
        self.assertEqual(listed.status_code, 200)

        create = self.client.post(
            "/api/event-rooms/",
            {"name": "Member Room", "branch": self.hq.id},
            format="json",
        )
        self.assertEqual(create.status_code, 403)

        deleted = self.client.delete(f"/api/event-rooms/{self.hq_room.id}/")
        self.assertEqual(deleted.status_code, 403)

    def test_teacher_cannot_mutate(self):
        self.client.force_authenticate(self.teacher)
        create = self.client.post(
            "/api/event-rooms/",
            {"name": "Teacher Room", "branch": self.hq.id},
            format="json",
        )
        self.assertEqual(create.status_code, 403)

    def test_admin_lists_all_and_can_filter_branch(self):
        self.client.force_authenticate(self.admin)
        listed = self.client.get("/api/event-rooms/")
        self.assertEqual(listed.status_code, 200)
        ids = {row["id"] for row in listed.data}
        self.assertIn(self.hq_room.id, ids)
        self.assertIn(self.sat_room.id, ids)

        filtered = self.client.get("/api/event-rooms/", {"branch": self.satellite.id})
        self.assertEqual(filtered.status_code, 200)
        ids = {row["id"] for row in filtered.data}
        self.assertEqual(ids, {self.sat_room.id})

    def test_duplicate_name_same_branch_rejected(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/event-rooms/",
            {"name": "main sanctuary", "branch": self.hq.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.data.get("details", {}))

    def test_only_one_active_last_minute_fallback_per_branch(self):
        self.client.force_authenticate(self.admin)
        first = self.client.post(
            "/api/event-rooms/",
            {
                "name": "Walk-in Room",
                "branch": self.hq.id,
                "is_last_minute_fallback": True,
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post(
            "/api/event-rooms/",
            {
                "name": "Another Walk-in",
                "branch": self.hq.id,
                "is_last_minute_fallback": True,
            },
            format="json",
        )
        self.assertEqual(second.status_code, 400, second.data)
        self.assertIn(
            "is_last_minute_fallback",
            second.data.get("details", {}),
        )

    def test_same_name_other_branch_ok(self):
        self.client.force_authenticate(self.sat_coordinator)
        response = self.client.post(
            "/api/event-rooms/",
            {"name": "Main Sanctuary", "branch": self.satellite.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_delete_blocked_when_room_in_use(self):
        start = make_aware_local(2026, 9, 13)
        Event.objects.create(
            title="Service",
            description="",
            start_date=start,
            end_date=start + timedelta(hours=2),
            event_type=self.event_type,
            location=self.hq_room.name,
            room=self.hq_room,
            branch=self.hq,
            created_by=self.coordinator,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.delete(f"/api/event-rooms/{self.hq_room.id}/")
        self.assertEqual(response.status_code, 400)

    def test_event_create_with_room_sets_location_and_branch(self):
        self.client.force_authenticate(self.coordinator)
        start = make_aware_local(2026, 9, 20)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Youth Night",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=2)).isoformat(),
                "room": self.hq_room.id,
                "location": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["room"], self.hq_room.id)
        self.assertEqual(response.data["room_name"], self.hq_room.name)
        self.assertEqual(response.data["location"], self.hq_room.name)
        self.assertEqual(response.data["branch"], self.hq.id)

    def test_event_create_offsite_keeps_custom_location(self):
        self.client.force_authenticate(self.coordinator)
        start = make_aware_local(2026, 9, 27)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Park Outreach",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=2)).isoformat(),
                "room": None,
                "branch": self.hq.id,
                "location": "City Park",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["room"])
        self.assertEqual(response.data["location"], "City Park")
        self.assertEqual(response.data["branch"], self.hq.id)

    def test_event_rejects_room_from_other_branch(self):
        self.client.force_authenticate(self.admin)
        start = make_aware_local(2026, 10, 4)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Mismatch",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=2)).isoformat(),
                "room": self.sat_room.id,
                "branch": self.hq.id,
                "location": "ignored",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("room", response.data.get("details", {}))

    def test_event_list_scoped_to_coordinator_branch(self):
        start = make_aware_local(2026, 11, 1)
        Event.objects.create(
            title="HQ Service",
            description="",
            event_type=self.event_type,
            start_date=start,
            end_date=start + timedelta(hours=2),
            location="HQ",
            branch=self.hq,
            booking_status=Event.BookingStatus.APPROVED,
            created_by=self.admin,
        )
        Event.objects.create(
            title="Satellite Service",
            description="",
            event_type=self.event_type,
            start_date=start,
            end_date=start + timedelta(hours=2),
            location="Satellite",
            branch=self.satellite,
            booking_status=Event.BookingStatus.APPROVED,
            created_by=self.admin,
        )
        self.client.force_authenticate(self.admin)
        # Non-admins are branch-scoped; admin with ?branch= matches that view.
        scoped = self.client.get("/api/events/", {"branch": self.satellite.id})
        self.assertEqual(scoped.status_code, 200, scoped.data)
        payload = scoped.data
        if isinstance(payload, dict) and "results" in payload:
            payload = payload["results"]
        titles = {row["title"] for row in payload}
        self.assertIn("Satellite Service", titles)
        self.assertNotIn("HQ Service", titles)

    def test_admin_can_filter_events_by_branch(self):
        start = make_aware_local(2026, 11, 8)
        Event.objects.create(
            title="HQ Only",
            description="",
            event_type=self.event_type,
            start_date=start,
            end_date=start + timedelta(hours=2),
            location="HQ",
            branch=self.hq,
            booking_status=Event.BookingStatus.APPROVED,
            created_by=self.admin,
        )
        Event.objects.create(
            title="Sat Only",
            description="",
            event_type=self.event_type,
            start_date=start,
            end_date=start + timedelta(hours=2),
            location="Satellite",
            branch=self.satellite,
            booking_status=Event.BookingStatus.APPROVED,
            created_by=self.admin,
        )
        self.client.force_authenticate(self.admin)
        all_events = self.client.get("/api/events/")
        self.assertEqual(all_events.status_code, 200)
        all_payload = all_events.data
        if isinstance(all_payload, dict) and "results" in all_payload:
            all_payload = all_payload["results"]
        all_titles = {row["title"] for row in all_payload}
        self.assertIn("HQ Only", all_titles)
        self.assertIn("Sat Only", all_titles)

        filtered = self.client.get(
            "/api/events/", {"branch": self.satellite.id}
        )
        self.assertEqual(filtered.status_code, 200)
        filtered_payload = filtered.data
        if isinstance(filtered_payload, dict) and "results" in filtered_payload:
            filtered_payload = filtered_payload["results"]
        filtered_titles = {row["title"] for row in filtered_payload}
        self.assertEqual(filtered_titles, {"Sat Only"})
