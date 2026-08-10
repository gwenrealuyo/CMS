from datetime import date, datetime, timedelta, timezone as dt_timezone

from django.test import TestCase, override_settings
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
from core.datetime_utils import church_calendar_date


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
        # 16:00 UTC is next calendar day in Asia/Manila (UTC+8)
        base_time = timezone.make_aware(datetime(2026, 6, 10, 16, 0, 0))

        for index, lesson in enumerate(lessons):
            progress = self._ensure_progress(lesson)
            completed_at = base_time + timedelta(days=index)
            mark_progress_completed(
                progress,
                completed_by=self.admin,
                completed_at=completed_at,
            )
            latest_completed_date = church_calendar_date(completed_at)

        self.student.refresh_from_db()
        self.assertTrue(self.student.has_finished_lessons)
        self.assertEqual(self.student.lessons_finished_at, latest_completed_date)
        self.assertEqual(
            self.student.lessons_finished_at,
            date(2026, 6, 10 + len(lessons)),
        )

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

        expected_date = date(2026, 6, len(lessons))

        self.student.refresh_from_db()
        self.assertTrue(self.student.has_finished_lessons)
        self.assertEqual(self.student.lessons_finished_at, expected_date)

    def test_session_report_prefers_session_date_over_utc_datetime(self):
        lessons = self._active_latest_lessons()
        self.assertGreater(len(lessons), 0)

        # session_start is Jul 13 UTC evening → Jul 14 in Manila; session_date wins.
        utc_evening = datetime(2026, 7, 13, 16, 30, 0, tzinfo=dt_timezone.utc)

        for lesson in lessons:
            response = self.client.post(
                self.session_reports_url,
                {
                    "student_id": self.student.id,
                    "session_type": "LESSON",
                    "lesson_id": lesson.id,
                    "session_date": "2026-07-14",
                    "session_start": utc_evening.isoformat(),
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.student.refresh_from_db()
        self.assertTrue(self.student.has_finished_lessons)
        self.assertEqual(self.student.lessons_finished_at, date(2026, 7, 14))

        last_progress = (
            PersonLessonProgress.objects.filter(
                person=self.student,
                lesson=lessons[-1],
                status=PersonLessonProgress.Status.COMPLETED,
            )
            .select_related("journey")
            .get()
        )
        self.assertEqual(last_progress.journey.date, date(2026, 7, 14))


@override_settings(CHURCH_TIME_ZONE="Asia/Manila")
class ChurchCalendarDateTests(TestCase):
    def test_utc_evening_is_next_church_day(self):
        utc_evening = datetime(2026, 7, 13, 16, 30, 0, tzinfo=dt_timezone.utc)
        self.assertEqual(church_calendar_date(utc_evening), date(2026, 7, 14))

    def test_plain_date_unchanged(self):
        self.assertEqual(church_calendar_date(date(2026, 7, 14)), date(2026, 7, 14))
