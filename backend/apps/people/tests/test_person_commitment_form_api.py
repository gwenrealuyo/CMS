from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import LessonStudentEnrollment
from apps.people.models import Branch, Person


class PersonCommitmentFormApiTests(TestCase):
    """Person detail exposes commitment status from lesson enrollment."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name="Commitment Branch",
            code="CMT_BR",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="cmt_admin",
            email="cmt_admin@test.com",
            password="testpass123",
            first_name="Cmt",
            last_name="Admin",
            role="ADMIN",
            branch=self.branch,
            status="ACTIVE",
        )
        self.teacher = Person.objects.create_user(
            username="cmt_teacher",
            email="cmt_teacher@test.com",
            password="testpass123",
            first_name="Cmt",
            last_name="Teacher",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _create_student(self, username: str) -> Person:
        return Person.objects.create_user(
            username=username,
            email=f"{username}@test.com",
            password="testpass123",
            first_name="Student",
            last_name=username.title(),
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )

    def test_retrieve_no_enrollment_returns_unsigned(self):
        student = self._create_student("cmt_none")
        response = self.client.get(f"/api/people/people/{student.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data["commitment_form_signed"])
        self.assertIsNone(response.data["commitment_signed_at"])

    def test_retrieve_unsigned_enrollment(self):
        student = self._create_student("cmt_unsigned")
        LessonStudentEnrollment.objects.create(
            student=student,
            teacher=self.teacher,
            assigned_by=self.admin,
            commitment_signed=False,
        )
        response = self.client.get(f"/api/people/people/{student.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data["commitment_form_signed"])
        self.assertIsNone(response.data["commitment_signed_at"])

    def test_retrieve_signed_enrollment(self):
        student = self._create_student("cmt_signed")
        signed_at = timezone.now()
        LessonStudentEnrollment.objects.create(
            student=student,
            teacher=self.teacher,
            assigned_by=self.admin,
            commitment_signed=True,
            commitment_signed_at=signed_at,
            commitment_signed_by=self.admin,
        )
        response = self.client.get(f"/api/people/people/{student.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["commitment_form_signed"])
        self.assertIsNotNone(response.data["commitment_signed_at"])
