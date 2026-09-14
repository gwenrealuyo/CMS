from datetime import date, datetime, time

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.evangelism.models import Conversion
from apps.lessons.models import Lesson, LessonSessionReport
from apps.people.models import Branch, Person
from core.datetime_utils import get_church_timezone


class LessonsStartedFromReportTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTSTART",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="startadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.teacher = Person.objects.create_user(
            username="startteacher",
            password="pass12345",
            first_name="Tessa",
            last_name="Teacher",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.student = Person.objects.create_user(
            username="startstudent",
            password="pass12345",
            first_name="Sam",
            last_name="Student",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            has_finished_lessons=False,
        )
        self.lesson = Lesson.objects.create(
            code="start-lesson-01",
            title="Start Lesson 1",
            order=1,
            is_latest=True,
            is_active=True,
        )
        self.client.force_authenticate(self.admin)

    def _session_start(self, session_date):
        return timezone.make_aware(
            datetime.combine(session_date, time.min),
            get_church_timezone(),
        )

    def _create_report(self, student, session_date, **extra):
        return LessonSessionReport.objects.create(
            teacher=self.teacher,
            student=student,
            session_date=session_date,
            session_start=self._session_start(session_date),
            submitted_by=self.admin,
            **extra,
        )

    def test_first_report_fills_person_and_conversion_dates(self):
        conversion = Conversion.objects.create(
            person=self.student,
            converted_by=self.admin,
            conversion_date=date(2026, 9, 1),
        )
        session_date = date(2026, 9, 10)
        self._create_report(
            self.student,
            session_date,
            session_type=LessonSessionReport.SessionType.PRE_LESSON,
            pre_lesson_kind=LessonSessionReport.PreLessonKind.INTRODUCTION,
        )

        self.student.refresh_from_db()
        conversion.refresh_from_db()
        self.assertEqual(self.student.lessons_started_at, session_date)
        self.assertEqual(conversion.lesson_start_date, session_date)

    def test_lesson_report_also_fills_start_date(self):
        conversion = Conversion.objects.create(
            person=self.student,
            converted_by=self.admin,
            conversion_date=date(2026, 9, 1),
        )
        session_date = date(2026, 9, 12)
        self._create_report(
            self.student,
            session_date,
            lesson=self.lesson,
            session_type=LessonSessionReport.SessionType.LESSON,
        )

        self.student.refresh_from_db()
        conversion.refresh_from_db()
        self.assertEqual(self.student.lessons_started_at, session_date)
        self.assertEqual(conversion.lesson_start_date, session_date)

    def test_finished_lessons_student_is_not_filled(self):
        self.student.has_finished_lessons = True
        self.student.lessons_finished_at = date(2025, 1, 1)
        self.student.save(
            update_fields=["has_finished_lessons", "lessons_finished_at"]
        )
        conversion = Conversion.objects.create(
            person=self.student,
            converted_by=self.admin,
            conversion_date=date(2026, 9, 1),
        )
        self._create_report(self.student, date(2026, 9, 10))

        self.student.refresh_from_db()
        conversion.refresh_from_db()
        self.assertIsNone(self.student.lessons_started_at)
        self.assertIsNone(conversion.lesson_start_date)

    def test_second_report_does_not_overwrite(self):
        first_date = date(2026, 9, 10)
        later_date = date(2026, 9, 17)
        conversion = Conversion.objects.create(
            person=self.student,
            converted_by=self.admin,
            conversion_date=date(2026, 9, 1),
        )
        self._create_report(self.student, first_date)
        self._create_report(self.student, later_date)

        self.student.refresh_from_db()
        conversion.refresh_from_db()
        self.assertEqual(self.student.lessons_started_at, first_date)
        self.assertEqual(conversion.lesson_start_date, first_date)

    def test_updating_report_does_not_fill_or_change_start_date(self):
        conversion = Conversion.objects.create(
            person=self.student,
            converted_by=self.admin,
            conversion_date=date(2026, 9, 1),
            lesson_start_date=date(2026, 8, 1),
        )
        self.student.lessons_started_at = date(2026, 8, 1)
        self.student.save(update_fields=["lessons_started_at"])
        report = self._create_report(self.student, date(2026, 8, 1))
        report.session_date = date(2026, 9, 20)
        report.save(update_fields=["session_date", "updated_at"])

        self.student.refresh_from_db()
        conversion.refresh_from_db()
        self.assertEqual(self.student.lessons_started_at, date(2026, 8, 1))
        self.assertEqual(conversion.lesson_start_date, date(2026, 8, 1))

    def test_create_conversion_copies_person_lessons_started_at(self):
        started = date(2026, 9, 10)
        self.student.lessons_started_at = started
        self.student.save(update_fields=["lessons_started_at"])

        response = self.client.post(
            "/api/evangelism/conversions/",
            {
                "person_id": self.student.id,
                "converted_by_id": self.teacher.id,
                "conversion_date": "2026-09-15",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["lesson_start_date"], started.isoformat())

    def test_patch_conversion_cannot_change_lesson_start_date(self):
        conversion = Conversion.objects.create(
            person=self.student,
            converted_by=self.admin,
            conversion_date=date(2026, 9, 1),
            lesson_start_date=date(2026, 9, 10),
        )
        response = self.client.patch(
            f"/api/evangelism/conversions/{conversion.id}/",
            {
                "lesson_start_date": "2026-01-01",
                "notes": "updated",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        conversion.refresh_from_db()
        self.assertEqual(conversion.lesson_start_date, date(2026, 9, 10))
        self.assertEqual(conversion.notes, "updated")
        self.assertEqual(response.data["lesson_start_date"], "2026-09-10")
