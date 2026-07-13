from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, ModuleCoordinator, Person

User = get_user_model()


class PersonCreateWithPasswordTests(TestCase):
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

    def _create_payload(self, **overrides):
        payload = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "role": "MEMBER",
            "status": "ACTIVE",
            "branch": self.branch.id,
        }
        payload.update(overrides)
        return payload

    def test_admin_create_member_auto_generates_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/people/people/",
            {**self._create_payload(), "generate_temporary_password": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("temporary_password", response.data)
        self.assertEqual(response.data["username"], "jadoe")
        self.assertEqual(response.data["email"], "jane.doe@example.com")

        person = Person.objects.get(username="jadoe")
        self.assertTrue(person.has_usable_password())
        self.assertTrue(person.must_change_password)
        self.assertTrue(person.first_login)
        self.assertTrue(
            check_password(response.data["temporary_password"], person.password)
        )

    def test_admin_create_member_with_custom_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/people/people/",
            {
                **self._create_payload(),
                "initial_password": "customPass1",
                "generate_temporary_password": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("temporary_password", response.data)

        person = Person.objects.get(username="jadoe")
        self.assertTrue(check_password("customPass1", person.password))

    def test_admin_create_visitor_does_not_set_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/people/people/",
            self._create_payload(role="VISITOR", status="ONGOING"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("temporary_password", response.data)

        person = Person.objects.get(username="jadoe")
        self.assertEqual(person.password, "")
        self.assertFalse(person.must_change_password)

    def test_admin_create_rejects_weak_custom_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/people/people/",
            {
                **self._create_payload(),
                "initial_password": "short",
                "generate_temporary_password": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_create_requires_password_strategy_for_login_roles(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/people/people/",
            {
                **self._create_payload(),
                "generate_temporary_password": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_coordinator_create_ignores_password_fields(self):
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.post(
            "/api/people/people/",
            {
                **self._create_payload(),
                "initial_password": "customPass1",
                "generate_temporary_password": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("temporary_password", response.data)

        person = Person.objects.get(username="jadoe")
        self.assertFalse(check_password("customPass1", person.password))
        self.assertFalse(person.must_change_password)


class AdminResetUserPasswordTests(TestCase):
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
        self.member = Person.objects.create_user(
            username="memuser",
            email="member@test.com",
            password="oldpass123",
            first_name="Member",
            last_name="User",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        self.visitor = Person.objects.create_user(
            username="visuser",
            email="visitor@test.com",
            password="unused",
            first_name="Visit",
            last_name="User",
            role="VISITOR",
            branch=self.branch,
            status="ONGOING",
        )

    def test_admin_can_reset_password_with_auto_generate(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/auth/admin/users/{self.member.id}/reset-password/",
            {"generate_temporary_password": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("temporary_password", response.data)

        self.member.refresh_from_db()
        self.assertTrue(self.member.must_change_password)
        self.assertTrue(self.member.first_login)
        self.assertTrue(
            check_password(response.data["temporary_password"], self.member.password)
        )

    def test_admin_can_reset_password_with_custom_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/auth/admin/users/{self.member.id}/reset-password/",
            {"new_password": "newPass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("temporary_password", response.data)

        self.member.refresh_from_db()
        self.assertTrue(check_password("newPass123", self.member.password))

    def test_admin_cannot_reset_visitor_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/auth/admin/users/{self.visitor.id}/reset-password/",
            {"generate_temporary_password": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_cannot_reset_password(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            f"/api/auth/admin/users/{self.member.id}/reset-password/",
            {"generate_temporary_password": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
