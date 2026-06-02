from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import Lesson, LessonSessionReport, PersonLessonProgress
from apps.lessons.services import reconcile_student_progress_from_reports
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
        self.lesson_two = Lesson.objects.create(
            code="test-lesson-session-two",
            version_label="v1",
            title="Test Lesson Two",
            order=max(self.lesson.order + 1, 100),
            is_latest=True,
            is_active=True,
        )

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

    def test_delete_lesson_report_reverts_completed_status(self):
        create_response = self.client.post(
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
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        progress = PersonLessonProgress.objects.get(person=self.student, lesson=self.lesson)
        self.assertEqual(progress.status, PersonLessonProgress.Status.COMPLETED)

        delete_url = reverse(
            "lessons:lesson-session-report-detail",
            kwargs={"pk": create_response.data["id"]},
        )
        delete_response = self.client.delete(delete_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        progress.refresh_from_db()
        self.assertEqual(progress.status, PersonLessonProgress.Status.ASSIGNED)
        self.assertIsNone(progress.completed_at)

    def test_delete_final_required_report_breaks_full_completion(self):
        first_report = self.client.post(
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
        second_report = self.client.post(
            self.url,
            {
                "student_id": self.student.id,
                "session_type": LessonSessionReport.SessionType.LESSON,
                "lesson_id": self.lesson_two.id,
                "session_date": "2025-06-02",
                "session_start": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(first_report.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_report.status_code, status.HTTP_201_CREATED)

        completed_before = PersonLessonProgress.objects.filter(
            person=self.student,
            lesson__in=[self.lesson, self.lesson_two],
            status=PersonLessonProgress.Status.COMPLETED,
        ).count()
        self.assertEqual(completed_before, 2)

        delete_url = reverse(
            "lessons:lesson-session-report-detail",
            kwargs={"pk": second_report.data["id"]},
        )
        delete_response = self.client.delete(delete_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        completed_after = PersonLessonProgress.objects.filter(
            person=self.student,
            lesson__in=[self.lesson, self.lesson_two],
            status=PersonLessonProgress.Status.COMPLETED,
        ).count()
        self.assertEqual(completed_after, 1)

    def test_delete_pre_lesson_report_does_not_change_completion(self):
        lesson_report = self.client.post(
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
        pre_lesson_report = self.client.post(
            self.url,
            {
                "student_id": self.student.id,
                "session_type": LessonSessionReport.SessionType.PRE_LESSON,
                "pre_lesson_kind": LessonSessionReport.PreLessonKind.INTRODUCTION,
                "session_date": "2025-06-01",
                "session_start": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(lesson_report.status_code, status.HTTP_201_CREATED)
        self.assertEqual(pre_lesson_report.status_code, status.HTTP_201_CREATED)

        progress = PersonLessonProgress.objects.get(person=self.student, lesson=self.lesson)
        self.assertEqual(progress.status, PersonLessonProgress.Status.COMPLETED)

        delete_url = reverse(
            "lessons:lesson-session-report-detail",
            kwargs={"pk": pre_lesson_report.data["id"]},
        )
        delete_response = self.client.delete(delete_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        progress.refresh_from_db()
        self.assertEqual(progress.status, PersonLessonProgress.Status.COMPLETED)

    def test_legacy_completed_progress_with_zero_reports_is_preserved(self):
        progress = PersonLessonProgress.objects.create(
            person=self.student,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.COMPLETED,
            completed_at=timezone.now(),
        )
        self.assertFalse(
            LessonSessionReport.objects.filter(
                student=self.student,
                session_type=LessonSessionReport.SessionType.LESSON,
            ).exists()
        )

        reconcile_student_progress_from_reports(self.student)

        progress.refresh_from_db()
        self.assertEqual(progress.status, PersonLessonProgress.Status.COMPLETED)
