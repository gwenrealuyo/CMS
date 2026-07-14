from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, Person


class PersonFutureDateValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(
            name="Main Branch",
            code="MAIN",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="adminuser",
            email="admin@test.com",
            password="adminpass123",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            branch=self.branch,
            status="ACTIVE",
        )
        self.client.force_authenticate(user=self.admin)

    def _create_payload(self, **overrides):
        payload = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "role": "VISITOR",
            "status": "ONGOING",
            "branch": self.branch.id,
        }
        payload.update(overrides)
        return payload

    def test_create_rejects_future_date_of_birth(self):
        tomorrow = timezone.localdate() + timedelta(days=1)
        response = self.client.post(
            "/api/people/people/",
            self._create_payload(date_of_birth=tomorrow.isoformat()),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details", response.data)
        self.assertIn("date_of_birth", details)
        self.assertEqual(
            str(details["date_of_birth"][0]),
            "Cannot be in the future.",
        )

    def test_create_allows_today_date_of_birth(self):
        today = timezone.localdate()
        response = self.client.post(
            "/api/people/people/",
            self._create_payload(date_of_birth=today.isoformat()),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["date_of_birth"], today.isoformat())

    def test_create_rejects_future_date_first_attended(self):
        tomorrow = timezone.localdate() + timedelta(days=1)
        response = self.client.post(
            "/api/people/people/",
            self._create_payload(date_first_attended=tomorrow.isoformat()),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details", response.data)
        self.assertIn("date_first_attended", details)
