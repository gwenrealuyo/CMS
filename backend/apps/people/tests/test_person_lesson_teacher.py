from datetime import date

from rest_framework.test import APITestCase

from apps.lessons.models import LessonStudentEnrollment, PersonLessonProgress
from apps.lessons.services import ensure_lesson_enrollment
from apps.ministries.ncc import _ensure_ncc_membership
from apps.people.models import Branch, Person
from core.datetime_utils import church_today


class PersonLessonTeacherAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTNCC",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="nccteachadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.teacher = Person.objects.create_user(
            username="nccteacher",
            password="pass12345",
            first_name="Tessa",
            last_name="Teacher",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.other_teacher = Person.objects.create_user(
            username="nccotherteacher",
            password="pass12345",
            first_name="Owen",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.student = Person.objects.create_user(
            username="nccstudent",
            password="pass12345",
            first_name="Sam",
            last_name="Student",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            has_finished_lessons=False,
        )
        _ensure_ncc_membership(self.teacher, self.branch)
        _ensure_ncc_membership(self.other_teacher, self.branch)
        self.client.force_authenticate(self.admin)

    def _patch_student(self, **payload):
        return self.client.patch(
            f"/api/people/people/{self.student.id}/",
            payload,
            format="json",
        )

    def _error_details(self, response):
        if isinstance(response.data, dict) and "details" in response.data:
            return response.data["details"]
        return response.data

    def test_assign_teacher_without_finished_lessons_creates_enrollment(self):
        response = self._patch_student(lesson_teacher_id=self.teacher.id)
        self.assertEqual(response.status_code, 200, response.data)
        self.student.refresh_from_db()
        self.assertFalse(self.student.has_finished_lessons)
        self.assertIsNone(self.student.lessons_finished_at)
        enrollment = LessonStudentEnrollment.objects.get(student=self.student)
        self.assertEqual(enrollment.teacher_id, self.teacher.id)
        self.assertTrue(response.data["has_lesson_enrollment"])
        self.assertIn("Tessa", response.data["lesson_teacher_display_name"])
        self.assertEqual(PersonLessonProgress.objects.filter(person=self.student).count(), 0)

    def test_teacher_is_optional_when_not_finished(self):
        response = self._patch_student(first_name="Samuel")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(
            LessonStudentEnrollment.objects.filter(student=self.student).exists()
        )
        self.assertFalse(response.data["has_lesson_enrollment"])
        self.assertIsNone(response.data["lesson_teacher_display_name"])

    def test_historical_teacher_rejected_when_not_finished(self):
        response = self._patch_student(
            historical_teacher_first_name="Former",
            historical_teacher_last_name="Teacher",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("historical_teacher_first_name", self._error_details(response))

    def test_teacher_must_be_on_ncc_roster(self):
        outsider = Person.objects.create_user(
            username="nccoutsider",
            password="pass12345",
            first_name="Out",
            last_name="Sider",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        response = self._patch_student(lesson_teacher_id=outsider.id)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("lesson_teacher_id", self._error_details(response))

    def test_cannot_assign_self_as_teacher(self):
        _ensure_ncc_membership(self.student, self.branch)
        response = self._patch_student(lesson_teacher_id=self.student.id)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("lesson_teacher_id", self._error_details(response))

    def test_existing_enrollment_is_not_rewritten(self):
        ensure_lesson_enrollment(self.student, self.teacher, assigned_by=self.admin)
        response = self._patch_student(lesson_teacher_id=self.other_teacher.id)
        self.assertEqual(response.status_code, 200, response.data)
        enrollment = LessonStudentEnrollment.objects.get(student=self.student)
        self.assertEqual(enrollment.teacher_id, self.teacher.id)

    def test_finished_without_enrollment_still_requires_teacher(self):
        response = self._patch_student(
            has_finished_lessons=True,
            lessons_finished_at=church_today().isoformat(),
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("lesson_teacher_id", self._error_details(response))

    def test_finished_with_teacher_still_backfills_progress(self):
        finished_on = date(2024, 1, 15)
        response = self._patch_student(
            has_finished_lessons=True,
            lessons_finished_at=finished_on.isoformat(),
            lesson_teacher_id=self.teacher.id,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.student.refresh_from_db()
        self.assertTrue(self.student.has_finished_lessons)
        enrollment = LessonStudentEnrollment.objects.get(student=self.student)
        self.assertEqual(enrollment.teacher_id, self.teacher.id)
        self.assertGreater(
            PersonLessonProgress.objects.filter(
                person=self.student,
                status=PersonLessonProgress.Status.COMPLETED,
            ).count(),
            0,
        )

    def test_create_person_with_teacher_without_finished_lessons(self):
        response = self.client.post(
            "/api/people/people/",
            {
                "first_name": "Nina",
                "last_name": "New",
                "role": "MEMBER",
                "status": "ACTIVE",
                "branch": self.branch.id,
                "lesson_teacher_id": self.teacher.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        created = Person.objects.get(id=response.data["id"])
        self.assertFalse(created.has_finished_lessons)
        enrollment = LessonStudentEnrollment.objects.get(student=created)
        self.assertEqual(enrollment.teacher_id, self.teacher.id)
        self.assertEqual(PersonLessonProgress.objects.filter(person=created).count(), 0)
        self.assertTrue(response.data["has_lesson_enrollment"])
