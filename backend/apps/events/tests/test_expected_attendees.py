from datetime import date, datetime

from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import Event, EventType
from apps.people.models import Branch, ModuleCoordinator, Person


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


class EventExpectedAttendeeFlagsTests(APITestCase):
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
            name="HQ Expected",
            code="HQEXP",
            is_headquarters=True,
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="expectedadmin",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.coordinator = Person.objects.create_user(
            username="expectedcoord",
            password="pass12345",
            first_name="Events",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            water_baptism_date=date(2020, 1, 1),
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )

    def test_create_defaults_expected_flags(self):
        self.client.force_authenticate(user=self.coordinator)
        start = make_aware_local(2026, 8, 2, 9)
        end = make_aware_local(2026, 8, 2, 11)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Sunday Service",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "location": "Main Hall",
                "branch": self.hq.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "is_recurring": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["expected_include_active"])
        self.assertTrue(response.data["expected_include_semiactive"])
        self.assertTrue(response.data["expected_include_inactive"])
        self.assertTrue(response.data["expected_include_ongoing_visitors"])
        self.assertFalse(response.data["track_expected_attendees"])
        self.assertFalse(response.data["allow_cross_branch_attendance"])
        self.assertEqual(response.data["tardy_grace_minutes"], 0)

        event = Event.objects.get(pk=response.data["id"])
        self.assertTrue(event.expected_include_active)
        self.assertTrue(event.expected_include_semiactive)
        self.assertTrue(event.expected_include_inactive)
        self.assertTrue(event.expected_include_ongoing_visitors)
        self.assertFalse(event.track_expected_attendees)
        self.assertFalse(event.allow_cross_branch_attendance)
        self.assertEqual(event.tardy_grace_minutes, 0)

    def test_update_expected_flags_round_trip(self):
        event = Event.objects.create(
            title="Sunday Service",
            description="",
            event_type=self.event_type,
            location="Main Hall",
            branch=self.hq,
            start_date=make_aware_local(2026, 8, 2, 9),
            end_date=make_aware_local(2026, 8, 2, 11),
            created_by=self.coordinator,
        )
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.patch(
            f"/api/events/{event.id}/",
            {
                "expected_include_active": False,
                "expected_include_semiactive": True,
                "expected_include_inactive": False,
                "expected_include_ongoing_visitors": False,
                "track_expected_attendees": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["expected_include_active"])
        self.assertTrue(response.data["expected_include_semiactive"])
        self.assertFalse(response.data["expected_include_inactive"])
        self.assertFalse(response.data["expected_include_ongoing_visitors"])
        self.assertTrue(response.data["track_expected_attendees"])

        event.refresh_from_db()
        self.assertFalse(event.expected_include_active)
        self.assertTrue(event.expected_include_semiactive)
        self.assertFalse(event.expected_include_inactive)
        self.assertFalse(event.expected_include_ongoing_visitors)
        self.assertTrue(event.track_expected_attendees)

    def test_create_with_track_expected_attendees_true(self):
        self.client.force_authenticate(user=self.coordinator)
        start = make_aware_local(2026, 8, 16, 9)
        end = make_aware_local(2026, 8, 16, 11)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Sunday Service",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "location": "Main Hall",
                "branch": self.hq.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "is_recurring": False,
                "track_expected_attendees": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["track_expected_attendees"])
        event = Event.objects.get(pk=response.data["id"])
        self.assertTrue(event.track_expected_attendees)

    def test_create_and_update_allow_cross_branch_attendance(self):
        self.client.force_authenticate(user=self.coordinator)
        start = make_aware_local(2026, 8, 23, 9)
        end = make_aware_local(2026, 8, 23, 11)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Anniversary Sunday",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "location": "Convention Center",
                "branch": self.hq.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "is_recurring": False,
                "allow_cross_branch_attendance": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["allow_cross_branch_attendance"])
        event = Event.objects.get(pk=response.data["id"])
        self.assertTrue(event.allow_cross_branch_attendance)

        response = self.client.patch(
            f"/api/events/{event.id}/",
            {"allow_cross_branch_attendance": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["allow_cross_branch_attendance"])
        event.refresh_from_db()
        self.assertFalse(event.allow_cross_branch_attendance)

    def test_create_defaults_tardy_grace_minutes_zero(self):
        self.client.force_authenticate(user=self.coordinator)
        start = make_aware_local(2026, 8, 9, 9)
        end = make_aware_local(2026, 8, 9, 11)
        response = self.client.post(
            "/api/events/",
            {
                "title": "Sunday Service",
                "description": "",
                "type": "SUNDAY_SERVICE",
                "location": "Main Hall",
                "branch": self.hq.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "is_recurring": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["tardy_grace_minutes"], 0)
        event = Event.objects.get(pk=response.data["id"])
        self.assertEqual(event.tardy_grace_minutes, 0)

    def test_update_tardy_grace_minutes_round_trip(self):
        event = Event.objects.create(
            title="Sunday Service",
            description="",
            event_type=self.event_type,
            location="Main Hall",
            branch=self.hq,
            start_date=make_aware_local(2026, 8, 9, 9),
            end_date=make_aware_local(2026, 8, 9, 11),
            created_by=self.coordinator,
        )
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.patch(
            f"/api/events/{event.id}/",
            {"tardy_grace_minutes": 15},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["tardy_grace_minutes"], 15)
        event.refresh_from_db()
        self.assertEqual(event.tardy_grace_minutes, 15)

    def test_reject_negative_tardy_grace_minutes(self):
        event = Event.objects.create(
            title="Sunday Service",
            description="",
            event_type=self.event_type,
            location="Main Hall",
            branch=self.hq,
            start_date=make_aware_local(2026, 8, 9, 9),
            end_date=make_aware_local(2026, 8, 9, 11),
            created_by=self.coordinator,
        )
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.patch(
            f"/api/events/{event.id}/",
            {"tardy_grace_minutes": -5},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
