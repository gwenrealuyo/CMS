from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.coordinator_assignments import (
    sync_cluster_assistant_assignments,
    sync_cluster_coordinator_module_assignment,
    sync_cluster_reporter_assignments,
)
from apps.clusters.models import Cluster
from apps.clusters.permissions import (
    is_cluster_reporter_only,
    is_non_senior_cluster_assistant,
    user_assists_cluster,
    user_can_edit_cluster_leadership,
    user_can_operate_cluster,
    user_manages_cluster,
)
from apps.people.models import Branch, ModuleCoordinator, Person
from apps.people.vital_dates import user_can_edit_vital_dates


class ClusterAssistantCoordinatorTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Assistant Branch",
            code="ASSTBR",
            is_active=True,
        )
        self.coord = Person.objects.create_user(
            username="clustcoord",
            password="pass12345",
            first_name="Coord",
            last_name="Leader",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        self.assistant = Person.objects.create_user(
            username="clustasst",
            password="pass12345",
            first_name="Asst",
            last_name="Helper",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        self.reporter = Person.objects.create_user(
            username="clustrep",
            password="pass12345",
            first_name="Rep",
            last_name="Porter",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        self.member = Person.objects.create_user(
            username="clustmem",
            password="pass12345",
            first_name="Mem",
            last_name="Ber",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        self.cluster = Cluster.objects.create(
            name="Assist Cluster",
            code="ASST-01",
            branch=self.branch,
            coordinator=self.coord,
            is_active=True,
        )
        self.cluster.members.add(
            self.coord, self.assistant, self.reporter, self.member
        )
        sync_cluster_coordinator_module_assignment(self.cluster, None)
        sync_cluster_assistant_assignments(self.cluster, [self.assistant.id])
        sync_cluster_reporter_assignments(self.cluster, [self.reporter.id])

    def _patch(self, user, payload):
        self.client.force_authenticate(user)
        return self.client.patch(
            f"/api/clusters/clusters/{self.cluster.id}/",
            payload,
            format="json",
        )

    def test_sync_creates_assistant_row(self):
        row = ModuleCoordinator.objects.get(
            person=self.assistant,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            resource_id=self.cluster.id,
        )
        self.assertEqual(
            row.level, ModuleCoordinator.CoordinatorLevel.ASSISTANT_COORDINATOR
        )

    def test_mutual_exclusion_with_reporter(self):
        # Promoting reporter to assistant clears reporter role for that person.
        sync_cluster_assistant_assignments(
            self.cluster, [self.assistant.id, self.reporter.id]
        )
        levels = set(
            ModuleCoordinator.objects.filter(
                person=self.reporter,
                module=ModuleCoordinator.ModuleType.CLUSTER,
                resource_id=self.cluster.id,
            ).values_list("level", flat=True)
        )
        self.assertEqual(
            levels, {ModuleCoordinator.CoordinatorLevel.ASSISTANT_COORDINATOR}
        )

    def test_permission_helpers(self):
        self.assertTrue(user_manages_cluster(self.coord, self.cluster))
        self.assertFalse(user_assists_cluster(self.coord, self.cluster))
        self.assertTrue(user_can_operate_cluster(self.coord, self.cluster))
        self.assertTrue(user_can_edit_cluster_leadership(self.coord, self.cluster))

        self.assertFalse(user_manages_cluster(self.assistant, self.cluster))
        self.assertTrue(user_assists_cluster(self.assistant, self.cluster))
        self.assertTrue(user_can_operate_cluster(self.assistant, self.cluster))
        self.assertFalse(
            user_can_edit_cluster_leadership(self.assistant, self.cluster)
        )
        self.assertTrue(is_non_senior_cluster_assistant(self.assistant))
        self.assertFalse(is_cluster_reporter_only(self.assistant))
        self.assertTrue(is_cluster_reporter_only(self.reporter))

    def test_assistant_can_patch_identity(self):
        response = self._patch(self.assistant, {"location": "New Hall"})
        self.assertEqual(response.status_code, 200, response.data)
        self.cluster.refresh_from_db()
        self.assertEqual(self.cluster.location, "New Hall")

    def test_assistant_cannot_change_leadership_or_deactivate(self):
        response = self._patch(
            self.assistant,
            {
                "assistant_ids": [self.member.id],
                "location": "Should Fail Leadership",
            },
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("assistant_ids", details)

        response = self._patch(
            self.assistant,
            {"reporter_ids": [self.member.id]},
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("reporter_ids", details)

        response = self._patch(
            self.assistant,
            {"coordinator_id": self.member.id},
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("coordinator_id", details)

        response = self._patch(self.assistant, {"is_active": False})
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("is_active", details)
        self.cluster.refresh_from_db()
        self.assertTrue(self.cluster.is_active)

    def test_coordinator_can_set_assistants(self):
        response = self._patch(
            self.coord,
            {"assistant_ids": [self.assistant.id, self.member.id]},
        )
        self.assertEqual(response.status_code, 200, response.data)
        assistant_ids = set(response.data.get("assistant_ids") or [])
        self.assertEqual(assistant_ids, {self.assistant.id, self.member.id})

    def test_assistant_can_edit_vital_dates_for_member(self):
        self.assertTrue(user_can_edit_vital_dates(self.assistant, self.member))
        self.assertFalse(user_can_edit_vital_dates(self.reporter, self.member))

    def test_overlap_assistant_and_reporter_rejected(self):
        response = self._patch(
            self.coord,
            {
                "assistant_ids": [self.assistant.id, self.member.id],
                "reporter_ids": [self.member.id],
            },
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("assistant_ids", details)
