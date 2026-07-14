from io import BytesIO
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch
from apps.people.photo_validators import (
    PERSON_PHOTO_MAX_BYTES,
    PERSON_PHOTO_MAX_DIMENSION,
    validate_person_photo,
)

User = get_user_model()


def _make_image_bytes(fmt="JPEG", size=(80, 80), color=(255, 0, 0)):
    buf = BytesIO()
    Image.new("RGB", size, color=color).save(buf, format=fmt)
    return buf.getvalue()


def _make_uploaded_image(
    name="avatar.jpg",
    fmt="JPEG",
    size=(80, 80),
    content_type="image/jpeg",
):
    return SimpleUploadedFile(
        name,
        _make_image_bytes(fmt=fmt, size=size),
        content_type=content_type,
    )


class PersonPhotoValidatorTests(TestCase):
    def test_accepts_jpeg_png_webp(self):
        validate_person_photo(_make_uploaded_image("a.jpg", "JPEG", content_type="image/jpeg"))
        validate_person_photo(
            _make_uploaded_image("a.png", "PNG", content_type="image/png")
        )
        validate_person_photo(
            _make_uploaded_image("a.webp", "WEBP", content_type="image/webp")
        )

    def test_rejects_gif(self):
        photo = _make_uploaded_image("a.gif", "GIF", content_type="image/gif")
        with self.assertRaises(ValidationError):
            validate_person_photo(photo)

    def test_rejects_avif_extension(self):
        photo = SimpleUploadedFile(
            "a.avif", b"not-a-real-avif", content_type="image/avif"
        )
        with self.assertRaises(ValidationError):
            validate_person_photo(photo)

    def test_rejects_oversize(self):
        photo = SimpleUploadedFile(
            "big.jpg",
            b"x" * (PERSON_PHOTO_MAX_BYTES + 1),
            content_type="image/jpeg",
        )
        with self.assertRaises(ValidationError):
            validate_person_photo(photo)

    def test_rejects_over_dimension(self):
        photo = _make_uploaded_image(
            "wide.jpg",
            "JPEG",
            size=(PERSON_PHOTO_MAX_DIMENSION + 1, 50),
            content_type="image/jpeg",
        )
        with self.assertRaises(ValidationError):
            validate_person_photo(photo)

    def test_none_is_allowed(self):
        validate_person_photo(None)

    def test_size_check_uses_file_size_attribute(self):
        mock = MagicMock()
        mock.name = "big.jpg"
        mock.content_type = "image/jpeg"
        mock.size = PERSON_PHOTO_MAX_BYTES + 100
        with self.assertRaises(ValidationError):
            validate_person_photo(mock)


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

    def test_patch_accepts_valid_jpeg(self):
        res = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"photo": _make_uploaded_image()},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res.data.get("photo"))
        self.member.refresh_from_db()
        self.assertTrue(self.member.photo)

    def test_patch_rejects_unsupported_type(self):
        photo = _make_uploaded_image("a.gif", "GIF", content_type="image/gif")
        res = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"photo": photo},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_rejects_over_dimension(self):
        photo = _make_uploaded_image(
            "wide.jpg",
            "JPEG",
            size=(PERSON_PHOTO_MAX_DIMENSION + 1, 40),
            content_type="image/jpeg",
        )
        res = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"photo": photo},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
