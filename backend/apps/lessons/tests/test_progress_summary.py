from datetime import date, datetime

from django.test import TestCase
from django.utils import timezone

from apps.lessons.models import Lesson, PersonLessonProgress
from apps.lessons.services import _as_aware_datetime, build_lesson_progress_summary
from apps.people.models import Branch, Person
from core.datetime_utils import get_church_timezone


class LessonProgressSummaryYearTests(TestCase):
    def setUp(self):
        self.year = timezone.now().year
        self.branch = Branch.objects.create(
            name="Summary Branch",
            code="SUMBR",
            is_active=True,
        )
        self.lesson_one = Lesson.objects.create(
            code="summary-lesson-01",
            title="Summary Lesson 1",
            order=101,
            is_latest=True,
            is_active=True,
        )
        self.lesson_two = Lesson.objects.create(
            code="summary-lesson-02",
            title="Summary Lesson 2",
            order=102,
            is_latest=True,
            is_active=True,
        )
        self.lessons = [self.lesson_one, self.lesson_two]

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

    def _complete_course(self, person, *, completed_on=None):
        completed_at = (
            _as_aware_datetime(completed_on) if completed_on is not None else None
        )
        for lesson in self.lessons:
            PersonLessonProgress.objects.create(
                person=person,
                lesson=lesson,
                status=PersonLessonProgress.Status.COMPLETED,
                completed_at=completed_at,
            )

    def _assign_course(self, person):
        for lesson in self.lessons:
            PersonLessonProgress.objects.create(
                person=person,
                lesson=lesson,
                status=PersonLessonProgress.Status.ASSIGNED,
            )

    def _summary(self, year=None):
        return build_lesson_progress_summary(
            PersonLessonProgress.objects.filter(person__branch=self.branch),
            year=year or self.year,
        )

    def test_historical_completed_at_is_excluded_even_if_assigned_this_year(self):
        person = self._person("historical")
        self._complete_course(person, completed_on=date(self.year - 1, 6, 15))

        payload = self._summary()

        self.assertEqual(payload["overall"]["COMPLETED"], 0)
        self.assertEqual(payload["total_participants"], 0)

    def test_this_year_completed_at_counts(self):
        person = self._person("thisyear")
        self._complete_course(person, completed_on=date(self.year, 3, 1))

        payload = self._summary()

        self.assertEqual(payload["overall"]["COMPLETED"], 1)
        self.assertEqual(payload["total_participants"], 1)

    def test_null_completed_at_uses_lessons_finished_at(self):
        historical = self._person(
            "importold",
            lessons_finished_at=date(self.year - 1, 1, 20),
        )
        this_year = self._person(
            "importnew",
            lessons_finished_at=date(self.year, 4, 10),
        )
        self._complete_course(historical)
        self._complete_course(this_year)

        payload = self._summary()

        self.assertEqual(payload["overall"]["COMPLETED"], 1)
        self.assertEqual(payload["total_participants"], 1)

    def test_undated_bulk_import_is_excluded(self):
        person = self._person("undated")
        self._complete_course(person)

        payload = self._summary()

        self.assertEqual(payload["overall"]["COMPLETED"], 0)
        self.assertEqual(payload["total_participants"], 0)

    def test_ongoing_students_stay_in_yearly_cohort(self):
        assigned = self._person("assigned")
        ongoing = self._person("ongoing")
        self._assign_course(assigned)
        PersonLessonProgress.objects.create(
            person=ongoing,
            lesson=self.lesson_one,
            status=PersonLessonProgress.Status.COMPLETED,
            completed_at=_as_aware_datetime(date(self.year, 2, 1)),
        )
        PersonLessonProgress.objects.create(
            person=ongoing,
            lesson=self.lesson_two,
            status=PersonLessonProgress.Status.ASSIGNED,
        )

        payload = self._summary()

        self.assertEqual(payload["overall"]["ASSIGNED"], 1)
        self.assertEqual(payload["overall"]["IN_PROGRESS"], 1)
        self.assertEqual(payload["overall"]["COMPLETED"], 0)
        self.assertEqual(payload["total_participants"], 2)

    def test_finish_date_uses_church_calendar_not_utc_date(self):
        person = self._person("timezone")
        church_new_year = datetime(
            self.year, 1, 1, 0, 0, tzinfo=get_church_timezone()
        )
        self._complete_course(
            person,
            completed_on=church_new_year.astimezone(timezone.utc),
        )

        payload = self._summary()

        self.assertEqual(payload["overall"]["COMPLETED"], 1)
        self.assertEqual(payload["total_participants"], 1)
