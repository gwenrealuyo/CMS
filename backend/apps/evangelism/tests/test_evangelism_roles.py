from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup
from apps.people.models import Branch, ModuleCoordinator, Person


class EvangelismRoleAssignmentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(name="HQ", code="HQ", is_active=True)
        self.admin = Person.objects.create_user(
            username="ev_role_admin",
            password="password123",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.coordinator = Person.objects.create_user(
            username="ev_role_coord",
            password="password123",
            first_name="Coord",
            last_name="One",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.sharer = Person.objects.create_user(
            username="ev_role_sharer",
            password="password123",
            first_name="Sharer",
            last_name="One",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.reporter = Person.objects.create_user(
            username="ev_role_reporter",
            password="password123",
            first_name="Reporter",
            last_name="One",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.outsider = Person.objects.create_user(
            username="ev_role_out",
            password="password123",
            first_name="Other",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            code="EV-R",
            name="Role Cluster",
            branch=self.branch,
        )
        self.group = EvangelismGroup.objects.create(
            name="Role Group",
            cluster=self.cluster,
            coordinator=self.coordinator,
            is_active=True,
        )
        self.group.members.add(self.coordinator, self.sharer, self.reporter)
        self.client.force_authenticate(user=self.admin)

    def test_patch_reporter_ids_must_be_members(self):
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"reporter_ids": [self.outsider.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details") or response.data
        self.assertIn("reporter_ids", details)

    def test_coordinator_cannot_also_be_reporter_or_sharer(self):
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"bible_sharer_ids": [self.coordinator.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details") or response.data
        self.assertIn("bible_sharer_ids", details)

    def test_sync_reporter_and_bible_sharer_ids(self):
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {
                "reporter_ids": [self.reporter.id],
                "bible_sharer_ids": [self.sharer.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data["reporter_ids"]), {self.reporter.id})
        self.assertEqual(set(response.data["bible_sharer_ids"]), {self.sharer.id})
        self.assertTrue(
            ModuleCoordinator.objects.filter(
                person=self.reporter,
                module=ModuleCoordinator.ModuleType.EVANGELISM,
                level=ModuleCoordinator.CoordinatorLevel.REPORTER,
                resource_id=self.group.id,
            ).exists()
        )
        self.assertTrue(
            ModuleCoordinator.objects.filter(
                person=self.coordinator,
                module=ModuleCoordinator.ModuleType.EVANGELISM,
                level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                resource_id=self.group.id,
            ).exists()
        )

    def test_bible_sharer_upgrades_reporter_on_same_group(self):
        self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"reporter_ids": [self.reporter.id]},
            format="json",
        )
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"bible_sharer_ids": [self.reporter.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = ModuleCoordinator.objects.get(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            resource_id=self.group.id,
        )
        self.assertEqual(row.level, ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER)
        self.assertEqual(response.data["reporter_ids"], [])
        self.assertEqual(set(response.data["bible_sharer_ids"]), {self.reporter.id})

    def test_setting_coordinator_clears_lower_roles(self):
        self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"bible_sharer_ids": [self.sharer.id]},
            format="json",
        )
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {
                "coordinator_id": self.sharer.id,
                "members": [
                    self.coordinator.id,
                    self.sharer.id,
                    self.reporter.id,
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = ModuleCoordinator.objects.get(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            resource_id=self.group.id,
        )
        self.assertEqual(row.level, ModuleCoordinator.CoordinatorLevel.COORDINATOR)
        self.assertEqual(response.data["bible_sharer_ids"], [])

    def test_omit_ids_leaves_assignments_unchanged(self):
        self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"reporter_ids": [self.reporter.id]},
            format="json",
        )
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"name": "Role Group Renamed"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data["reporter_ids"]), {self.reporter.id})


class EvangelismRolePermissionAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(name="HQ", code="HQ2", is_active=True)
        self.admin = Person.objects.create_user(
            username="ev_perm_admin",
            password="password123",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.coord = Person.objects.create_user(
            username="ev_perm_coord",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.sharer = Person.objects.create_user(
            username="ev_perm_sharer",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.reporter = Person.objects.create_user(
            username="ev_perm_rpt",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            code="EV-P",
            name="Perm Cluster",
            branch=self.branch,
        )
        self.group = EvangelismGroup.objects.create(
            name="Perm Group",
            cluster=self.cluster,
            coordinator=self.coord,
            is_active=True,
        )
        self.group.members.add(self.coord, self.sharer, self.reporter)
        self.other = EvangelismGroup.objects.create(
            name="Other Perm Group",
            cluster=self.cluster,
            is_active=True,
        )
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )

    def _report_payload(self, group_id):
        return {
            "evangelism_group_id": group_id,
            "year": 2026,
            "week_number": 10,
            "meeting_date": "2026-03-04",
            "gathering_type": "PHYSICAL",
            "members_attended": [],
            "visitors_attended": [],
        }

    def test_bible_sharer_cannot_patch_group(self):
        self.client.force_authenticate(user=self.sharer)
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"location": "Hall"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reporter_cannot_patch_group(self):
        self.client.force_authenticate(user=self.reporter)
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"location": "Hall"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bible_sharer_and_reporter_can_submit_assigned_report(self):
        self.client.force_authenticate(user=self.sharer)
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(self.group.id),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.reporter)
        payload = self._report_payload(self.group.id)
        payload["week_number"] = 11
        payload["meeting_date"] = "2026-03-11"
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cannot_submit_report_for_unassigned_group(self):
        self.client.force_authenticate(user=self.reporter)
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(self.other.id),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bible_sharer_list_does_not_include_unassigned_groups(self):
        self.client.force_authenticate(user=self.sharer)
        response = self.client.get("/api/evangelism/groups/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        rows = payload["results"] if isinstance(payload, dict) and "results" in payload else payload
        ids = {row["id"] for row in rows}
        self.assertIn(self.group.id, ids)
        self.assertNotIn(self.other.id, ids)

    def test_coverage_counts_assigned_people_not_group_flag(self):
        flagged = EvangelismGroup.objects.create(
            name="Flagged empty",
            cluster=self.cluster,
            is_active=True,
            is_bible_sharers_group=True,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/evangelism/groups/bible_sharers_coverage/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = next(
            row
            for row in response.data["coverage"]
            if row["cluster"]["id"] == self.cluster.id
        )
        self.assertTrue(item["has_bible_sharers"])
        self.assertEqual(item["bible_sharers_count"], 1)
        self.assertEqual(item["bible_sharers"][0]["id"], self.sharer.id)
        flagged_ids = [
            g["id"]
            for row in response.data["coverage"]
            for g in row["bible_sharers_groups"]
        ]
        self.assertNotIn(flagged.id, flagged_ids)
