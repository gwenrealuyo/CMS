from datetime import datetime, timedelta

from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import Event, EventRoom, EventType
from apps.people.models import Branch, ModuleCoordinator, Person


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


class RoomBookingAPITests(APITestCase):
    def setUp(self):
        self.sunday, _ = EventType.objects.get_or_create(
            code="SUNDAY_SERVICE",
            defaults={
                "label": "Sunday Service",
                "sort_order": 10,
                "color": "#1e40af",
                "is_system": True,
            },
        )
        self.clustering, _ = EventType.objects.get_or_create(
            code="CLUSTERING",
            defaults={
                "label": "Clustering",
                "sort_order": 50,
                "color": "#0d9488",
                "is_system": True,
            },
        )
        self.hq = Branch.objects.create(
            name="HQ Book",
            code="HQBOOK",
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

        self.events_coord = self._user("ebookcoord", "Events", "Coord")
        ModuleCoordinator.objects.create(
            person=self.events_coord,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.events_senior = self._user("ebooksenior", "Events", "Senior")
        ModuleCoordinator.objects.create(
            person=self.events_senior,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        self.cluster_coord = self._user("cbookcoord", "Cluster", "Coord")
        ModuleCoordinator.objects.create(
            person=self.cluster_coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.cluster_senior = self._user("cbooksenior", "Cluster", "Senior")
        ModuleCoordinator.objects.create(
            person=self.cluster_senior,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        self.dual = self._user("dualbook", "Dual", "Lead")
        ModuleCoordinator.objects.create(
            person=self.dual,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        ModuleCoordinator.objects.create(
            person=self.dual,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.reporter = self._user("reporterbook", "Cluster", "Reporter")
        ModuleCoordinator.objects.create(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
        )
        self.ss_teacher = self._user("ssteacherbook", "SS", "Teacher")
        ModuleCoordinator.objects.create(
            person=self.ss_teacher,
            module=ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        self.bible_sharer = self._user("biblebook", "Evan", "Sharer")
        ModuleCoordinator.objects.create(
            person=self.bible_sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
        )
        self.events_teacher = self._user("eventeacherbook", "Events", "Teacher")
        ModuleCoordinator.objects.create(
            person=self.events_teacher,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        self.member = self._user("memberbook", "Plain", "Member")
        self.pastor = Person.objects.create_user(
            username="pastorbook",
            password="pass12345",
            first_name="Pastor",
            last_name="User",
            role="PASTOR",
            status="ACTIVE",
            branch=self.hq,
        )
        self.admin = Person.objects.create_user(
            username="adminbook",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )

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
            "title": "Clustering",
            "description": "",
            "type": "CLUSTERING",
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

    def _list_ids(self, response):
        data = response.data
        rows = data["results"] if isinstance(data, dict) and "results" in data else data
        return {row["id"] for row in rows}

    def test_rejects_same_room_overlapping_types(self):
        start = make_aware_local(2026, 9, 6, 9)
        first = self.client.post("/api/events/", self._payload(start), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        duplicate = self.client.post(
            "/api/events/",
            self._payload(
                start,
                type="SUNDAY_SERVICE",
                title="Sunday Service",
            ),
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        self.assertIn("room", self._details(duplicate))

    def test_allows_same_room_non_overlapping(self):
        morning = make_aware_local(2026, 9, 6, 9)
        later = make_aware_local(2026, 9, 6, 11)
        first = self.client.post("/api/events/", self._payload(morning), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client.post(
            "/api/events/",
            self._payload(later, title="After clustering"),
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)

    def test_allows_different_rooms_overlapping(self):
        start = make_aware_local(2026, 9, 6, 9)
        first = self.client.post("/api/events/", self._payload(start), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        other = self.client.post(
            "/api/events/",
            self._payload(
                start,
                title="Hall clustering",
                room=self.hall.id,
            ),
            format="json",
        )
        self.assertEqual(other.status_code, 201, other.data)

    def test_different_rooms_overlapping_sunday_services_still_rejected(self):
        start = make_aware_local(2026, 9, 13, 9)
        first = self.client.post(
            "/api/events/",
            self._payload(start, type="SUNDAY_SERVICE", title="Morning Service"),
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)

        other = self.client.post(
            "/api/events/",
            self._payload(
                start,
                type="SUNDAY_SERVICE",
                title="Overflow Service",
                room=self.hall.id,
            ),
            format="json",
        )
        self.assertEqual(other.status_code, 400, other.data)
        self.assertIn("start_date", self._details(other))

    def test_offsite_and_room_at_same_time_allowed(self):
        start = make_aware_local(2026, 9, 6, 14)
        roomed = self.client.post("/api/events/", self._payload(start), format="json")
        self.assertEqual(roomed.status_code, 201, roomed.data)

        offsite = self.client.post(
            "/api/events/",
            self._payload(
                start,
                title="Park clustering",
                room=None,
                location="City Park",
            ),
            format="json",
        )
        self.assertEqual(offsite.status_code, 201, offsite.data)

    def test_weekly_series_in_room_blocks_later_one_off(self):
        start = make_aware_local(2026, 9, 6, 9)
        series = self.client.post(
            "/api/events/",
            self._payload(
                start,
                is_recurring=True,
                recurrence_pattern={
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-10-04",
                    "excluded_dates": [],
                },
            ),
            format="json",
        )
        self.assertEqual(series.status_code, 201, series.data)

        later = make_aware_local(2026, 9, 20, 9)
        one_off = self.client.post(
            "/api/events/",
            self._payload(later, title="One-off clustering"),
            format="json",
        )
        self.assertEqual(one_off.status_code, 400, one_off.data)
        self.assertIn("room", self._details(one_off))

    def test_pending_booking_holds_the_room(self):
        start = make_aware_local(2026, 9, 7, 9)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Cluster booking"),
            format="json",
        )
        self.assertEqual(pending.status_code, 201, pending.data)
        self.assertEqual(pending.data["booking_status"], "pending")

        self.client.force_authenticate(self.events_coord)
        blocked = self.client.post(
            "/api/events/",
            self._payload(start, title="Events takeover"),
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertIn("room", self._details(blocked))

    def test_rejected_booking_frees_the_room(self):
        start = make_aware_local(2026, 9, 8, 9)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Rejected later"),
            format="json",
        )
        self.assertEqual(pending.status_code, 201, pending.data)
        event_id = pending.data["id"]

        self.client.force_authenticate(self.events_coord)
        rejected = self.client.post(f"/api/events/{event_id}/reject/", {}, format="json")
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data["booking_status"], "rejected")

        replacement = self.client.post(
            "/api/events/",
            self._payload(start, title="Replacement"),
            format="json",
        )
        self.assertEqual(replacement.status_code, 201, replacement.data)
        self.assertEqual(replacement.data["booking_status"], "approved")

    def test_cluster_coordinator_creates_pending(self):
        start = make_aware_local(2026, 9, 9, 9)
        self.client.force_authenticate(self.cluster_coord)
        created = self.client.post(
            "/api/events/",
            self._payload(start, title="Cluster request"),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["booking_status"], "pending")

    def test_cluster_senior_creates_pending(self):
        start = make_aware_local(2026, 9, 9, 14)
        self.client.force_authenticate(self.cluster_senior)
        created = self.client.post(
            "/api/events/",
            self._payload(start, title="Senior cluster request"),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["booking_status"], "pending")

    def test_events_coordinator_and_senior_create_approved(self):
        start = make_aware_local(2026, 9, 10, 9)
        created = self.client.post(
            "/api/events/",
            self._payload(start, title="Events live"),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["booking_status"], "approved")

        self.client.force_authenticate(self.events_senior)
        later = make_aware_local(2026, 9, 10, 14)
        senior = self.client.post(
            "/api/events/",
            self._payload(later, title="Senior live"),
            format="json",
        )
        self.assertEqual(senior.status_code, 201, senior.data)
        self.assertEqual(senior.data["booking_status"], "approved")

    def test_pastor_creates_approved(self):
        start = make_aware_local(2026, 9, 11, 9)
        self.client.force_authenticate(self.pastor)
        created = self.client.post(
            "/api/events/",
            self._payload(start, title="Pastor live"),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["booking_status"], "approved")

    def test_dual_assignment_creates_approved(self):
        start = make_aware_local(2026, 9, 12, 9)
        self.client.force_authenticate(self.dual)
        created = self.client.post(
            "/api/events/",
            self._payload(start, title="Dual live"),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["booking_status"], "approved")

    def test_reporter_teacher_bible_sharer_member_cannot_create(self):
        start = make_aware_local(2026, 9, 13, 9)
        for user in (
            self.reporter,
            self.ss_teacher,
            self.bible_sharer,
            self.events_teacher,
            self.member,
        ):
            self.client.force_authenticate(user)
            response = self.client.post(
                "/api/events/",
                self._payload(start, title=f"Blocked {user.username}"),
                format="json",
            )
            self.assertEqual(response.status_code, 403, response.data)

    def test_requester_cannot_approve_events_roles_can(self):
        start = make_aware_local(2026, 9, 14, 9)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Needs approval"),
            format="json",
        )
        self.assertEqual(pending.status_code, 201, pending.data)
        event_id = pending.data["id"]

        denied = self.client.post(f"/api/events/{event_id}/approve/", {}, format="json")
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.events_coord)
        approved = self.client.post(
            f"/api/events/{event_id}/approve/", {}, format="json"
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["booking_status"], "approved")

    def test_events_senior_can_reject(self):
        start = make_aware_local(2026, 9, 15, 9)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Senior reject"),
            format="json",
        )
        event_id = pending.data["id"]

        self.client.force_authenticate(self.events_senior)
        rejected = self.client.post(
            f"/api/events/{event_id}/reject/",
            {"review_note": "Room reserved for service"},
            format="json",
        )
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data["booking_status"], "rejected")
        self.assertEqual(rejected.data["review_note"], "Room reserved for service")

    def test_approve_fails_if_conflict_appeared(self):
        start = make_aware_local(2026, 9, 16, 9)
        end = start + timedelta(hours=2)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Will conflict"),
            format="json",
        )
        self.assertEqual(pending.status_code, 201, pending.data)
        event_id = pending.data["id"]

        Event.objects.create(
            title="Sneaky occupancy",
            start_date=start,
            end_date=end,
            event_type=self.clustering,
            location=self.sanctuary.name,
            room=self.sanctuary,
            branch=self.hq,
            booking_status=Event.BookingStatus.APPROVED,
        )

        self.client.force_authenticate(self.events_coord)
        failed = self.client.post(f"/api/events/{event_id}/approve/", {}, format="json")
        self.assertEqual(failed.status_code, 400, failed.data)
        self.assertIn("room", self._details(failed))
        event = Event.objects.get(pk=event_id)
        self.assertEqual(event.booking_status, Event.BookingStatus.PENDING)

    def test_requester_can_edit_and_cancel_own_pending(self):
        start = make_aware_local(2026, 9, 17, 9)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Own pending"),
            format="json",
        )
        event_id = pending.data["id"]

        patched = self.client.patch(
            f"/api/events/{event_id}/",
            {"title": "Updated pending"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertEqual(patched.data["title"], "Updated pending")
        self.assertEqual(patched.data["booking_status"], "pending")

        deleted = self.client.delete(f"/api/events/{event_id}/")
        self.assertEqual(deleted.status_code, 204)

    def test_requester_room_time_change_repends_approved_own_event(self):
        start = make_aware_local(2026, 9, 18, 9)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Approved then moved"),
            format="json",
        )
        event_id = pending.data["id"]

        self.client.force_authenticate(self.events_coord)
        approved = self.client.post(
            f"/api/events/{event_id}/approve/", {}, format="json"
        )
        self.assertEqual(approved.status_code, 200, approved.data)

        self.client.force_authenticate(self.cluster_coord)
        moved_start = make_aware_local(2026, 9, 18, 14)
        moved = self.client.patch(
            f"/api/events/{event_id}/",
            {
                "start_date": moved_start.isoformat(),
                "end_date": (moved_start + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertEqual(moved.data["booking_status"], "pending")

    def test_requester_cannot_edit_other_events(self):
        start = make_aware_local(2026, 9, 19, 9)
        created = self.client.post(
            "/api/events/",
            self._payload(start, title="Events owned"),
            format="json",
        )
        event_id = created.data["id"]

        self.client.force_authenticate(self.cluster_coord)
        patched = self.client.patch(
            f"/api/events/{event_id}/",
            {"title": "Hijack"},
            format="json",
        )
        self.assertEqual(patched.status_code, 403)

    def test_requester_cannot_manage_rooms_or_types(self):
        self.client.force_authenticate(self.cluster_coord)
        room = self.client.post(
            "/api/event-rooms/",
            {"name": "Sneaky Room", "branch": self.hq.id},
            format="json",
        )
        self.assertEqual(room.status_code, 403)

        event_type = self.client.post(
            "/api/event-types/",
            {"code": "sneaky_type", "label": "Sneaky", "color": "#111111"},
            format="json",
        )
        self.assertEqual(event_type.status_code, 403)

    def test_members_do_not_see_pending_requester_and_approver_do(self):
        start = make_aware_local(2026, 9, 20, 9)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Visible pending"),
            format="json",
        )
        event_id = pending.data["id"]

        listed = self.client.get("/api/events/")
        self.assertIn(event_id, self._list_ids(listed))

        self.client.force_authenticate(self.member)
        hidden = self.client.get("/api/events/")
        self.assertNotIn(event_id, self._list_ids(hidden))

        self.client.force_authenticate(self.events_coord)
        queue = self.client.get("/api/events/?booking_status=pending")
        self.assertIn(event_id, self._list_ids(queue))

    def test_split_edit_occurrence_still_allowed_for_events_writer(self):
        start = make_aware_local(2026, 9, 6, 18)
        series = self.client.post(
            "/api/events/",
            self._payload(
                start,
                title="Evening series",
                is_recurring=True,
                recurrence_pattern={
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-10-04",
                    "excluded_dates": [],
                },
            ),
            format="json",
        )
        self.assertEqual(series.status_code, 201, series.data)
        event_id = series.data["id"]
        occurrence_start = make_aware_local(2026, 9, 13, 18)

        response = self.client.post(
            f"/api/events/{event_id}/split-edit/",
            {
                "scope": "occurrence",
                "date": "2026-09-13",
                "title": "Special evening",
                "description": "",
                "type": "CLUSTERING",
                "room": self.sanctuary.id,
                "location": "",
                "start_date": occurrence_start.isoformat(),
                "end_date": (occurrence_start + timedelta(hours=2)).isoformat(),
                "is_recurring": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_pending_booking_notifies_events_coordinators(self):
        start = make_aware_local(2026, 9, 21, 9)
        self.client.force_authenticate(self.cluster_coord)
        pending = self.client.post(
            "/api/events/",
            self._payload(start, title="Notify coordinators"),
            format="json",
        )
        self.assertEqual(pending.status_code, 201, pending.data)
        event_id = pending.data["id"]

        self.client.force_authenticate(self.events_coord)
        feed = self.client.get("/api/notifications/")
        self.assertEqual(feed.status_code, 200, feed.data)
        types = {item["type"] for item in feed.data["items"]}
        self.assertIn("event_booking_pending", types)
        hrefs = {item["href"] for item in feed.data["items"]}
        self.assertIn("/events?booking=pending", hrefs)

        self.client.force_authenticate(self.cluster_coord)
        requester_feed = self.client.get("/api/notifications/")
        requester_types = {item["type"] for item in requester_feed.data["items"]}
        self.assertNotIn("event_booking_pending", requester_types)

        self.client.force_authenticate(self.events_senior)
        approved = self.client.post(
            f"/api/events/{event_id}/approve/", {}, format="json"
        )
        self.assertEqual(approved.status_code, 200, approved.data)

        self.client.force_authenticate(self.cluster_coord)
        activity = self.client.get("/api/notifications/")
        activity_types = {item["type"] for item in activity.data["items"]}
        self.assertIn("event_booking_approved", activity_types)
