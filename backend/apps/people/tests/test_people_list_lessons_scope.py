from rest_framework.test import APITestCase

from apps.ministries.ncc import ensure_ncc_ministry
from apps.people.models import Branch, ModuleCoordinator, Person


class PeopleListLessonsScopeAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTLESSSCP",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Makati",
            code="MAKALESSSCP",
            is_active=True,
        )
        self.coordinator = Person.objects.create_user(
            username="lessscpcoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.same_branch = Person.objects.create_user(
            username="lessscpmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.same_branch_visitor = Person.objects.create_user(
            username="lessscpvisitor",
            password="pass12345",
            first_name="Vic",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        self.other_branch_person = Person.objects.create_user(
            username="lessscpother",
            password="pass12345",
            first_name="Omar",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            branch=self.other_branch,
        )
        self.teacher = Person.objects.create_user(
            username="lessscpteacher",
            password="pass12345",
            first_name="Tessa",
            last_name="Teacher",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.plain_member = Person.objects.create_user(
            username="lessscpplain",
            password="pass12345",
            first_name="Pam",
            last_name="Plain",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )

    def _list_ids(self, **params):
        response = self.client.get("/api/people/people/", params)
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data.get("results", response.data)
        return {row["id"] for row in results}

    def test_ncc_support_directory_is_self_only(self):
        ministry = ensure_ncc_ministry(self.branch)
        ministry.support_coordinators.add(self.coordinator)
        self.client.force_authenticate(self.coordinator)
        ids = self._list_ids(page_size=100)
        self.assertIn(self.coordinator.id, ids)
        self.assertNotIn(self.same_branch.id, ids)
        self.assertNotIn(self.same_branch_visitor.id, ids)
        self.assertNotIn(self.other_branch_person.id, ids)

    def test_ncc_support_for_lessons_includes_same_branch_people(self):
        ministry = ensure_ncc_ministry(self.branch)
        ministry.support_coordinators.add(self.coordinator)
        self.client.force_authenticate(self.coordinator)
        ids = self._list_ids(for_lessons="true", page_size=100)
        self.assertIn(self.coordinator.id, ids)
        self.assertIn(self.same_branch.id, ids)
        self.assertIn(self.same_branch_visitor.id, ids)
        self.assertNotIn(self.other_branch_person.id, ids)

    def test_ncc_support_cannot_retrieve_unrelated_person(self):
        ministry = ensure_ncc_ministry(self.branch)
        ministry.support_coordinators.add(self.coordinator)
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(f"/api/people/people/{self.same_branch.id}/")
        self.assertEqual(response.status_code, 404)

    def test_lessons_coordinator_for_lessons_includes_same_branch_people(self):
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=None,
        )
        self.client.force_authenticate(self.coordinator)
        ids = self._list_ids(page_size=100)
        self.assertIn(self.coordinator.id, ids)
        self.assertNotIn(self.same_branch.id, ids)

        ids = self._list_ids(for_lessons="true", page_size=100)
        self.assertIn(self.same_branch.id, ids)
        self.assertIn(self.same_branch_visitor.id, ids)
        self.assertNotIn(self.other_branch_person.id, ids)

    def test_lessons_teacher_for_lessons_does_not_widen(self):
        ModuleCoordinator.objects.create(
            person=self.teacher,
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
            resource_id=None,
        )
        self.client.force_authenticate(self.teacher)
        ids = self._list_ids(for_lessons="true", page_size=100)
        self.assertIn(self.teacher.id, ids)
        self.assertNotIn(self.same_branch.id, ids)
        self.assertNotIn(self.same_branch_visitor.id, ids)

    def test_member_for_lessons_does_not_widen(self):
        self.client.force_authenticate(self.plain_member)
        ids = self._list_ids(for_lessons="true", page_size=100)
        self.assertIn(self.plain_member.id, ids)
        self.assertNotIn(self.same_branch.id, ids)
        self.assertNotIn(self.coordinator.id, ids)
