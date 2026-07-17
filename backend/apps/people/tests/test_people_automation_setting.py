from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, PeopleAutomationSetting, Person


class PeopleAutomationSettingApiTests(TestCase):
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
        self.setting = PeopleAutomationSetting.get_solo()
        self.setting.auto_status_updates_enabled = True
        self.setting.save(update_fields=["auto_status_updates_enabled"])
        self.url = "/api/people/people-automation-settings/"

    def test_member_cannot_get_automation_settings(self):
        user = Person.objects.create_user(
            username="member_pas",
            email="m@example.com",
            password="x",
            role="MEMBER",
            branch=self.branch,
        )
        self.client.force_authenticate(user=user)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_get_and_patch_automation_settings(self):
        admin = Person.objects.create_user(
            username="admin_pas",
            email="a@example.com",
            password="x",
            role="ADMIN",
            branch=self.branch,
        )
        self.client.force_authenticate(user=admin)

        get_res = self.client.get(self.url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertTrue(get_res.data["auto_status_updates_enabled"])

        patch_res = self.client.patch(
            self.url,
            {"auto_status_updates_enabled": False},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertFalse(patch_res.data["auto_status_updates_enabled"])
        self.assertEqual(patch_res.data["updated_by"], admin.id)

        self.setting.refresh_from_db()
        self.assertFalse(self.setting.auto_status_updates_enabled)
