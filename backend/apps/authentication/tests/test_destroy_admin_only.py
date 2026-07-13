"""Admin-only destroy across module viewsets (soft-delete rollout)."""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, ModuleCoordinator, Person


class ModuleDestroyAdminOnlyTests(TestCase):
    """Verify coordinators cannot hard-delete; admin can where applicable."""

    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="HQ",
            is_headquarters=True,
            is_active=True,
        )
        cls.admin = Person.objects.create_user(
            username="destroy_admin",
            email="destroy_admin@test.com",
            password="x",
            role="ADMIN",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.coordinator = Person.objects.create_user(
            username="destroy_coord",
            email="destroy_coord@test.com",
            password="x",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=cls.coordinator,
            module=ModuleCoordinator.ModuleType.MINISTRIES,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=None,
            resource_type="",
        )

    def setUp(self):
        self.client = APIClient()

    def test_ministry_coordinator_cannot_delete_but_can_deactivate(self):
        from apps.ministries.models import Ministry

        ministry = Ministry.objects.create(
            name="Worship Team",
            is_active=True,
            scope="NATIONAL",
            code="WORSHIP",
            primary_coordinator=self.coordinator,
        )
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.delete(f"/api/ministries/{ministry.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        res = self.client.patch(
            f"/api/ministries/{ministry.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_events_coordinator_cannot_delete_event(self):
        from apps.events.models import Event
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        event = Event.objects.create(
            title="Test Event",
            start_date=now,
            end_date=now + timedelta(hours=2),
            location="Main",
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=None,
            resource_type="",
        )
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.delete(f"/api/events/{event.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_delete_ministry(self):
        from apps.ministries.models import Ministry

        ministry = Ministry.objects.create(
            name="Outreach", is_active=True, scope="NATIONAL", code="OUTREACH"
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f"/api/ministries/{ministry.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
