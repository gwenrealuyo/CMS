from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.lessons.models import LessonStudentEnrollment
from apps.people.models import Branch, ModuleCoordinator, Person


class VisitorsAwaitingTeacherAPITests(APITestCase):
    def setUp(self):
        self.branch_a = Branch.objects.create(name="Branch A", code="BRA", is_active=True)
        self.branch_b = Branch.objects.create(name="Branch B", code="BRB", is_active=True)

        self.admin = self._person(
            "awaitadmin",
            role="ADMIN",
            branch=self.branch_a,
            first_name="Ada",
            last_name="Admin",
            water_baptism_date=date(2020, 1, 1),
        )
        self.coordinator = self._person(
            "awaitcoord",
            role="MEMBER",
            branch=self.branch_a,
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
            "awaitteacher",
            role="MEMBER",
            branch=self.branch_a,
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
        self.live_teacher = self._person(
            "awaitliveteacher",
            role="MEMBER",
            branch=self.branch_a,
            first_name="Lee",
            last_name="Live",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
        )

        self.unassigned = self._person(
            "awaitvisitor",
            role="VISITOR",
            branch=self.branch_a,
            first_name="Vera",
            last_name="Visitor",
            status="ONGOING",
            phone="09170000001",
            date_first_attended=date(2026, 1, 15),
        )
        cluster = Cluster.objects.create(
            name="North Cluster",
            code="NORTH",
            branch=self.branch_a,
            is_active=True,
        )
        cluster.members.add(self.unassigned)

        self.historical = self._person(
            "awaithistorical",
            role="VISITOR",
            branch=self.branch_a,
            first_name="Hank",
            last_name="Historical",
            status="ONGOING",
        )
        self.historical_enrollment = LessonStudentEnrollment.objects.create(
            student=self.historical,
            teacher=None,
            historical_teacher_first_name="Former",
            historical_teacher_last_name="Teacher",
        )

        assigned = self._person(
            "awaitassigned",
            role="VISITOR",
            branch=self.branch_a,
            first_name="Amy",
            last_name="Assigned",
            status="ONGOING",
        )
        LessonStudentEnrollment.objects.create(
            student=assigned,
            teacher=self.live_teacher,
        )

        self._person(
            "awaitmember",
            role="MEMBER",
            branch=self.branch_a,
            first_name="Mia",
            last_name="Member",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
        )
        self._person(
            "awaitdeceased",
            role="VISITOR",
            branch=self.branch_a,
            first_name="Dee",
            last_name="Deceased",
            status="DECEASED",
        )
        self._person(
            "awaitfinished",
            role="VISITOR",
            branch=self.branch_a,
            first_name="Finn",
            last_name="Finished",
            status="ONGOING",
            has_finished_lessons=True,
        )
        self.other_branch = self._person(
            "awaitother",
            role="VISITOR",
            branch=self.branch_b,
            first_name="Omar",
            last_name="Other",
            status="ONGOING",
        )

    def _person(self, username, **extra):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            **extra,
        )

    def _ids(self, user, **params):
        self.client.force_authenticate(user)
        response = self.client.get(
            "/api/lessons/visitors-awaiting-teacher/",
            params,
        )
        return response

    def test_includes_visitors_without_a_live_teacher(self):
        response = self._ids(self.admin)
        self.assertEqual(response.status_code, 200)
        by_id = {row["id"]: row for row in response.data}
        self.assertIn(self.unassigned.id, by_id)
        self.assertIn(self.historical.id, by_id)
        self.assertEqual(
            set(by_id),
            {self.unassigned.id, self.historical.id, self.other_branch.id},
        )

        row = by_id[self.unassigned.id]
        self.assertEqual(row["name"], self.unassigned.get_full_name())
        self.assertEqual(row["branch_id"], self.branch_a.id)
        self.assertEqual(row["branch_code"], "BRA")
        self.assertEqual(row["cluster_codes"], ["NORTH"])
        self.assertEqual(row["phone"], "09170000001")
        self.assertEqual(row["visitor_since"], "2026-01-15")
        self.assertIsNone(row["enrollment_id"])
        self.assertEqual(
            by_id[self.historical.id]["enrollment_id"],
            self.historical_enrollment.id,
        )

    def test_coordinator_is_limited_to_their_branch(self):
        response = self._ids(self.coordinator, branch_id=self.branch_b.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {row["id"] for row in response.data},
            {self.unassigned.id, self.historical.id},
        )

        admin_response = self._ids(self.admin, branch_id=self.branch_b.id)
        self.assertEqual(admin_response.status_code, 200)
        self.assertEqual(
            {row["id"] for row in admin_response.data},
            {self.other_branch.id},
        )

    def test_lessons_teacher_is_forbidden(self):
        response = self._ids(self.teacher)
        self.assertEqual(response.status_code, 403)
