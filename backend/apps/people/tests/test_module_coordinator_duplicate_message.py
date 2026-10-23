from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.people.models import Branch, ModuleCoordinator, Person


class ModuleCoordinatorDuplicateMessageTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTDUP",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="dupadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="marklava",
            password="pass12345",
            first_name="Mark",
            last_name="Lava",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="East Cluster",
            code="EAST-1",
            branch=self.branch,
            is_active=True,
        )
        self.other_cluster = Cluster.objects.create(
            name="West Cluster",
            code="WEST-1",
            branch=self.branch,
            is_active=True,
        )
        self.existing = ModuleCoordinator.objects.create(
            person=self.member,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.cluster.id,
            resource_type="Cluster",
        )
        self.client.force_authenticate(self.admin)

    def _message(self, response):
        data = response.data
        if isinstance(data, dict) and data.get("message"):
            return str(data["message"])
        if isinstance(data, dict) and data.get("non_field_errors"):
            return str(data["non_field_errors"][0])
        return str(data)

    def test_different_level_on_same_resource_names_existing_assignment(self):
        response = self.client.post(
            "/api/people/module-coordinators/",
            {
                "person": self.member.id,
                "module": "CLUSTER",
                "level": "ASSISTANT_COORDINATOR",
                "resource_id": self.cluster.id,
                "resource_type": "Cluster",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        message = self._message(response)
        self.assertIn(
            "Mark Lava is already assigned as Coordinator for cluster EAST-1.",
            message,
        )
        self.assertIn("cannot also be assigned as Assistant Coordinator", message)
        self.assertIn("Edit the existing assignment to change the level.", message)
        self.assertNotIn("must make a unique set", message)

    def test_same_level_on_same_resource_names_existing_assignment(self):
        response = self.client.post(
            "/api/people/module-coordinators/",
            {
                "person": self.member.id,
                "module": "CLUSTER",
                "level": "COORDINATOR",
                "resource_id": self.cluster.id,
                "resource_type": "Cluster",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        message = self._message(response)
        self.assertEqual(
            message,
            "Mark Lava is already assigned as Coordinator for cluster EAST-1.",
        )

    def test_level_change_on_existing_assignment_is_allowed(self):
        response = self.client.patch(
            f"/api/people/module-coordinators/{self.existing.id}/",
            {"level": "ASSISTANT_COORDINATOR"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.existing.refresh_from_db()
        self.assertEqual(
            self.existing.level,
            ModuleCoordinator.CoordinatorLevel.ASSISTANT_COORDINATOR,
        )

    def test_different_resource_can_still_be_assigned(self):
        response = self.client.post(
            "/api/people/module-coordinators/",
            {
                "person": self.member.id,
                "module": "CLUSTER",
                "level": "ASSISTANT_COORDINATOR",
                "resource_id": self.other_cluster.id,
                "resource_type": "Cluster",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_bulk_create_duplicate_names_existing_assignment(self):
        response = self.client.post(
            "/api/people/module-coordinators/bulk-create/",
            {
                "assignments": [
                    {
                        "person": self.member.id,
                        "module": "CLUSTER",
                        "level": "REPORTER",
                        "resource_id": self.cluster.id,
                        "resource_type": "Cluster",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        message = " ".join(response.data["assignments"])
        self.assertIn(
            "Mark Lava is already assigned as Coordinator for cluster EAST-1.",
            message,
        )
        self.assertIn("cannot also be assigned as Reporter", message)

    def test_bulk_create_repeated_resource_in_one_request(self):
        response = self.client.post(
            "/api/people/module-coordinators/bulk-create/",
            {
                "assignments": [
                    {
                        "person": self.member.id,
                        "module": "CLUSTER",
                        "level": "ASSISTANT_COORDINATOR",
                        "resource_id": self.other_cluster.id,
                        "resource_type": "Cluster",
                    },
                    {
                        "person": self.member.id,
                        "module": "CLUSTER",
                        "level": "REPORTER",
                        "resource_id": self.other_cluster.id,
                        "resource_type": "Cluster",
                    },
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        message = " ".join(response.data["assignments"])
        self.assertIn(
            "Mark Lava is listed more than once for cluster WEST-1.",
            message,
        )
