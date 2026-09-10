from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import LessonStudentEnrollment, LessonTeacherTransfer
from apps.lessons.services import ensure_lesson_enrollment, transfer_lesson_teacher
from apps.people.models import Branch, Person


class PersonDestroyAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="DEL_HQ",
            is_headquarters=True,
            is_active=True,
        )
        cls.admin = Person.objects.create_user(
            username="del_admin",
            email="del_admin@test.com",
            password="x",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.teacher = Person.objects.create_user(
            username="del_teacher",
            email="del_teacher@test.com",
            password="x",
            first_name="Cmt",
            last_name="Teacher",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.other_teacher = Person.objects.create_user(
            username="del_other_teacher",
            email="del_other_teacher@test.com",
            password="x",
            first_name="Other",
            last_name="Teacher",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.student = Person.objects.create_user(
            username="del_student",
            email="del_student@test.com",
            password="x",
            first_name="Maria",
            last_name="Santos",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.plain = Person.objects.create_user(
            username="del_plain",
            email="del_plain@test.com",
            password="x",
            first_name="Plain",
            last_name="Member",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_delete_unencumbered_person(self):
        res = self.client.delete(f"/api/people/people/{self.plain.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Person.objects.filter(pk=self.plain.id).exists())

    def test_admin_cannot_delete_current_lessons_teacher(self):
        LessonStudentEnrollment.objects.create(
            student=self.student,
            teacher=self.teacher,
            assigned_by=self.admin,
        )
        res = self.client.delete(f"/api/people/people/{self.teacher.id}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)
        detail = res.data.get("detail") or res.data.get("message", "")
        self.assertIn("lessons teacher", detail)
        self.assertIn("Maria Santos", detail)
        self.assertTrue(Person.objects.filter(pk=self.teacher.id).exists())

    def test_admin_can_delete_person_in_lessons_teacher_history(self):
        enrollment = ensure_lesson_enrollment(
            self.student,
            teacher=self.teacher,
            assigned_by=self.admin,
        )
        transfer_lesson_teacher(
            enrollment,
            self.other_teacher,
            transferred_by=self.admin,
        )
        enrollment.refresh_from_db()
        self.assertEqual(enrollment.teacher_id, self.other_teacher.id)
        history_ids = list(
            LessonTeacherTransfer.objects.filter(to_teacher=self.teacher).values_list(
                "pk", flat=True
            )
        )
        self.assertTrue(history_ids)

        res = self.client.delete(f"/api/people/people/{self.teacher.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT, res.data)
        self.assertFalse(Person.objects.filter(pk=self.teacher.id).exists())
        for transfer in LessonTeacherTransfer.objects.filter(pk__in=history_ids):
            self.assertIsNone(transfer.to_teacher_id)
