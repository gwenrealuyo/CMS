from rest_framework.test import APITestCase

from apps.people.models import Branch, ModuleCoordinator, Person
from datetime import date


class EvangelismCoordinatorPeopleScopeTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTEVGPEO",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Other Branch",
            code="OTHEVGPEO",
            is_active=True,
        )
        self.coordinator = Person.objects.create_user(
            username="evgpeocoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
        )
        self.same_branch = Person.objects.create_user(
            username="evgpeomember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
        )
        self.other_branch_person = Person.objects.create_user(
            username="evgpeoother",
            password="pass12345",
            first_name="Omar",
            last_name="Other",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.other_branch,
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )

    def _ids(self, response):
        return {row["id"] for row in response.data.get("results", [])}

    def test_list_is_same_branch_without_cluster_or_group_resource(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get("/api/people/people/", {"page_size": 100})
        self.assertEqual(response.status_code, 200, response.data)
        ids = self._ids(response)
        self.assertIn(self.coordinator.id, ids)
        self.assertIn(self.same_branch.id, ids)
        self.assertNotIn(self.other_branch_person.id, ids)

    def test_retrieve_unrelated_same_branch_person_is_404(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.get(f"/api/people/people/{self.same_branch.id}/")
        self.assertEqual(response.status_code, 404)
