from datetime import date, timedelta

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