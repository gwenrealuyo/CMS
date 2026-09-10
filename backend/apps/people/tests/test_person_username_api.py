from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.people.models import Branch, ModuleCoordinator, Person


class PersonUsernameApiTests(TestCase):
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
        self.pastor = Person.objects.create_user(
            username="pastoruser",
            email="pastor@test.com",
            password="pastorpass123",
            first_name="Pastor",
            last_name="User",
            role="PASTOR",
            branch=self.branch,
            status="ACTIVE",
        )
        self.coordinator = Person.objects.create_user(
            username="coorduser",
            email="coord@test.com",
            password="coordpass123",
            first_name="Coord",
            last_name="User",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=None,
            resource_type="",
        )
        self.person = Person.objects.create_user(
            username="do(angono)",
            email="dominic@test.com",
            password="x",
            first_name="Dominic",
            last_name="(Angono)",
            role="VISITOR",
            branch=self.branch,
            status="ONGOING",
        )
        self.cluster = Cluster.objects.create(
            code="AGN",
            name="Angono",
            coordinator=self.coordinator,
            branch=self.branch,
        )
        self.cluster.members.add(self.person, self.coordinator)

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

    def test_create_strips_punctuation_from_generated_username(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/people/people/",
            self._create_payload(first_name="Dominic", last_name="(Angono)"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "doangono")

    def test_create_ignores_client_username(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/people/people/",
            self._create_payload(username="hackedname"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "jadoe")

    def test_admin_can_patch_username(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/people/people/{self.person.id}/",
            {"username": "doangono"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.person.refresh_from_db()
        self.assertEqual(self.person.username, "doangono")

    def test_admin_patch_rejects_conflict_and_invalid_chars(self):
        self.client.force_authenticate(user=self.admin)
        conflict = self.client.patch(
            f"/api/people/people/{self.person.id}/",
            {"username": "coorduser"},
            format="json",
        )
        self.assertEqual(conflict.status_code, status.HTTP_400_BAD_REQUEST)
        details = conflict.data.get("details") or conflict.data
        self.assertIn("username", details)

        invalid = self.client.patch(
            f"/api/people/people/{self.person.id}/",
            {"username": "do(angono)"},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.person.refresh_from_db()
        self.assertEqual(self.person.username, "do(angono)")

    def test_non_admin_patch_does_not_change_username(self):
        for user in (self.pastor, self.coordinator):
            self.client.force_authenticate(user=user)
            response = self.client.patch(
                f"/api/people/people/{self.person.id}/",
                {"username": "doangono"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK, user.username)
            self.person.refresh_from_db()
            self.assertEqual(self.person.username, "do(angono)")
