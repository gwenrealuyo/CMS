from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Optional

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.lessons.models import (
    Lesson,
    LessonSessionReport,
    LessonStudentEnrollment,
    PersonLessonProgress,
)
from apps.ministries.models import MinistryMember
from apps.ministries.ncc import ensure_ncc_ministry
from apps.people.models import Branch, ModuleCoordinator, Person


class LessonsScalePaginationAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Scale Branch", code="SCBR", is_active=True
        )
        self.admin = self._person(
            "scaleadmin",
            role="ADMIN",
            branch=self.branch,
            first_name="Ada",
            last_name="Admin",
            water_baptism_date=date(2020, 1, 1),
        )
        self.coordinator = self._person(
            "scalecoord",
            role="MEMBER",
            branch=self.branch,
            first_name="Cora",
            last_name="Coord",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.teacher = self._person(
            "scaleteacher",
            role="MEMBER",
            branch=self.branch,
            first_name="Tara",
            last_name="Teacher",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
        )
        ModuleCoordinator.objects.create(
            person=self.teacher,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        ministry = ensure_ncc_ministry(self.branch)
        MinistryMember.objects.create(
            ministry=ministry, member=self.teacher, is_active=True
        )

        self.lesson_one = Lesson.objects.create(
            code="scale-01",
            title="Scale Lesson 1",
            order=1,
            is_latest=True,
            is_active=True,
        )
        self.lesson_two = Lesson.objects.create(
            code="scale-02",
            title="Scale Lesson 2",
            order=2,
            is_latest=True,
            is_active=True,
        )

        self.student_assigned = self._person(
            "scalestudent1",
            role="VISITOR",
            branch=self.branch,
            first_name="Sam",
            last_name="Assigned",
            status="ONGOING",
        )
        self.student_in_progress = self._person(
            "scalestudent2",
            role="VISITOR",
            branch=self.branch,
            first_name="Pat",
            last_name="Progress",
            status="ONGOING",
        )
        for student in (self.student_assigned, self.student_in_progress):
            LessonStudentEnrollment.objects.create(
                student=student,
                teacher=self.teacher,
            )
            PersonLessonProgress.objects.create(
                person=student,
                lesson=self.lesson_one,
                status=PersonLessonProgress.Status.ASSIGNED,
            )

        PersonLessonProgress.objects.create(
            person=self.student_in_progress,
            lesson=self.lesson_two,
            status=PersonLessonProgress.Status.IN_PROGRESS,
        )

        LessonSessionReport.objects.create(
            teacher=self.teacher,
            student=self.student_in_progress,
            lesson=self.lesson_one,
            session_type=LessonSessionReport.SessionType.LESSON,
            session_date=date.today() - timedelta(days=2),
            session_start=timezone.now() - timedelta(days=2),
        )

        self.visitor_no_teacher = self._person(
            "scaleawait",
            role="VISITOR",
            branch=self.branch,
            first_name="Vera",
            last_name="Awaiting",
            status="ONGOING",
            phone="09171112222",
        )

    def _person(self, username, **extra):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            **extra,
        )

    def test_progress_list_is_paginated(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get("/api/lessons/progress/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        self.assertGreaterEqual(response.data["count"], 3)
        self.assertGreater(len(response.data["results"]), 0)
        row = response.data["results"][0]
        self.assertIn("person", row)
        self.assertIn("lesson", row)
        self.assertNotIn("journey_config", row.get("lesson", {}))

    def test_latest_session_activity(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get("/api/lessons/progress/latest-session-activity/")
        self.assertEqual(response.status_code, 200)
        key = str(self.student_in_progress.id)
        self.assertIn(key, response.data)
        self.assertIsNotNone(response.data[key])

    def test_student_summaries_pagination(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(
            "/api/lessons/progress/student-summaries/",
            {"page": 1, "page_size": 1},
        )
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
        row = response.data["results"][0]
        self.assertEqual(row["allProgress"], [])
        self.assertIn("lifecycleStatus", row)
        self.assertIn("hasSkipped", row)

    def test_student_summaries_skipped_filter(self):
        PersonLessonProgress.objects.filter(
            person=self.student_assigned,
            lesson=self.lesson_one,
        ).update(status=PersonLessonProgress.Status.SKIPPED)

        self.client.force_authenticate(self.coordinator)
        response = self.client.get(
            "/api/lessons/progress/student-summaries/",
            {"status": "SKIPPED"},
        )
        self.assertEqual(response.status_code, 200)
        ids = {row["person"]["id"] for row in response.data["results"]}
        self.assertEqual(ids, {self.student_assigned.id})
        self.assertTrue(response.data["results"][0]["hasSkipped"])

    def test_teachers_overview(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(
            "/api/lessons/teachers/overview/",
            {"branch_id": self.branch.id},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        tara = next(
            (row for row in response.data if row["key"] == str(self.teacher.id)),
            None,
        )
        self.assertIsNotNone(tara)
        self.assertEqual(tara["total"], 2)
        self.assertEqual(tara["not_started"], 2)
        self.assertEqual(tara["in_progress"], 0)
        self.assertEqual(tara["number"], 1)

    def test_student_summaries_includes_enrollment_only_students(self):
        enrollment_only = self._person(
            "scaleenrollonly",
            role="VISITOR",
            branch=self.branch,
            first_name="Enroll",
            last_name="Only",
            status="ONGOING",
        )
        LessonStudentEnrollment.objects.create(
            student=enrollment_only,
            teacher=self.teacher,
        )

        self.client.force_authenticate(self.coordinator)
        overview = self.client.get(
            "/api/lessons/teachers/overview/",
            {"branch_id": self.branch.id},
        )
        tara = next(
            (row for row in overview.data if row["key"] == str(self.teacher.id)),
            None,
        )
        self.assertIsNotNone(tara)
        self.assertEqual(tara["total"], 3)

        progress = self.client.get(
            "/api/lessons/progress/student-summaries/",
            {"teacher_key": str(self.teacher.id), "page_size": 50},
        )
        self.assertEqual(progress.status_code, 200)
        self.assertEqual(progress.data["count"], tara["total"])
        ids = {row["person"]["id"] for row in progress.data["results"]}
        self.assertIn(enrollment_only.id, ids)

    def test_timeline_paginated_shape(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(
            "/api/lessons/progress/timeline/",
            {"filter_mode": "all", "page_size": 1},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        self.assertIn("students", response.data)
        self.assertEqual(response.data["results"], response.data["students"])
        self.assertEqual(len(response.data["results"]), 1)
        self.assertGreater(response.data["count"], 1)

    def test_visitors_awaiting_teacher_pagination(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/lessons/visitors-awaiting-teacher/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        ids = {row["id"] for row in response.data["results"]}
        self.assertIn(self.visitor_no_teacher.id, ids)

        export = self.client.get(
            "/api/lessons/visitors-awaiting-teacher/",
            {"export": "1"},
        )
        self.assertEqual(export.status_code, 200)
        self.assertIsInstance(export.data, list)

        search = self.client.get(
            "/api/lessons/visitors-awaiting-teacher/",
            {"search": "Vera"},
        )
        self.assertEqual(search.status_code, 200)
        self.assertEqual(
            {row["id"] for row in search.data["results"]},
            {self.visitor_no_teacher.id},
        )

    def _finish_student(
        self, student, *, finish_day: Optional[date], stamp_uniform: bool = False
    ):
        LessonStudentEnrollment.objects.get_or_create(
            student=student,
            defaults={"teacher": self.teacher},
        )
        completed_at = timezone.now()
        if finish_day is not None and not stamp_uniform:
            completed_at = timezone.make_aware(
                datetime.combine(finish_day, time.min)
            )
        catalog = list(
            Lesson.objects.filter(is_latest=True, is_active=True).order_by(
                "order", "id"
            )
        )
        last_lesson = catalog[-1] if catalog else self.lesson_two
        for lesson in catalog:
            PersonLessonProgress.objects.update_or_create(
                person=student,
                lesson=lesson,
                defaults={
                    "status": PersonLessonProgress.Status.COMPLETED,
                    "completed_at": completed_at,
                },
            )
        if finish_day is not None and not stamp_uniform:
            LessonSessionReport.objects.create(
                teacher=self.teacher,
                student=student,
                lesson=last_lesson,
                session_type=LessonSessionReport.SessionType.LESSON,
                session_date=finish_day,
                session_start=timezone.make_aware(
                    datetime.combine(finish_day, time(10, 0))
                ),
            )
            student.has_finished_lessons = True
            student.lessons_finished_at = finish_day
            student.save(
                update_fields=["has_finished_lessons", "lessons_finished_at"]
            )
        elif stamp_uniform:
            student.has_finished_lessons = True
            student.lessons_finished_at = None
            student.save(
                update_fields=["has_finished_lessons", "lessons_finished_at"]
            )

    def test_student_summaries_yearly_cohort_default(self):
        this_year = date.today().year
        finished_this_year = self._person(
            "scalefinishnow",
            role="VISITOR",
            branch=self.branch,
            first_name="Finn",
            last_name="ThisYear",
            status="ONGOING",
        )
        finished_last_year = self._person(
            "scalefinishold",
            role="VISITOR",
            branch=self.branch,
            first_name="Old",
            last_name="Graduate",
            status="ONGOING",
        )
        undated_finished = self._person(
            "scaleundated",
            role="VISITOR",
            branch=self.branch,
            first_name="Undated",
            last_name="Finisher",
            status="ONGOING",
        )
        self._finish_student(
            finished_this_year, finish_day=date(this_year, 3, 15)
        )
        self._finish_student(
            finished_last_year, finish_day=date(this_year - 1, 6, 1)
        )
        self._finish_student(
            undated_finished, finish_day=None, stamp_uniform=True
        )

        self.client.force_authenticate(self.coordinator)
        default_response = self.client.get(
            "/api/lessons/progress/student-summaries/",
            {"page_size": 50, "year": this_year},
        )
        self.assertEqual(default_response.status_code, 200)
        default_ids = {
            row["person"]["id"] for row in default_response.data["results"]
        }
        self.assertIn(self.student_assigned.id, default_ids)
        self.assertIn(self.student_in_progress.id, default_ids)
        self.assertIn(finished_this_year.id, default_ids)
        self.assertNotIn(finished_last_year.id, default_ids)
        self.assertNotIn(undated_finished.id, default_ids)

        completed = self.client.get(
            "/api/lessons/progress/student-summaries/",
            {"page_size": 50, "year": this_year, "status": "COMPLETED"},
        )
        completed_ids = {row["person"]["id"] for row in completed.data["results"]}
        self.assertEqual(completed_ids, {finished_this_year.id})

        historical = self.client.get(
            "/api/lessons/progress/student-summaries/",
            {
                "page_size": 50,
                "year": this_year,
                "include_historical_finished": "1",
            },
        )
        historical_ids = {
            row["person"]["id"] for row in historical.data["results"]
        }
        self.assertIn(finished_last_year.id, historical_ids)
        self.assertIn(undated_finished.id, historical_ids)

        overview = self.client.get(
            "/api/lessons/teachers/overview/",
            {"branch_id": self.branch.id, "year": this_year},
        )
        tara = next(
            (row for row in overview.data if row["key"] == str(self.teacher.id)),
            None,
        )
        self.assertIsNotNone(tara)
        # assigned + in_progress + finished_this_year (not last year / undated)
        self.assertEqual(tara["total"], 3)
        self.assertEqual(tara["completed"], 1)
        self.assertEqual(tara["not_started"], 2)