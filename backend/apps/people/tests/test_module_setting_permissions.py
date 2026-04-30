from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, ModuleSetting, Person


class ModuleSettingPermissionsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="HQ",
            is_headquarters=True,
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.setting = ModuleSetting.objects.first()
        self.assertIsNotNone(self.setting, "Migration should seed module settings")

    def test_coordinator_can_list_module_settings(self):
        user = Person.objects.create_user(
            username="coord_ms",
            email="c@example.com",
            password="x",
            role="COORDINATOR",
            branch=self.branch,
        )
        self.client.force_authenticate(user=user)
        res = self.client.get("/api/people/module-settings/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 1)

    def test_coordinator_cannot_patch_module_settings(self):
        user = Person.objects.create_user(
            username="coord_ms2",
            email="c2@example.com",
            password="x",
            role="COORDINATOR",
            branch=self.branch,
        )
        self.client.force_authenticate(user=user)
        res = self.client.patch(
            f"/api/people/module-settings/{self.setting.id}/",
            {"is_enabled": not self.setting.is_enabled},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_patch_module_settings(self):
        admin = Person.objects.create_user(
            username="admin_ms",
            email="a@example.com",
            password="x",
            role="ADMIN",
            branch=self.branch,
        )
        self.client.force_authenticate(user=admin)
        next_enabled = not self.setting.is_enabled
        res = self.client.patch(
            f"/api/people/module-settings/{self.setting.id}/",
            {"is_enabled": next_enabled},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["is_enabled"], next_enabled)
