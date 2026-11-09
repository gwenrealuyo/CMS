from datetime import date, datetime, time

from django.test import TestCase
from django.utils import timezone

from apps.lessons.models import Lesson, LessonSessionReport, PersonLessonProgress
from apps.lessons.services import (
    reconcile_person_lessons_finished_at,
    trustworthy_lessons_finished_at,
)
from apps.people.models import Branch, Person
from core.datetime_utils import get_church_timezone


class LessonsFinishedReconcileTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Reconcile Branch",
            code="RECBR",
            is_active=True,
        )
        self.lesson_one = Lesson.objects.create(
            code="rec-lesson-01",
            title="Reconcile Lesson 1",
            order=1,
            is_latest=True,
            is_active=True,
        )
        self.lesson_two = Lesson.objects.create(
            code="rec-lesson-02",
            title="Reconcile Lesson 2",
            order=2,
            is_latest=True,
            is_active=True,
        )
        self.teacher = Person.objects.create_user(
            username="recteacher",
            password="pass12345",
            first_name="Tea",
            last_name="Cher",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )

    def _person(self, username, **extra):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=username.title(),
            last_name="Student",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            **extra,
        )

    def _aware(self, day: date):
        return timezone.make_aware(
            datetime.combine(day, time(12, 0)),
            get_church_timezone(),
        )

    def test_session_reports_win_over_stamped_person_date(self):
        person = self._person(
            "sessfinish",
            has_finished_lessons=True,
            lessons_finished_at=date(2020, 1, 1),
        )
        LessonSessionReport.objects.create(
            student=person,
            teacher=self.teacher,
            lesson=self.lesson_one,
            session_type=LessonSessionReport.SessionType.LESSON,
            session_date=date(2026, 5, 3),
            session_start=self._aware(date(2026, 5, 3)),
        )
        LessonSessionReport.objects.create(
            student=person,
            teacher=self.teacher,
            lesson=self.lesson_two,
            session_type=LessonSessionReport.SessionType.LESSON,
            session_date=date(2026, 5, 17),
            session_start=self._aware(date(2026, 5, 17)),
        )

        self.assertEqual(
            trustworthy_lessons_finished_at(person),
            date(2026, 5, 17),
        )
        action = reconcile_person_lessons_finished_at(person)
        person.refresh_from_db()
        self.assertEqual(action, "set")
        self.assertTrue(person.has_finished_lessons)
        self.assertEqual(person.lessons_finished_at, date(2026, 5, 17))

    def test_uniform_legacy_stamp_clears_person_date(self):
        person = self._person(
            "legacyfinish",
            has_finished_lessons=True,
            lessons_finished_at=date(2024, 6, 1),
        )
        stamped = self._aware(date(2024, 6, 1))
        for lesson in (self.lesson_one, self.lesson_two):
            PersonLessonProgress.objects.create(
                person=person,
                lesson=lesson,
                status=PersonLessonProgress.Status.COMPLETED,
                completed_at=stamped,
            )

        self.assertIsNone(trustworthy_lessons_finished_at(person))
        action = reconcile_person_lessons_finished_at(person)
        person.refresh_from_db()
        self.assertEqual(action, "cleared")
        self.assertTrue(person.has_finished_lessons)
        self.assertIsNone(person.lessons_finished_at)

    def test_flag_only_legacy_clears_date(self):
        person = self._person(
            "flagonly",
            has_finished_lessons=True,
            lessons_finished_at=date(2019, 8, 8),
        )
        action = reconcile_person_lessons_finished_at(person)
        person.refresh_from_db()
        self.assertEqual(action, "cleared")
        self.assertTrue(person.has_finished_lessons)
        self.assertIsNone(person.lessons_finished_at)

    def test_varied_progress_dates_are_trusted(self):
        person = self._person(
            "varied",
            has_finished_lessons=True,
            lessons_finished_at=None,
        )
        PersonLessonProgress.objects.create(
            person=person,
            lesson=self.lesson_one,
            status=PersonLessonProgress.Status.COMPLETED,
            completed_at=self._aware(date(2026, 1, 5)),
        )
        PersonLessonProgress.objects.create(
            person=person,
            lesson=self.lesson_two,
            status=PersonLessonProgress.Status.COMPLETED,
            completed_at=self._aware(date(2026, 2, 9)),
        )

        self.assertEqual(
            trustworthy_lessons_finished_at(person),
            date(2026, 2, 9),
        )
        action = reconcile_person_lessons_finished_at(person)
        person.refresh_from_db()
        self.assertEqual(action, "set")
        self.assertEqual(person.lessons_finished_at, date(2026, 2, 9))
