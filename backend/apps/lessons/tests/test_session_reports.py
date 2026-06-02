from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import Lesson, LessonSessionReport, PersonLessonProgress
from apps.people.models import ModuleCoordinator, ModuleSetting, Person


class LessonSessionReportAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        ModuleSetting.objects.update_or_create(
            module=ModuleCoordinator.ModuleType.LESSONS,
            defaults={"is_enabled": True},
        )

        self.admin = Person.objects.create_user(
            username="sessionadmin",
            password="password",
            first_name="Session",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
        )
        self.student = Person.objects.create_user(
            username="sessionstudent",
            password="password",
            first_name="Session",
            last_name="Student",
            role="MEMBER",
            status="ACTIVE",
        )

        self.lesson = Lesson.objects.filter(is_latest=True, is_active=True).first()
        if self.lesson is None:
            self.lesson = Lesson.objects.create(
                code="test-lesson-session",
                version_label="v1",
                title="Test Lesson",
                order=99,
                is_latest=True,
                is_active=True,
            )

        self.client.force_authenticate(user=self.admin)
        self.url = reverse("lessons:lesson-session-report-list")
        self.session_start = timezone.now().isoformat()

    def test_pre_lesson_does_not_complete_progress(self):
        response = self.client.post(
            self.url,
            {
                "student_id": self.student.id,
                "session_type": LessonSessionReport.SessionType.PRE_LESSON,
                "pre_lesson_kind": LessonSessionReport.PreLessonKind.INTRODUCTION,
                "session_date": "2025-06-01",
                "session_start": self.session_start,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["session_type"], "PRE_LESSON")
        self.assertIsNone(response.data["lesson"])

        self.assertFalse(
            PersonLessonProgress.objects.filter(
                person=self.student,
                status=PersonLessonProgress.Status.COMPLETED,
            ).exists()
        )

    def test_lesson_session_completes_progress(self):
        response = self.client.post(
            self.url,
            {
                "student_id": self.student.id,
                "session_type": LessonSessionReport.SessionType.LESSON,
                "lesson_id": self.lesson.id,
                "session_date": "2025-06-01",
                "session_start": self.session_start,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        progress = PersonLessonProgress.objects.filter(
            person=self.student, lesson=self.lesson
        ).first()
        self.assertIsNotNone(progress)
        self.assertEqual(progress.status, PersonLessonProgress.Status.COMPLETED)

    def test_pre_lesson_other_requires_remarks(self):
        response = self.client.post(
            self.url,
            {
                "student_id": self.student.id,
                "session_type": LessonSessionReport.SessionType.PRE_LESSON,
                "pre_lesson_kind": LessonSessionReport.PreLessonKind.OTHER,
                "session_date": "2025-06-01",
                "session_start": self.session_start,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details", response.data)
        self.assertIn("remarks", details)
