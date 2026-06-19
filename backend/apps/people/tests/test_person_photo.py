from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch

User = get_user_model()


@override_settings(MEDIA_ROOT="/tmp/cms_test_media")
class PersonPhotoClearTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="HQ",
            is_headquarters=True,
            is_active=True,
        )
        cls.admin = User.objects.create_user(
            username="photo_admin",
            email="photo_admin@test.com",
            password="x",
            first_name="Photo",
            last_name="Admin",
            role="ADMIN",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.member = User.objects.create_user(
            username="photo_member",
            email="photo_member@test.com",
            password="x",
            first_name="Photo",
            last_name="Member",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_patch_photo_null_clears_person_photo(self):
        photo = SimpleUploadedFile(
            "avatar.jpg", b"fake-image-bytes", content_type="image/jpeg"
        )
        self.member.photo = photo
        self.member.save(update_fields=["photo"])
        self.assertTrue(self.member.photo)

        res = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"photo": None},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNone(res.data.get("photo"))

        self.member.refresh_from_db()
        self.assertFalse(self.member.photo)
