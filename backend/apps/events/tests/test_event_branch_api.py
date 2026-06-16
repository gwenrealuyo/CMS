from datetime import datetime

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.events.models import Event
from apps.people.models import Branch, Person


def make_aware(year, month, day, hour=0, minute=0):
    naive = datetime(year, month, day, hour, minute)
    return timezone.make_aware(naive, timezone.get_current_timezone())


class EventBranchAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="adminuser",
            password="password",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(name="North Campus", code="NORTH")
        self.event = Event.objects.create(
            title="Branch Service",
            description="Weekly gathering",
            start_date=make_aware(2025, 6, 1, 9),
            end_date=make_aware(2025, 6, 1, 11),
            event_type_id="SUNDAY_SERVICE",
            location="North Hall",
            branch=self.branch,
        )
        self.client.force_authenticate(user=self.admin)

    def test_retrieve_event_includes_branch_fields(self):
        url = reverse("events:event-detail", kwargs={"pk": self.event.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["branch"], self.branch.pk)
        self.assertEqual(response.data["branch_name"], "North Campus")

    def test_retrieve_event_without_branch_returns_null_branch(self):
        church_wide = Event.objects.create(
            title="Church-wide Event",
            description="All branches",
            start_date=make_aware(2025, 6, 8, 9),
            end_date=make_aware(2025, 6, 8, 11),
            event_type_id="SUNDAY_SERVICE",
            location="Main Hall",
        )
        url = reverse("events:event-detail", kwargs={"pk": church_wide.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["branch"])
        self.assertIsNone(response.data["branch_name"])
