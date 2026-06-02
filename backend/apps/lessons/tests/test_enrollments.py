from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import (
    Lesson,
    LessonStudentEnrollment,
    LessonTeacherTransfer,
    PersonLessonProgress,
)
from apps.people.models import ModuleCoordinator, ModuleSetting, Person


class LessonEnrollmentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        ModuleSetting.objects.update_or_create(
            module=ModuleCoordinator.ModuleType.LESSONS,
            defaults={"is_enabled": True},
        )

        self.admin = Person.objects.create_user(
            username="lessonsadmin",
            password="password",
            first_name="Lessons",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
        )
        self.teacher_a = Person.objects.create_user(
            username="teachera",
            password="password",
            first_name="Teacher",
            last_name="A",
            role="COORDINATOR",
            status="ACTIVE",
        )
        self.teacher_b = Person.objects.create_user(
            username="teacherb",
            password="password",
            first_name="Teacher",
            last_name="B",
            role="COORDINATOR",
            status="ACTIVE",
        )
        self.student = Person.objects.create_user(
            username="student1",
            password="password",
            first_name="Student",
            last_name="One",
            role="MEMBER",
            status="ACTIVE",
        )
        self.other_student = Person.objects.create_user(
            username="student2",
            password="password",
            first_name="Student",
            last_name="Two",
            role="MEMBER",
            status="ACTIVE",
        )

        ModuleCoordinator.objects.create(
            person=self.teacher_a,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )

        self.lesson = Lesson.objects.filter(is_latest=True, is_active=True).first()
        if self.lesson is None:
            self.lesson = Lesson.objects.create(
                code="test-lesson",
                version_label="v1",
                title="Test Lesson",
                order=99,
                is_latest=True,
                is_active=True,
            )

    def test_assign_with_teacher_id_creates_enrollment(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("lessons:lesson-progress-assign")
        response = self.client.post(
            url,
            {
                "lesson_id": self.lesson.id,
                "person_ids": [self.student.id],
                "teacher_id": self.teacher_a.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        enrollment = LessonStudentEnrollment.objects.get(student=self.student)
        self.assertEqual(enrollment.teacher_id, self.teacher_a.id)
        self.assertTrue(
            LessonTeacherTransfer.objects.filter(enrollment=enrollment).exists()
        )

    def test_reassign_lessons_does_not_change_teacher(self):
        LessonStudentEnrollment.objects.create(
            student=self.student,
            teacher=self.teacher_a,
        )
        self.client.force_authenticate(user=self.admin)
        url = reverse("lessons:lesson-progress-assign")
        response = self.client.post(
            url,
            {
                "lesson_id": self.lesson.id,
                "person_ids": [self.student.id],
                "teacher_id": self.teacher_b.id,
            },
            format="json",
        )
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        enrollment = LessonStudentEnrollment.objects.get(student=self.student)
        self.assertEqual(enrollment.teacher_id, self.teacher_a.id)

    def test_transfer_updates_teacher_and_creates_history(self):
        enrollment = LessonStudentEnrollment.objects.create(
            student=self.student,
            teacher=self.teacher_a,
        )
        self.client.force_authenticate(user=self.admin)
        url = reverse(
            "lessons:lesson-enrollment-transfer",
            kwargs={"pk": enrollment.pk},
        )
        response = self.client.post(
            url,
            {"teacher_id": self.teacher_b.id, "note": "Handoff"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        enrollment.refresh_from_db()
        self.assertEqual(enrollment.teacher_id, self.teacher_b.id)
        transfer = LessonTeacherTransfer.objects.filter(enrollment=enrollment).latest(
            "created_at"
        )
        self.assertEqual(transfer.from_teacher_id, self.teacher_a.id)
        self.assertEqual(transfer.to_teacher_id, self.teacher_b.id)
        self.assertEqual(transfer.note, "Handoff")

    def test_lessons_teacher_sees_only_assigned_students_in_progress(self):
        LessonStudentEnrollment.objects.create(
            student=self.student,
            teacher=self.teacher_a,
        )
        PersonLessonProgress.objects.create(
            person=self.student,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.ASSIGNED,
        )
        PersonLessonProgress.objects.create(
            person=self.other_student,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.ASSIGNED,
        )
        LessonStudentEnrollment.objects.create(
            student=self.other_student,
            teacher=self.teacher_b,
        )

        self.client.force_authenticate(user=self.teacher_a)
        url = reverse("lessons:lesson-progress-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        person_ids = {
            row["person"]["id"]
            for row in response.data
            if row.get("person") and row["person"].get("id")
        }
        self.assertEqual(person_ids, {self.student.id})
