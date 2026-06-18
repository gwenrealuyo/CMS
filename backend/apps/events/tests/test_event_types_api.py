from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.events.models import Event, EventType
from apps.people.models import ModuleCoordinator, Person


class EventTypeAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="etype_admin",
            password="x",
            role="ADMIN",
            status="ACTIVE",
        )
        self.member = Person.objects.create_user(
            username="etype_member",
            password="x",
            role="MEMBER",
            status="ACTIVE",
        )
        self.events_coord = Person.objects.create_user(
            username="etype_coord",
            password="x",
            role="MEMBER",
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=self.events_coord,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )

    def test_list_includes_color_and_sort_order(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(reverse("event_types:event-type-list"))
        self.assertEqual(response.status_code, 200)
        sunday = next(row for row in response.data if row["code"] == "SUNDAY_SERVICE")
        self.assertEqual(sunday["label"], "Sunday Service")
        self.assertTrue(sunday["color"].startswith("#"))
        self.assertIn("sort_order", sunday)
        self.assertTrue(sunday["is_system"])

    def test_create_custom_type(self):
        self.client.force_authenticate(user=self.events_coord)
        response = self.client.post(
            reverse("event_types:event-type-list"),
            {
                "code": "YOUTH_NIGHT",
                "label": "Youth Night",
                "color": "#ff00aa",
                "sort_order": 150,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["label"], "Youth Night")
        self.assertEqual(response.data["color"], "#FF00AA")
        self.assertFalse(response.data["is_system"])

    def test_update_label_and_color(self):
        event_type = EventType.objects.create(
            code="CUSTOM_TYPE",
            label="Custom",
            color="#111111",
            sort_order=200,
        )
        self.client.force_authenticate(user=self.events_coord)
        response = self.client.patch(
            reverse("event_types:event-type-detail", kwargs={"code": event_type.code}),
            {"label": "Updated Custom", "color": "#222222"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        event_type.refresh_from_db()
        self.assertEqual(event_type.label, "Updated Custom")
        self.assertEqual(event_type.color, "#222222")

    def test_cannot_delete_system_type(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(
            reverse("event_types:event-type-detail", kwargs={"code": "SUNDAY_SERVICE"})
        )
        self.assertEqual(response.status_code, 400)
        self.assertTrue(EventType.objects.filter(code="SUNDAY_SERVICE").exists())

    def test_cannot_delete_type_in_use(self):
        event_type = EventType.objects.create(
            code="IN_USE_TYPE",
            label="In Use",
            color="#333333",
            sort_order=210,
        )
        Event.objects.create(
            title="Sample",
            description="",
            start_date="2025-06-01T09:00:00Z",
            end_date="2025-06-01T11:00:00Z",
            event_type=event_type,
            location="HQ",
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(
            reverse("event_types:event-type-detail", kwargs={"code": event_type.code})
        )
        self.assertEqual(response.status_code, 400)

    def test_cannot_delete_type_used_as_first_activity(self):
        event_type = EventType.objects.create(
            code="FIRST_ACTIVITY_TYPE",
            label="First Activity Type",
            color="#444444",
            sort_order=220,
        )
        Person.objects.create_user(
            username="first_activity_person",
            password="x",
            role="MEMBER",
            status="ACTIVE",
            first_activity_attended_id=event_type.code,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(
            reverse("event_types:event-type-detail", kwargs={"code": event_type.code})
        )
        self.assertEqual(response.status_code, 400)
        self.assertTrue(EventType.objects.filter(code=event_type.code).exists())

    def test_member_cannot_create_type(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            reverse("event_types:event-type-list"),
            {
                "code": "BLOCKED",
                "label": "Blocked",
                "color": "#abcdef",
                "sort_order": 999,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_legacy_events_types_endpoint_returns_full_payload(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/events/types/")
        self.assertEqual(response.status_code, 200)
        sunday = next(row for row in response.data if row["code"] == "SUNDAY_SERVICE")
        self.assertIn("color", sunday)
