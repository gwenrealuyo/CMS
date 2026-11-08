from datetime import date, datetime, timedelta

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
                "label": "Room hold",
                "sort_order": 160,
                "color": "#64748b",
                "is_system": True,
                "counts_as_activity": False,
            },
        )
        self.clustering, _ = EventType.objects.update_or_create(
            code="CLUSTERING",
            defaults={
                "label": "Clustering",
                "sort_order": 50,
                "color": "#0d9488",
                "is_system": True,
                "counts_as_activity": True,
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
            water_baptism_date=date(2020, 1, 1),
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
            water_baptism_date=date(2020, 1, 1),
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

    def test_event_type_counts_as_activity_is_writable(self):
        self.client.force_authenticate(self.admin)
        turned_off = self.client.patch(
            f"/api/event-types/{self.clustering.code}/",
            {"counts_as_activity": False},
            format="json",
        )
        self.assertEqual(turned_off.status_code, 200, turned_off.data)
        self.assertFalse(turned_off.data["counts_as_activity"])
        self.clustering.refresh_from_db()
        self.assertFalse(self.clustering.counts_as_activity)

        meeting_forced = self.client.patch(
            f"/api/event-types/{self.meeting.code}/",
            {"counts_as_activity": True},
            format="json",
        )
        self.assertEqual(meeting_forced.status_code, 200, meeting_forced.data)
        self.assertFalse(meeting_forced.data["counts_as_activity"])
        self.meeting.refresh_from_db()
        self.assertFalse(self.meeting.counts_as_activity)

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
        self.assertTrue(response.data["is_room_hold"])
        self.assertFalse(response.data["counts_toward_first_activity"])

    def test_meeting_type_forces_room_hold_flag(self):
        start = make_aware_local(2026, 10, 8, 14)
        response = self.client.post(
            "/api/events/",
            self._payload(start, is_room_hold=False),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["is_room_hold"])

    def test_affiliated_room_hold_keeps_activity_type(self):
        start = make_aware_local(2026, 10, 9, 14)
        response = self.client.post(
            "/api/events/",
            self._payload(
                start,
                type="CLUSTERING",
                title="Clustering planning",
                is_room_hold=True,
                counts_toward_first_activity=True,
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["type"], "CLUSTERING")
        self.assertTrue(response.data["is_room_hold"])
        self.assertFalse(response.data["counts_toward_first_activity"])

    def test_room_hold_allows_attendance(self):
        start = make_aware_local(2026, 10, 10, 14)
        created = self.client.post(
            "/api/events/",
            self._payload(start),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        event_id = created.data["id"]
        occurrence = start.date().isoformat()
        response = self.client.post(
            f"/api/events/{event_id}/attendance/",
            {
                "person_id": self.member.id,
                "occurrence_date": occurrence,
                "status": "PRESENT",
                "attendance_mode": "ONSITE",
            },
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.data)

    def test_estimated_headcount_create_and_update(self):
        start = make_aware_local(2026, 10, 11, 14)
        created = self.client.post(
            "/api/events/",
            self._payload(start, estimated_headcount=20),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["estimated_headcount"], 20)

        event_id = created.data["id"]
        updated = self.client.put(
            f"/api/events/{event_id}/",
            self._payload(
                start,
                title=created.data["title"],
                estimated_headcount=25,
            ),
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["estimated_headcount"], 25)

        cleared = self.client.put(
            f"/api/events/{event_id}/",
            self._payload(
                start,
                title=created.data["title"],
                estimated_headcount=None,
            ),
            format="json",
        )
        self.assertEqual(cleared.status_code, 200, cleared.data)
        self.assertIsNone(cleared.data["estimated_headcount"])

    def test_estimated_headcount_over_room_capacity_allowed(self):
        self.sanctuary.capacity = 10
        self.sanctuary.save(update_fields=["capacity"])
        start = make_aware_local(2026, 10, 12, 14)
        response = self.client.post(
            "/api/events/",
            self._payload(start, estimated_headcount=40),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["estimated_headcount"], 40)

    def test_pending_booking_notification_includes_estimated_headcount(self):
        start = make_aware_local(2026, 10, 13, 14)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(
                start,
                title="Headcount notify",
                estimated_headcount=18,
            ),
            format="json",
        )
        self.assertEqual(pending.status_code, 201, pending.data)
        self.assertEqual(pending.data["booking_status"], "pending")
        self.assertEqual(pending.data["estimated_headcount"], 18)

        self.client.force_authenticate(self.events_coord)
        feed = self.client.get("/api/notifications/")
        self.assertEqual(feed.status_code, 200, feed.data)
        pending_bodies = [
            item["body"]
            for item in feed.data["items"]
            if item["type"] == "event_booking_pending"
        ]
        self.assertTrue(
            any("18 expected" in body for body in pending_bodies),
            pending_bodies,
        )

    def test_room_hold_within_24h_requires_last_minute_room(self):
        from django.utils import timezone

        self.hall.is_last_minute_fallback = True
        self.hall.save(update_fields=["is_last_minute_fallback"])
        start = timezone.now() + timedelta(hours=2)
        blocked = self.client.post(
            "/api/events/",
            self._payload(start, room=self.sanctuary.id),
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)

        allowed = self.client.post(
            "/api/events/",
            self._payload(start, room=self.hall.id, title="Last minute hold"),
            format="json",
        )
        self.assertEqual(allowed.status_code, 201, allowed.data)

    def test_room_hold_within_15_minutes_rejected(self):
        from django.utils import timezone

        self.hall.is_last_minute_fallback = True
        self.hall.save(update_fields=["is_last_minute_fallback"])
        start = timezone.now() + timedelta(minutes=5)
        response = self.client.post(
            "/api/events/",
            self._payload(start, room=self.hall.id),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_room_hold_beyond_24h_any_room(self):
        from django.utils import timezone

        start = timezone.now() + timedelta(hours=30)
        response = self.client.post(
            "/api/events/",
            self._payload(start, room=self.sanctuary.id, title="Advance hold"),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
