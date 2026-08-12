from datetime import date

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import LessonStudentEnrollment
from apps.people.models import Branch, Journey, Person


class PersonCommitmentFormApiTests(TestCase):
    """Person detail exposes and writes commitment status via lesson enrollment."""

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

    def _create_student(self, username: str, **extra) -> Person:
        defaults = dict(
            username=username,
            email=f"{username}@test.com",
            password="testpass123",
            first_name="Student",
            last_name=username.title(),
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        defaults.update(extra)
        return Person.objects.create_user(**defaults)

    def test_retrieve_no_enrollment_returns_unsigned(self):
        student = self._create_student("cmt_none")
        response = self.client.get(f"/api/people/people/{student.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data["commitment_form_signed"])
        self.assertIsNone(response.data["commitment_signed_at"])
        self.assertFalse(response.data["has_lesson_enrollment"])
        self.assertIsNone(response.data["lesson_teacher_display_name"])

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
        self.assertTrue(response.data["has_lesson_enrollment"])
        self.assertIn("Teacher", response.data["lesson_teacher_display_name"])

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

    def test_retrieve_historical_teacher_display_name(self):
        student = self._create_student("cmt_hist_read")
        LessonStudentEnrollment.objects.create(
            student=student,
            teacher=None,
            historical_teacher_first_name="Old",
            historical_teacher_last_name="Mentor",
            assigned_by=self.admin,
        )
        response = self.client.get(f"/api/people/people/{student.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["lesson_teacher_display_name"], "Old Mentor")

    def test_patch_sign_with_teacher_creates_enrollment(self):
        student = self._create_student(
            "cmt_sign_teacher",
            has_finished_lessons=True,
            lessons_finished_at=date(2024, 6, 1),
        )
        response = self.client.patch(
            f"/api/people/people/{student.id}/",
            {
                "commitment_form_signed": True,
                "commitment_signed_at": "2024-06-15",
                "lesson_teacher_id": self.teacher.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["commitment_form_signed"])
        self.assertTrue(response.data["has_lesson_enrollment"])

        enrollment = LessonStudentEnrollment.objects.get(student=student)
        self.assertTrue(enrollment.commitment_signed)
        self.assertEqual(enrollment.teacher_id, self.teacher.id)
        self.assertEqual(enrollment.commitment_signed_by_id, self.admin.id)
        self.assertTrue(
            Journey.objects.filter(
                user=student, type="NOTE", title="Commitment Form Signed"
            ).exists()
        )

    def test_patch_sign_with_historical_teacher_names(self):
        student = self._create_student(
            "cmt_sign_hist",
            has_finished_lessons=True,
            lessons_finished_at=date(2024, 6, 1),
        )
        response = self.client.patch(
            f"/api/people/people/{student.id}/",
            {
                "commitment_form_signed": True,
                "commitment_signed_at": "2024-07-01",
                "historical_teacher_first_name": "Former",
                "historical_teacher_last_name": "Teacher",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["commitment_form_signed"])
        self.assertEqual(response.data["lesson_teacher_display_name"], "Former Teacher")

        enrollment = LessonStudentEnrollment.objects.get(student=student)
        self.assertIsNone(enrollment.teacher_id)
        self.assertEqual(enrollment.historical_teacher_first_name, "Former")
        self.assertEqual(enrollment.historical_teacher_last_name, "Teacher")
        self.assertTrue(enrollment.commitment_signed)

    def test_patch_finished_lessons_alone_does_not_sign_commitment(self):
        student = self._create_student("cmt_finish_only")
        response = self.client.patch(
            f"/api/people/people/{student.id}/",
            {
                "has_finished_lessons": True,
                "lessons_finished_at": "2024-05-01",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data["commitment_form_signed"])
        self.assertFalse(
            LessonStudentEnrollment.objects.filter(student=student).exists()
        )

    def test_patch_uncheck_clears_commitment(self):
        student = self._create_student(
            "cmt_clear",
            has_finished_lessons=True,
            lessons_finished_at=date(2024, 6, 1),
        )
        LessonStudentEnrollment.objects.create(
            student=student,
            teacher=self.teacher,
            assigned_by=self.admin,
            commitment_signed=True,
            commitment_signed_at=timezone.now(),
            commitment_signed_by=self.admin,
        )
        Journey.objects.create(
            user=student,
            type="NOTE",
            title="Commitment Form Signed",
            description="Signed",
            date=date(2024, 6, 15),
            verified_by=self.admin,
        )

        response = self.client.patch(
            f"/api/people/people/{student.id}/",
            {"commitment_form_signed": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(response.data["commitment_form_signed"])

        enrollment = LessonStudentEnrollment.objects.get(student=student)
        self.assertFalse(enrollment.commitment_signed)
        self.assertIsNone(enrollment.commitment_signed_at)
        self.assertTrue(
            LessonStudentEnrollment.objects.filter(student=student).exists()
        )
        self.assertFalse(
            Journey.objects.filter(
                user=student, type="NOTE", title="Commitment Form Signed"
            ).exists()
        )

    def test_patch_sign_without_finished_lessons_fails(self):
        student = self._create_student("cmt_no_finish")
        response = self.client.patch(
            f"/api/people/people/{student.id}/",
            {
                "commitment_form_signed": True,
                "commitment_signed_at": "2024-06-15",
                "lesson_teacher_id": self.teacher.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details") or response.data
        self.assertIn("commitment_form_signed", details)

    def test_patch_sign_without_teacher_or_names_fails(self):
        student = self._create_student(
            "cmt_no_teacher",
            has_finished_lessons=True,
            lessons_finished_at=date(2024, 6, 1),
        )
        response = self.client.patch(
            f"/api/people/people/{student.id}/",
            {
                "commitment_form_signed": True,
                "commitment_signed_at": "2024-06-15",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details") or response.data
        self.assertIn("lesson_teacher_id", details)

    def test_patch_sign_without_signed_date_fails(self):
        student = self._create_student(
            "cmt_no_date",
            has_finished_lessons=True,
            lessons_finished_at=date(2024, 6, 1),
        )
        response = self.client.patch(
            f"/api/people/people/{student.id}/",
            {
                "commitment_form_signed": True,
                "lesson_teacher_id": self.teacher.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details") or response.data
        self.assertIn("commitment_signed_at", details)

    def test_patch_sign_existing_enrollment_ignores_teacher_fields(self):
        student = self._create_student(
            "cmt_existing",
            has_finished_lessons=True,
            lessons_finished_at=date(2024, 6, 1),
        )
        other_teacher = Person.objects.create_user(
            username="cmt_other_teacher",
            email="cmt_other@test.com",
            password="testpass123",
            first_name="Other",
            last_name="Teacher",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        LessonStudentEnrollment.objects.create(
            student=student,
            teacher=self.teacher,
            assigned_by=self.admin,
            commitment_signed=False,
        )
        response = self.client.patch(
            f"/api/people/people/{student.id}/",
            {
                "commitment_form_signed": True,
                "commitment_signed_at": "2024-08-01",
                "lesson_teacher_id": other_teacher.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        enrollment = LessonStudentEnrollment.objects.get(student=student)
        self.assertTrue(enrollment.commitment_signed)
        self.assertEqual(enrollment.teacher_id, self.teacher.id)
