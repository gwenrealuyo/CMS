from datetime import datetime, timedelta

from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import EventRoom, EventType
from apps.people.models import Branch, ModuleCoordinator, Person


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


class MeetingTypeAPITests(APITestCase):
    def setUp(self):
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
        self.meeting, _ = EventType.objects.update_or_create(
            code="MEETING",
            defaults={
                "label": "Meeting",
                "sort_order": 160,
                "color": "#64748b",
                "is_system": True,
                "counts_as_activity": False,
            },
        )
        self.hq = Branch.objects.create(
            name="HQ Meet",
            code="HQMEET",
            is_headquarters=True,
            is_active=True,
        )
        self.sanctuary = EventRoom.objects.create(
            branch=self.hq,
            name="Main Sanctuary",
            sort_order=10,
        )
        self.hall = EventRoom.objects.create(
            branch=self.hq,
            name="Fellowship Hall",
            sort_order=20,
        )
        self.events_coord = self._user("emeetcoord", "Events", "Coord")
        ModuleCoordinator.objects.create(
            person=self.events_coord,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.cluster_coord = self._user("cmeetcoord", "Cluster", "Coord")
        ModuleCoordinator.objects.create(
            person=self.cluster_coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.admin = Person.objects.create_user(
            username="adminmeet",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.member = self._user("membermeet", "Plain", "Member")
        self.client.force_authenticate(self.events_coord)

    def _user(self, username, first, last):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=first,
            last_name=last,
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )

    def _payload(self, start, **overrides):
        data = {
            "title": "Staff meeting",
            "description": "",
            "type": "MEETING",
            "location": "",
            "room": self.sanctuary.id,
            "branch": self.hq.id,
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(hours=2)).isoformat(),
            "is_recurring": False,
        }
        data.update(overrides)
        return data

    def _details(self, response):
        data = response.data
        if isinstance(data, dict) and "details" in data:
            return data["details"]
        return data

    def _rows(self, response):
        data = response.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def test_event_type_list_includes_meeting_as_non_activity(self):
        response = self.client.get("/api/event-types/")
        self.assertEqual(response.status_code, 200, response.data)
        by_code = {row["code"]: row for row in self._rows(response)}
        self.assertIn("MEETING", by_code)
        self.assertFalse(by_code["MEETING"]["counts_as_activity"])
        self.assertTrue(by_code["SUNDAY_SERVICE"]["counts_as_activity"])

    def test_person_cannot_set_meeting_as_first_activity(self):
        self.client.force_authenticate(self.admin)
        rejected = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"first_activity_attended": "MEETING"},
            format="json",
        )
        self.assertEqual(rejected.status_code, 400, rejected.data)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.first_activity_attended_id)

        allowed = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"first_activity_attended": "SUNDAY_SERVICE"},
            format="json",
        )
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.first_activity_attended_id, "SUNDAY_SERVICE")

    def test_create_meeting_without_room_rejected(self):
        start = make_aware_local(2026, 10, 5, 14)
        response = self.client.post(
            "/api/events/",
            self._payload(
                start,
                room=None,
                location="Pastor office hallway",
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("room", self._details(response))

    def test_overlapping_same_room_rejected(self):
        start = make_aware_local(2026, 10, 11, 9)
        sunday = self.client.post(
            "/api/events/",
            self._payload(
                start,
                type="SUNDAY_SERVICE",
                title="Sunday Service",
            ),
            format="json",
        )
        self.assertEqual(sunday.status_code, 201, sunday.data)

        meeting = self.client.post(
            "/api/events/",
            self._payload(start, title="Board meeting"),
            format="json",
        )
        self.assertEqual(meeting.status_code, 400, meeting.data)
        self.assertIn("room", self._details(meeting))

    def test_overlapping_sunday_service_other_room_allowed(self):
        start = make_aware_local(2026, 10, 18, 9)
        sunday = self.client.post(
            "/api/events/",
            self._payload(
                start,
                type="SUNDAY_SERVICE",
                title="Sunday Service",
            ),
            format="json",
        )
        self.assertEqual(sunday.status_code, 201, sunday.data)

        meeting = self.client.post(
            "/api/events/",
            self._payload(
                start,
                title="Leadership meeting",
                room=self.hall.id,
            ),
            format="json",
        )
        self.assertEqual(meeting.status_code, 201, meeting.data)
        self.assertEqual(meeting.data["booking_status"], "approved")

    def test_cluster_coordinator_meeting_is_pending(self):
        start = make_aware_local(2026, 10, 6, 14)
        self.client.force_authenticate(self.cluster_coord)
        response = self.client.post(
            "/api/events/",
            self._payload(start),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["booking_status"], "pending")

    def test_events_coordinator_meeting_is_approved(self):
        start = make_aware_local(2026, 10, 7, 14)
        response = self.client.post(
            "/api/events/",
            self._payload(start),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["booking_status"], "approved")
