from datetime import datetime

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.events.models import Event
from apps.people.models import Person


def make_aware(year, month, day, hour=0, minute=0):
    naive = datetime(year, month, day, hour, minute)
    return timezone.make_aware(naive, timezone.get_current_timezone())


class EventAuditAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="auditadmin",
            password="password",
            first_name="Audit",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
        )
        self.client.force_authenticate(user=self.admin)
        self.create_url = reverse("events:event-list")

    def _event_payload(self, title="Audit Test Event"):
        return {
            "title": title,
            "description": "Test description",
            "start_date": make_aware(2025, 7, 1, 9).isoformat(),
            "end_date": make_aware(2025, 7, 1, 11).isoformat(),
            "type": "SUNDAY_SERVICE",
            "location": "Main Hall",
            "is_recurring": False,
        }

    def test_create_sets_created_by_and_leaves_updated_by_null(self):
        response = self.client.post(self.create_url, self._event_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created_by"], self.admin.pk)
        self.assertEqual(response.data["created_by_name"], "Audit Admin")
        self.assertIsNotNone(response.data["created_at"])
        self.assertIsNone(response.data["updated_by"])
        self.assertIsNone(response.data["updated_by_name"])

    def test_patch_sets_updated_by_and_updated_at(self):
        event = Event.objects.create(
            title="Existing Event",
            description="Before update",
            start_date=make_aware(2025, 7, 8, 9),
            end_date=make_aware(2025, 7, 8, 11),
            event_type_id="SUNDAY_SERVICE",
            location="Side Hall",
            created_by=self.admin,
        )
        detail_url = reverse("events:event-detail", kwargs={"pk": event.pk})

        response = self.client.patch(
            detail_url,
            {"title": "Updated Event Title"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated_by"], self.admin.pk)
        self.assertEqual(response.data["updated_by_name"], "Audit Admin")
        self.assertIsNotNone(response.data["updated_at"])

    def test_retrieve_includes_audit_fields(self):
        event = Event.objects.create(
            title="Detail Event",
            description="Detail view",
            start_date=make_aware(2025, 7, 15, 9),
            end_date=make_aware(2025, 7, 15, 11),
            event_type_id="SUNDAY_SERVICE",
            location="Chapel",
            created_by=self.admin,
            updated_by=self.admin,
        )
        detail_url = reverse("events:event-detail", kwargs={"pk": event.pk})

        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created_by"], self.admin.pk)
        self.assertEqual(response.data["created_by_name"], "Audit Admin")
        self.assertIsNotNone(response.data["created_at"])
        self.assertEqual(response.data["updated_by"], self.admin.pk)
        self.assertEqual(response.data["updated_by_name"], "Audit Admin")
        self.assertIsNotNone(response.data["updated_at"])
