from datetime import datetime, timedelta

from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import Event, EventType
from apps.people.models import ModuleCoordinator, Person


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


class RecurringEventDeleteAPITests(APITestCase):
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
        self.admin = Person.objects.create_user(
            username="adminuser",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
        )
        self.coordinator = Person.objects.create_user(
            username="eventcoord",
            password="pass12345",
            first_name="Events",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.member = Person.objects.create_user(
            username="plainmember",
            password="pass12345",
            first_name="Plain",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
        )
        self.start = make_aware_local(2026, 9, 6)
        self.event = Event.objects.create(
            title="Weekly Service",
            description="",
            start_date=self.start,
            end_date=self.start + timedelta(hours=2),
            event_type=self.event_type,
            location="HQ",
            is_recurring=True,
            recurrence_pattern={
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2026-10-04",
                "excluded_dates": [],
            },
            created_by=self.coordinator,
        )

    def test_exclude_occurrence_keeps_series(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/events/{self.event.id}/exclude-occurrence/",
            {"date": "2026-09-13"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.event.refresh_from_db()
        self.assertTrue(Event.objects.filter(pk=self.event.id).exists())
        self.assertIn("2026-09-13", self.event.recurrence_pattern["excluded_dates"])
        occurrence_starts = [
            occ["start_date"][:10] for occ in response.data.get("occurrences", [])
        ]
        self.assertNotIn("2026-09-13", occurrence_starts)

    def test_end_recurrence_removes_selected_and_later(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/events/{self.event.id}/end-recurrence/",
            {"date": "2026-09-20"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.event.refresh_from_db()
        self.assertTrue(Event.objects.filter(pk=self.event.id).exists())
        self.assertEqual(self.event.recurrence_pattern["through"], "2026-09-19")
        occurrence_starts = [
            occ["start_date"][:10] for occ in response.data.get("occurrences", [])
        ]
        self.assertTrue(any(date.startswith("2026-09-06") for date in occurrence_starts))
        self.assertTrue(any(date.startswith("2026-09-13") for date in occurrence_starts))
        self.assertFalse(any(date.startswith("2026-09-20") for date in occurrence_starts))
        self.assertFalse(any(date.startswith("2026-09-27") for date in occurrence_starts))

    def test_end_recurrence_rejects_first_occurrence(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/events/{self.event.id}/end-recurrence/",
            {"date": "2026-09-06"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_member_cannot_exclude_occurrence(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(
            f"/api/events/{self.event.id}/exclude-occurrence/",
            {"date": "2026-09-13"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_coordinator_cannot_delete_series(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.delete(f"/api/events/{self.event.id}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Event.objects.filter(pk=self.event.id).exists())

    def test_admin_can_delete_series(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"/api/events/{self.event.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Event.objects.filter(pk=self.event.id).exists())


class RecurringEventSplitEditAPITests(APITestCase):
    def setUp(self):
        RecurringEventDeleteAPITests.setUp(self)

    def test_split_edit_occurrence_creates_one_off(self):
        self.client.force_authenticate(self.coordinator)
        start = make_aware_local(2026, 9, 13)
        response = self.client.post(
            f"/api/events/{self.event.id}/split-edit/",
            {
                "scope": "occurrence",
                "date": "2026-09-13",
                "title": "Special Service",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "location": "Annex",
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=2)).isoformat(),
                "is_recurring": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.event.refresh_from_db()
        self.assertIn("2026-09-13", self.event.recurrence_pattern["excluded_dates"])
        created_id = response.data["created_event"]["id"]
        created = Event.objects.get(pk=created_id)
        self.assertFalse(created.is_recurring)
        self.assertEqual(created.title, "Special Service")
        self.assertEqual(created.location, "Annex")
        orig_starts = [
            occ["start_date"][:10]
            for occ in response.data["event"].get("occurrences", [])
        ]
        self.assertNotIn("2026-09-13", orig_starts)

    def test_split_edit_following_starts_new_series(self):
        self.client.force_authenticate(self.coordinator)
        start = make_aware_local(2026, 9, 20)
        response = self.client.post(
            f"/api/events/{self.event.id}/split-edit/",
            {
                "scope": "following",
                "date": "2026-09-20",
                "title": "Evening Service",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "location": "HQ",
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=2)).isoformat(),
                "is_recurring": True,
                "recurrence_pattern": {
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-10-04",
                    "excluded_dates": [],
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.event.refresh_from_db()
        self.assertEqual(self.event.recurrence_pattern["through"], "2026-09-19")
        created = Event.objects.get(pk=response.data["created_event"]["id"])
        self.assertTrue(created.is_recurring)
        self.assertEqual(created.title, "Evening Service")
        orig_starts = [
            occ["start_date"][:10]
            for occ in response.data["event"].get("occurrences", [])
        ]
        self.assertFalse(any(value.startswith("2026-09-20") for value in orig_starts))

    def test_split_edit_following_rejects_first_occurrence(self):
        self.client.force_authenticate(self.coordinator)
        start = make_aware_local(2026, 9, 6)
        response = self.client.post(
            f"/api/events/{self.event.id}/split-edit/",
            {
                "scope": "following",
                "date": "2026-09-06",
                "title": "Weekly Service",
                "type": "SUNDAY_SERVICE",
                "location": "HQ",
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=2)).isoformat(),
                "is_recurring": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_member_cannot_split_edit(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(
            f"/api/events/{self.event.id}/split-edit/",
            {
                "scope": "occurrence",
                "date": "2026-09-13",
                "title": "Nope",
                "type": "SUNDAY_SERVICE",
                "location": "HQ",
                "start_date": make_aware_local(2026, 9, 13).isoformat(),
                "end_date": make_aware_local(2026, 9, 13, 11).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
