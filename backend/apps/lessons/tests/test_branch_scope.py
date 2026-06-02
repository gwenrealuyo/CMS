from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import (
    Lesson,
    LessonSessionReport,
    LessonStudentEnrollment,
    PersonLessonProgress,
)
from apps.people.models import Branch, ModuleCoordinator, ModuleSetting, Person
from django.test import TestCase


class LessonsBranchScopeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        ModuleSetting.objects.update_or_create(
            module=ModuleCoordinator.ModuleType.LESSONS,
            defaults={"is_enabled": True},
        )

        self.branch_a = Branch.objects.create(name="Lessons A", code="BR_LSA")
        self.branch_b = Branch.objects.create(name="Lessons B", code="BR_LSB")

        self.admin = Person.objects.create_user(
            username="lessonsbranchadmin",
            password="password",
            first_name="Branch",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
        )
        self.teacher = Person.objects.create_user(
            username="lessonsbranchteacher",
            password="password",
            first_name="Branch",
            last_name="Teacher",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch_a,
        )
        ModuleCoordinator.objects.create(
            person=self.teacher,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )

        self.student_a = Person.objects.create_user(
            username="lessonsstudenta",
            password="password",
            first_name="Student",
            last_name="A",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch_a,
        )
        self.student_b = Person.objects.create_user(
            username="lessonsstudentb",
            password="password",
            first_name="Student",
            last_name="B",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch_b,
        )

        self.lesson = Lesson.objects.filter(is_latest=True, is_active=True).first()
        if self.lesson is None:
            self.lesson = Lesson.objects.create(
                code="test-branch-lesson",
                version_label="v1",
                title="Branch Test Lesson",
                order=99,
                is_latest=True,
                is_active=True,
            )

        PersonLessonProgress.objects.create(
            person=self.student_a,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.ASSIGNED,
            assigned_at=timezone.now(),
        )
        PersonLessonProgress.objects.create(
            person=self.student_b,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.ASSIGNED,
            assigned_at=timezone.now(),
        )

        LessonStudentEnrollment.objects.create(
            student=self.student_a,
            teacher=self.teacher,
            is_active=True,
        )

        self.progress_url = reverse("lessons:lesson-progress-list")
        self.session_url = reverse("lessons:lesson-session-report-list")
        self.enrollment_url = reverse("lessons:lesson-enrollment-list")

    def test_admin_filters_progress_by_branch_id(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.progress_url, {"branch_id": self.branch_a.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        person_ids = {row["person"]["id"] for row in response.data if row.get("person")}
        self.assertIn(self.student_a.id, person_ids)
        self.assertNotIn(self.student_b.id, person_ids)

    def test_teacher_cannot_override_branch_param(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get(
            self.progress_url, {"branch_id": self.branch_b.id}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        person_ids = {row["person"]["id"] for row in response.data if row.get("person")}
        self.assertIn(self.student_a.id, person_ids)
        self.assertNotIn(self.student_b.id, person_ids)

    def test_user_without_branch_gets_empty_progress(self):
        user_no_branch = Person.objects.create_user(
            username="lessonsnobranch",
            password="password",
            first_name="No",
            last_name="Branch",
            role="MEMBER",
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=user_no_branch,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        self.client.force_authenticate(user=user_no_branch)
        response = self.client.get(self.progress_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_admin_filters_session_reports_by_branch(self):
        LessonSessionReport.objects.create(
            student=self.student_a,
            teacher=self.teacher,
            session_type=LessonSessionReport.SessionType.PRE_LESSON,
            pre_lesson_kind=LessonSessionReport.PreLessonKind.INTRODUCTION,
            session_date=timezone.now().date(),
            session_start=timezone.now(),
        )
        LessonSessionReport.objects.create(
            student=self.student_b,
            teacher=self.admin,
            session_type=LessonSessionReport.SessionType.PRE_LESSON,
            pre_lesson_kind=LessonSessionReport.PreLessonKind.INTRODUCTION,
            session_date=timezone.now().date(),
            session_start=timezone.now(),
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.session_url, {"branch_id": self.branch_a.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student_ids = {row["student"]["id"] for row in response.data if row.get("student")}
        self.assertIn(self.student_a.id, student_ids)
        self.assertNotIn(self.student_b.id, student_ids)

    def test_admin_filters_enrollments_by_branch(self):
        LessonStudentEnrollment.objects.create(
            student=self.student_b,
            teacher=self.admin,
            is_active=True,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.enrollment_url, {"branch_id": self.branch_b.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student_ids = {row["student"]["id"] for row in response.data if row.get("student")}
        self.assertIn(self.student_b.id, student_ids)
        self.assertNotIn(self.student_a.id, student_ids)
