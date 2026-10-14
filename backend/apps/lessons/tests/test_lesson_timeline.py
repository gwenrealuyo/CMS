from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.lessons.models import (
    Lesson,
    LessonFollowUpCase,
    LessonSessionReport,
    LessonStudentEnrollment,
    PersonLessonProgress,
)
from apps.lessons.services import FOLLOW_UP_DROPPED_TITLE, FOLLOW_UP_PLAN_TITLE
from apps.people.models import Branch, Journey, ModuleCoordinator, Person
from core.datetime_utils import church_today


class LessonTimelineAPITests(APITestCase):
    def setUp(self):
        self.branch_a = Branch.objects.create(name="Branch A", code="TLA", is_active=True)
        self.branch_b = Branch.objects.create(name="Branch B", code="TLB", is_active=True)
        self.lesson = Lesson.objects.create(
            code="timeline-lesson-01",
            title="Timeline Lesson 1",
            order=1,
            is_latest=True,
            is_active=True,
        )
        self.coordinator = self._person(
            "timelinecoord",
            role="MEMBER",
            branch=self.branch_a,
            first_name="Cora",
            last_name="Coord",
            status="ACTIVE",
            water_baptism_date=church_today().replace(year=church_today().year - 5),
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.teacher = self._person(
            "timelineteacher",
            role="MEMBER",
            branch=self.branch_a,
            first_name="Tara",
            last_name="Teacher",
            status="ACTIVE",
            water_baptism_date=church_today().replace(year=church_today().year - 4),
        )
        ModuleCoordinator.objects.create(
            person=self.teacher,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        self.student = self._person(
            "timelinestudent",
            role="VISITOR",
            branch=self.branch_a,
            first_name="Sam",
            last_name="Student",
            status="ONGOING",
            has_finished_lessons=True,
            lessons_finished_at=church_today().replace(month=1, day=15),
            water_baptism_date=church_today().replace(month=2, day=1),
            spirit_baptism_date=church_today().replace(month=3, day=1),
        )
        LessonStudentEnrollment.objects.create(
            student=self.student,
            teacher=self.teacher,
        )
        PersonLessonProgress.objects.create(
            person=self.student,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.COMPLETED,
            completed_at=timezone.now() - timedelta(days=20),
        )
        session_date = church_today() - timedelta(days=12)
        LessonSessionReport.objects.create(
            teacher=self.teacher,
            student=self.student,
            lesson=self.lesson,
            session_type=LessonSessionReport.SessionType.LESSON,
            session_date=session_date,
            session_start=timezone.now() - timedelta(days=12),
            next_session_date=session_date + timedelta(days=7),
        )
        cluster = Cluster.objects.create(
            name="North",
            code="NORTH",
            branch=self.branch_a,
            is_active=True,
        )
        cluster.members.add(self.student)

        self.quiet = self._person(
            "timelinequiet",
            role="VISITOR",
            branch=self.branch_a,
            first_name="Quinn",
            last_name="Quiet",
            status="ONGOING",
        )
        enrollment = LessonStudentEnrollment.objects.create(
            student=self.quiet,
            teacher=self.teacher,
        )
        LessonStudentEnrollment.objects.filter(pk=enrollment.pk).update(
            assigned_at=timezone.now() - timedelta(days=5)
        )

        self.other_branch_student = self._person(
            "timelineother",
            role="VISITOR",
            branch=self.branch_b,
            first_name="Omar",
            last_name="Other",
            status="ONGOING",
        )
        LessonStudentEnrollment.objects.create(
            student=self.other_branch_student,
            teacher=self.teacher,
        )
        self.other_teacher = self._person(
            "timelineotherteacher",
            role="MEMBER",
            branch=self.branch_a,
            first_name="Otto",
            last_name="Other",
            status="ACTIVE",
            water_baptism_date=church_today().replace(year=church_today().year - 3),
        )
        ModuleCoordinator.objects.create(
            person=self.other_teacher,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        self.other_teachers_student = self._person(
            "timelineotherstudent",
            role="VISITOR",
            branch=self.branch_a,
            first_name="Ivy",
            last_name="Elsewhere",
            status="ONGOING",
        )
        LessonStudentEnrollment.objects.create(
            student=self.other_teachers_student,
            teacher=self.other_teacher,
        )

    def _person(self, username, **extra):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            **extra,
        )

    def _rows(self, user):
        self.client.force_authenticate(user)
        response = self.client.get("/api/lessons/progress/timeline/")
        return response

    def test_includes_finished_student_milestones_cluster_and_days(self):
        response = self._rows(self.coordinator)
        self.assertEqual(response.status_code, 200)
        by_id = {row["person"]["id"]: row for row in response.data["students"]}
        self.assertIn(self.student.id, by_id)
        self.assertNotIn(self.other_branch_student.id, by_id)
        row = by_id[self.student.id]
        self.assertTrue(row["has_finished_lessons"])
        self.assertEqual(row["water_baptism_date"], self.student.water_baptism_date.isoformat())
        self.assertEqual(row["spirit_baptism_date"], self.student.spirit_baptism_date.isoformat())
        self.assertEqual(row["cluster_codes"], ["NORTH"])
        self.assertEqual(row["days_since_last_session"], 12)
        self.assertEqual(row["days_anchor"], "session")
        self.assertEqual(row["last_session_date"], (church_today() - timedelta(days=12)).isoformat())
        self.assertIsNotNone(row["next_session_date"])
        completed = next(
            lesson for lesson in row["lessons"] if lesson["lesson_id"] == self.lesson.id
        )
        self.assertEqual(completed["completed_on"], row["last_session_date"])

    def test_no_session_counts_days_since_enrollment(self):
        response = self._rows(self.coordinator)
        by_id = {row["person"]["id"]: row for row in response.data["students"]}
        quiet = by_id[self.quiet.id]
        self.assertEqual(quiet["days_anchor"], "enrollment")
        self.assertEqual(quiet["days_since_last_session"], 5)
        self.assertIsNone(quiet["last_session_date"])

    def test_teacher_sees_only_assigned_students(self):
        response = self._rows(self.teacher)
        self.assertEqual(response.status_code, 200)
        ids = {row["person"]["id"] for row in response.data["students"]}
        self.assertEqual(ids, {self.student.id, self.quiet.id})

        self.client.force_authenticate(self.teacher)
        denied = self.client.post(
            "/api/lessons/progress/follow-up/",
            {
                "student_id": self.other_teachers_student.id,
                "status": "ACTION_PLANNED",
                "action_text": "Not my student",
            },
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

    def test_action_plan_stays_on_follow_up_and_writes_journey(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/lessons/progress/follow-up/",
            {
                "student_id": self.quiet.id,
                "status": "ACTION_PLANNED",
                "action_text": "Call the teacher this week",
                "who": "Cora Coord",
                "when": church_today().isoformat(),
                "remarks": "Family is traveling",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ACTION_PLANNED")

        timeline = self.client.get("/api/lessons/progress/timeline/")
        by_id = {row["person"]["id"]: row for row in timeline.data["students"]}
        self.assertEqual(by_id[self.quiet.id]["follow_up"]["status"], "ACTION_PLANNED")
        note = Journey.objects.get(user=self.quiet, title=FOLLOW_UP_PLAN_TITLE)
        self.assertIn("Call the teacher this week", note.description)
        self.assertEqual(note.type, "NOTE")
        self.assertEqual(note.verified_by_id, self.coordinator.id)

    def test_drop_without_note_stops_remaining_lessons(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/lessons/progress/follow-up/",
            {"student_id": self.student.id, "status": "DROPPED", "excuse_text": "  "},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        note = Journey.objects.get(user=self.student, title=FOLLOW_UP_DROPPED_TITLE)
        self.assertIn("Stopped the remaining lessons.", note.description)
        self.student.lesson_enrollment.refresh_from_db()
        self.assertFalse(self.student.lesson_enrollment.is_active)
        completed = PersonLessonProgress.objects.get(
            person=self.student,
            lesson=self.lesson,
        )
        self.assertEqual(completed.status, PersonLessonProgress.Status.COMPLETED)
        other = PersonLessonProgress.objects.filter(person=self.student).exclude(
            lesson=self.lesson
        )
        self.assertGreater(other.count(), 0)
        self.assertFalse(
            other.exclude(status=PersonLessonProgress.Status.SKIPPED).exists()
        )

    def test_drop_writes_journey_and_newer_session_clears_case_only(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/lessons/progress/follow-up/",
            {
                "student_id": self.quiet.id,
                "status": "DROPPED",
                "excuse_text": "Out of the country until next month",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        note = Journey.objects.get(user=self.quiet, title=FOLLOW_UP_DROPPED_TITLE)
        self.assertIn("Out of the country until next month", note.description)

        older = self.client.post(
            "/api/lessons/session-reports/",
            {
                "student_id": self.quiet.id,
                "teacher_id": self.teacher.id,
                "lesson_id": self.lesson.id,
                "session_type": "LESSON",
                "session_date": (church_today() - timedelta(days=1)).isoformat(),
                "session_start": (timezone.now() - timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(older.status_code, 201, older.data)
        self.assertTrue(LessonFollowUpCase.objects.filter(student=self.quiet).exists())

        newer = self.client.post(
            "/api/lessons/session-reports/",
            {
                "student_id": self.quiet.id,
                "teacher_id": self.teacher.id,
                "lesson_id": self.lesson.id,
                "session_type": "LESSON",
                "session_date": church_today().isoformat(),
                "session_start": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(newer.status_code, 201, newer.data)
        self.assertFalse(LessonFollowUpCase.objects.filter(student=self.quiet).exists())
        self.assertTrue(Journey.objects.filter(pk=note.pk).exists())
