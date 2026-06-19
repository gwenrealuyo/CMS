from datetime import datetime, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.lessons.models import Lesson, PersonLessonProgress
from apps.lessons.services import (
    mark_progress_completed,
    revert_progress_completion,
    sync_person_lessons_finished_from_progress,
)
from apps.people.models import ModuleCoordinator, ModuleSetting, Person


class PersonLessonsSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        ModuleSetting.objects.update_or_create(
            module=ModuleCoordinator.ModuleType.LESSONS,
            defaults={"is_enabled": True},
        )

        self.admin = Person.objects.create_user(
            username="syncadmin",
            password="password",
            first_name="Sync",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
        )
        self.student = Person.objects.create_user(
            username="syncstudent",
            password="password",
            first_name="Sync",
            last_name="Student",
            role="MEMBER",
            status="ACTIVE",
        )
        self.client.force_authenticate(user=self.admin)
        self.session_reports_url = reverse("lessons:lesson-session-report-list")

    def _active_latest_lessons(self):
        return list(Lesson.objects.filter(is_latest=True, is_active=True).order_by("order"))

    def _ensure_progress(self, lesson, *, completed_at=None):
        progress, _ = PersonLessonProgress.objects.get_or_create(
            person=self.student,
            lesson=lesson,
            defaults={
                "status": PersonLessonProgress.Status.ASSIGNED,
            },
        )
        return progress

    def test_sets_flags_on_last_lesson_completion(self):
        lessons = self._active_latest_lessons()
        self.assertGreater(len(lessons), 0)

        latest_completed_date = None
        base_time = timezone.make_aware(datetime(2026, 6, 10, 12, 0, 0))

        for index, lesson in enumerate(lessons):
            progress = self._ensure_progress(lesson)
            completed_at = base_time + timedelta(days=index)
            mark_progress_completed(
                progress,
                completed_by=self.admin,
                completed_at=completed_at,
            )
            latest_completed_date = completed_at.date()

        self.student.refresh_from_db()
        self.assertTrue(self.student.has_finished_lessons)
        self.assertEqual(self.student.lessons_finished_at, latest_completed_date)

    def test_clears_flags_on_revert(self):
        lessons = self._active_latest_lessons()
        base_time = timezone.make_aware(datetime(2026, 6, 10, 12, 0, 0))

        progresses = []
        for index, lesson in enumerate(lessons):
            progress = self._ensure_progress(lesson)
            mark_progress_completed(
                progress,
                completed_by=self.admin,
                completed_at=base_time + timedelta(days=index),
            )
            progresses.append(progress)

        self.student.refresh_from_db()
        self.assertTrue(self.student.has_finished_lessons)

        last_progress = progresses[-1]
        previous_status = last_progress.status
        last_progress.status = PersonLessonProgress.Status.ASSIGNED
        last_progress.save(update_fields=["status", "updated_at"])
        revert_progress_completion(last_progress, previous_status=previous_status)

        self.student.refresh_from_db()
        self.assertFalse(self.student.has_finished_lessons)
        self.assertIsNone(self.student.lessons_finished_at)

    def test_skips_legacy_only_persons(self):
        legacy_person = Person.objects.create_user(
            username="legacyperson",
            password="password",
            first_name="Legacy",
            last_name="Person",
            role="MEMBER",
            status="ACTIVE",
            has_finished_lessons=True,
            lessons_finished_at=timezone.now().date(),
        )

        sync_person_lessons_finished_from_progress(legacy_person)

        legacy_person.refresh_from_db()
        self.assertTrue(legacy_person.has_finished_lessons)
        self.assertIsNotNone(legacy_person.lessons_finished_at)

    def test_session_report_path_sets_person_fields(self):
        lessons = self._active_latest_lessons()
        self.assertGreater(len(lessons), 0)

        for index, lesson in enumerate(lessons, start=1):
            response = self.client.post(
                self.session_reports_url,
                {
                    "student_id": self.student.id,
                    "session_type": "LESSON",
                    "lesson_id": lesson.id,
                    "session_date": f"2026-06-{index:02d}",
                    "session_start": timezone.now().isoformat(),
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        expected_date = max(
            progress.completed_at.date()
            for progress in PersonLessonProgress.objects.filter(
                person=self.student,
                lesson_id__in=[lesson.id for lesson in lessons],
                status=PersonLessonProgress.Status.COMPLETED,
            )
            if progress.completed_at is not None
        )

        self.student.refresh_from_db()
        self.assertTrue(self.student.has_finished_lessons)
        self.assertEqual(self.student.lessons_finished_at, expected_date)
