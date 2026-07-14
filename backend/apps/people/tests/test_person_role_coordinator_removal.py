"""
Tests covering the removal of the COORDINATOR base role.

People/Family write access is now granted to ADMIN, PASTOR, or anyone holding a
ModuleCoordinator assignment (regardless of base role). Person deletes are limited
to ADMIN, and the COORDINATOR role is no longer a valid choice.
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
        # Out of Member people scope → 404; privileged permission would be 403.
        self.assertIn(
            res.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_plain_member_can_update_own_profile(self):
        self.client.force_authenticate(user=self.plain_member)
        res = self.client.patch(
            f"/api/people/people/{self.plain_member.id}/",
            {"phone": "+63-900-222-2222", "address": "123 Own Street"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.plain_member.refresh_from_db()
        self.assertEqual(self.plain_member.phone, "+63-900-222-2222")
        self.assertEqual(self.plain_member.address, "123 Own Street")

    def test_plain_member_self_update_ignores_role_and_status(self):
        self.client.force_authenticate(user=self.plain_member)
        original_role = self.plain_member.role
        original_status = self.plain_member.status
        res = self.client.patch(
            f"/api/people/people/{self.plain_member.id}/",
            {
                "phone": "+63-900-333-3333",
                "role": "PASTOR",
                "status": "INACTIVE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.plain_member.refresh_from_db()
        self.assertEqual(self.plain_member.phone, "+63-900-333-3333")
        self.assertEqual(self.plain_member.role, original_role)
        self.assertEqual(self.plain_member.status, original_status)

    def test_member_with_assignment_cannot_delete_person(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.delete(f"/api/people/people/{self.target.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_pastor_cannot_delete_person(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.delete(f"/api/people/people/{self.target.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_delete_person(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f"/api/people/people/{self.target.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_coordinator_can_patch_person_status_deceased(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.patch(
            f"/api/people/people/{self.target.id}/",
            {"status": "DECEASED"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertEqual(self.target.status, "DECEASED")

    def test_coordinator_can_create_member(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Member",
                "role": "MEMBER",
                "branch": self.branch.id,
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["role"], "MEMBER")

    def test_coordinator_cannot_create_pastor(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Pastor",
                "role": "PASTOR",
                "branch": self.branch.id,
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", self._field_errors(res))

    def test_coordinator_cannot_create_admin(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Admin",
                "role": "ADMIN",
                "branch": self.branch.id,
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", self._field_errors(res))

    def test_pastor_can_create_pastor(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Pastor",
                "role": "PASTOR",
                "branch": self.branch.id,
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["role"], "PASTOR")

    def test_pastor_cannot_create_admin(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Admin",
                "role": "ADMIN",
                "branch": self.branch.id,
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", self._field_errors(res))

    def test_admin_can_create_admin(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Admin",
                "role": "ADMIN",
                "branch": self.branch.id,
                "status": "ACTIVE",
                "generate_temporary_password": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["role"], "ADMIN")

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

    def test_reporter_only_can_create_visitor_not_member(self):
        reporter = Person.objects.create_user(
            username="reporter_only",
            email="reporter@test.com",
            password="x",
            first_name="Rep",
            last_name="Orter",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        cluster = Cluster.objects.create(
            code="CLU-REP",
            name="Reporter Cluster",
            branch=self.branch,
        )
        ModuleCoordinator.objects.create(
            person=reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=cluster.id,
            resource_type="Cluster",
        )
        self.client.force_authenticate(user=reporter)
        visitor_res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Visitor",
                "role": "VISITOR",
                "branch": self.branch.id,
                "status": "ACTIVE",
                "generate_temporary_password": True,
            },
            format="json",
        )
        self.assertEqual(visitor_res.status_code, status.HTTP_201_CREATED)
        member_res = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Member",
                "role": "MEMBER",
                "branch": self.branch.id,
                "status": "ACTIVE",
                "generate_temporary_password": True,
            },
            format="json",
        )
        self.assertEqual(member_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", self._field_errors(member_res))

    @staticmethod
    def _field_errors(res):
        """Field errors may be wrapped in a custom error envelope under 'details'."""
        if isinstance(res.data, dict) and "details" in res.data:
            return res.data["details"]
        return res.data
