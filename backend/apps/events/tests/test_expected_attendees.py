from datetime import datetime

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

        event = Event.objects.get(pk=response.data["id"])
        self.assertTrue(event.expected_include_active)
        self.assertTrue(event.expected_include_semiactive)
        self.assertTrue(event.expected_include_inactive)
        self.assertTrue(event.expected_include_ongoing_visitors)

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
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["expected_include_active"])
        self.assertTrue(response.data["expected_include_semiactive"])
        self.assertFalse(response.data["expected_include_inactive"])
        self.assertFalse(response.data["expected_include_ongoing_visitors"])

        event.refresh_from_db()
        self.assertFalse(event.expected_include_active)
        self.assertTrue(event.expected_include_semiactive)
        self.assertFalse(event.expected_include_inactive)
        self.assertFalse(event.expected_include_ongoing_visitors)
