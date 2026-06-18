"""Journey destroy is limited to ADMIN; other roles may edit but not delete."""

from datetime import date

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, Journey, Person


class JourneyDestroyPermissionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="HQ",
            is_headquarters=True,
            is_active=True,
        )
        cls.admin = Person.objects.create_user(
            username="journey_admin",
            email="journey_admin@test.com",
            password="x",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.pastor = Person.objects.create_user(
            username="journey_pastor",
            email="journey_pastor@test.com",
            password="x",
            first_name="Pastor",
            last_name="User",
            role="PASTOR",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.coordinator = Person.objects.create_user(
            username="journey_coord",
            email="journey_coord@test.com",
            password="x",
            first_name="Coord",
            last_name="User",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.member = Person.objects.create_user(
            username="journey_member",
            email="journey_member@test.com",
            password="x",
            first_name="Member",
            last_name="User",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.target = Person.objects.create_user(
            username="journey_target",
            email="journey_target@test.com",
            password="x",
            first_name="Target",
            last_name="Person",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.journey = Journey.objects.create(
            user=cls.target,
            title="Test baptism",
            date=date(2024, 1, 1),
            type="BAPTISM",
            description="Test",
        )

    def setUp(self):
        self.client = APIClient()

    def test_member_cannot_delete_journey(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.delete(f"/api/people/journeys/{self.journey.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_pastor_cannot_delete_journey(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.delete(f"/api/people/journeys/{self.journey.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordinator_cannot_delete_journey(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.delete(f"/api/people/journeys/{self.journey.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_delete_journey(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f"/api/people/journeys/{self.journey.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
