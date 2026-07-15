"""Family soft-delete permissions and is_active filtering."""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, Family, Person


class FamilySoftDeleteTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="HQ",
            is_headquarters=True,
            is_active=True,
        )
        cls.admin = Person.objects.create_user(
            username="family_admin",
            email="family_admin@test.com",
            password="x",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.pastor = Person.objects.create_user(
            username="family_pastor",
            email="family_pastor@test.com",
            password="x",
            first_name="Pastor",
            last_name="User",
            role="PASTOR",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.active_family = Family.objects.create(name="Active Family", is_active=True)
        cls.inactive_family = Family.objects.create(
            name="Inactive Family", is_active=False
        )

    def setUp(self):
        self.client = APIClient()

    def test_inactive_families_hidden_by_default(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/people/families/")
        data = res.data
        results = data if isinstance(data, list) else data.get("results", [])
        names = {f["name"] for f in results}
        self.assertIn("Active Family", names)
        self.assertNotIn("Inactive Family", names)

    def test_pastor_cannot_delete_family(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.delete(f"/api/people/families/{self.active_family.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_pastor_can_mark_family_inactive(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.patch(
            f"/api/people/families/{self.active_family.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.active_family.refresh_from_db()
        self.assertFalse(self.active_family.is_active)

    def test_admin_can_delete_family(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f"/api/people/families/{self.active_family.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
