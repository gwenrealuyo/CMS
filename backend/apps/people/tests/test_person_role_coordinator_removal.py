"""
Tests covering the removal of the COORDINATOR base role.

People/Family write access is now granted to ADMIN, PASTOR, or anyone holding a
ModuleCoordinator assignment (regardless of base role). Deletes are limited to
ADMIN/PASTOR, and the COORDINATOR role is no longer a valid choice.
"""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.people.models import Branch, ModuleCoordinator, Person


class PersonRoleCoordinatorRemovalTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="HQ",
            is_headquarters=True,
            is_active=True,
        )

        cls.admin = Person.objects.create_user(
            username="admin_role",
            email="admin@test.com",
            password="x",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.pastor = Person.objects.create_user(
            username="pastor_role",
            email="pastor@test.com",
            password="x",
            first_name="Pastor",
            last_name="User",
            role="PASTOR",
            branch=cls.branch,
            status="ACTIVE",
        )
        # Member who coordinates a cluster (capability via assignment, not role)
        cls.coordinator = Person.objects.create_user(
            username="coord_member",
            email="coord@test.com",
            password="x",
            first_name="Coord",
            last_name="Member",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        # Plain member with no assignments
        cls.plain_member = Person.objects.create_user(
            username="plain_member",
            email="plain@test.com",
            password="x",
            first_name="Plain",
            last_name="Member",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        # Target person inside the coordinator's cluster scope
        cls.target = Person.objects.create_user(
            username="target_member",
            email="target@test.com",
            password="x",
            first_name="Target",
            last_name="Member",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )

        cls.cluster = Cluster.objects.create(
            code="C1", name="Cluster One", branch=cls.branch
        )
        cls.cluster.members.add(cls.coordinator, cls.target)

        ModuleCoordinator.objects.create(
            person=cls.coordinator,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=cls.cluster.id,
            resource_type="cluster",
        )

    def setUp(self):
        self.client = APIClient()

    def test_member_with_assignment_can_update_person_in_scope(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.patch(
            f"/api/people/people/{self.target.id}/",
            {"phone": "+63-900-000-0000"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_plain_member_cannot_update_person(self):
        self.client.force_authenticate(user=self.plain_member)
        res = self.client.patch(
            f"/api/people/people/{self.target.id}/",
            {"phone": "+63-900-111-1111"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_with_assignment_cannot_delete_person(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.delete(f"/api/people/people/{self.target.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_pastor_can_delete_person(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.delete(f"/api/people/people/{self.target.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_api_rejects_coordinator_role_on_create(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Person",
                "role": "COORDINATOR",
                "branch": self.branch.id,
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", self._field_errors(res))

    def test_api_rejects_coordinator_role_on_update(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/people/people/{self.target.id}/",
            {"role": "COORDINATOR"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", self._field_errors(res))

    @staticmethod
    def _field_errors(res):
        """Field errors may be wrapped in a custom error envelope under 'details'."""
        if isinstance(res.data, dict) and "details" in res.data:
            return res.data["details"]
        return res.data
