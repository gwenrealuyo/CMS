from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup
from apps.ministries.bible_sharers import (
    ensure_bible_sharers_ministry,
    grant_evangelism_bible_sharer_access,
    headquarters_branch,
)
from apps.ministries.models import MinistryMember
from apps.people.models import Branch, ModuleCoordinator, Person

COVERAGE_URL = "/api/evangelism/groups/bible_sharers_coverage/"


class BibleSharersDirectoryAPITests(APITestCase):
    def setUp(self):
        self.hq = headquarters_branch()
        if self.hq is None:
            self.hq = Branch.objects.create(
                name="Headquarters",
                code="HQBSCOV",
                is_active=True,
                is_headquarters=True,
            )
        self.satellite = Branch.objects.create(
            name="Satellite",
            code="SATBSCOV",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="bscovadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.roster_only = Person.objects.create_user(
            username="bscovroster",
            password="pass12345",
            first_name="Rita",
            last_name="Roster",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.grant_only = Person.objects.create_user(
            username="bscovgrant",
            password="pass12345",
            first_name="Gina",
            last_name="Grant",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.hq_sharer = Person.objects.create_user(
            username="bscovhqsharer",
            password="pass12345",
            first_name="Hugo",
            last_name="Sharer",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.sat_sharer = Person.objects.create_user(
            username="bscovsatsharer",
            password="pass12345",
            first_name="Sam",
            last_name="Satellite",
            role="MEMBER",
            status="ACTIVE",
            branch=self.satellite,
        )
        self.unclustered_sharer = Person.objects.create_user(
            username="bscovuncl",
            password="pass12345",
            first_name="Una",
            last_name="Clusterless",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.hq_cluster = Cluster.objects.create(
            name="HQ Cluster",
            code="BS-HQ",
            branch=self.hq,
            is_active=True,
        )
        self.sat_cluster = Cluster.objects.create(
            name="Satellite Cluster",
            code="BS-SAT",
            branch=self.satellite,
            is_active=True,
        )
        self.uncovered_cluster = Cluster.objects.create(
            name="Uncovered Cluster",
            code="BS-NONE",
            branch=self.hq,
            is_active=True,
        )
        self.hq_group = EvangelismGroup.objects.create(
            name="HQ Study",
            cluster=self.hq_cluster,
            is_active=True,
        )
        self.sat_group = EvangelismGroup.objects.create(
            name="Satellite Study",
            cluster=self.sat_cluster,
            is_active=True,
        )
        self.unclustered_group = EvangelismGroup.objects.create(
            name="Open Study",
            cluster=None,
            is_active=True,
        )
        self.inactive_group = EvangelismGroup.objects.create(
            name="Inactive Study",
            cluster=self.hq_cluster,
            is_active=False,
        )

        ministry = ensure_bible_sharers_ministry()
        self.ministry = ministry
        MinistryMember.objects.create(ministry=ministry, member=self.roster_only)
        grant_evangelism_bible_sharer_access(self.grant_only)

        ModuleCoordinator.objects.create(
            person=self.hq_sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.hq_group.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=self.sat_sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.sat_group.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=self.unclustered_sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.unclustered_group.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=self.roster_only,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.inactive_group.id,
            resource_type="EvangelismGroup",
        )

        self.client.force_authenticate(self.admin)

    def _people_by_id(self, payload):
        return {row["id"]: row for row in payload["people"]}

    def test_roster_only_person_appears_unassigned(self):
        response = self.client.get(COVERAGE_URL)
        self.assertEqual(response.status_code, 200, response.data)
        people = self._people_by_id(response.data)
        row = people[self.roster_only.id]
        self.assertTrue(row["on_hq_roster"])
        self.assertTrue(row["roster_active"])
        self.assertFalse(row["assigned"])
        self.assertEqual(row["groups"], [])
        self.assertFalse(row["has_module_wide_grant"])
        uncovered = response.data["summary"]["clusters_without_names"]
        self.assertIn("Uncovered Cluster", uncovered)

    def test_grant_only_is_unassigned_and_does_not_cover_cluster(self):
        response = self.client.get(COVERAGE_URL)
        self.assertEqual(response.status_code, 200, response.data)
        people = self._people_by_id(response.data)
        row = people[self.grant_only.id]
        self.assertFalse(row["assigned"])
        self.assertTrue(row["has_module_wide_grant"])
        self.assertEqual(row["groups"], [])

        hq_row = next(
            item
            for item in response.data["coverage"]
            if item["cluster"]["id"] == self.hq_cluster.id
        )
        grant_ids = [person["id"] for person in hq_row["bible_sharers"]]
        self.assertNotIn(self.grant_only.id, grant_ids)
        uncovered_row = next(
            item
            for item in response.data["coverage"]
            if item["cluster"]["id"] == self.uncovered_cluster.id
        )
        self.assertFalse(uncovered_row["has_bible_sharers"])

    def test_satellite_branch_omits_hq_idle_roster(self):
        response = self.client.get(COVERAGE_URL, {"branch": self.satellite.id})
        self.assertEqual(response.status_code, 200, response.data)
        ids = {row["id"] for row in response.data["people"]}
        self.assertIn(self.sat_sharer.id, ids)
        self.assertNotIn(self.roster_only.id, ids)
        self.assertNotIn(self.grant_only.id, ids)
        self.assertNotIn(self.hq_sharer.id, ids)
        cluster_ids = [item["cluster"]["id"] for item in response.data["coverage"]]
        self.assertEqual(cluster_ids, [self.sat_cluster.id])
        self.assertEqual(response.data["summary"]["clusters_without_bible_sharers"], 0)

    def test_non_cluster_assignment_in_people_and_coverage(self):
        response = self.client.get(COVERAGE_URL)
        self.assertEqual(response.status_code, 200, response.data)
        people = self._people_by_id(response.data)
        row = people[self.unclustered_sharer.id]
        self.assertTrue(row["assigned"])
        self.assertEqual(len(row["groups"]), 1)
        self.assertIsNone(row["groups"][0]["cluster"])
        self.assertEqual(row["groups"][0]["id"], self.unclustered_group.id)

        no_cluster = next(
            item
            for item in response.data["coverage"]
            if item["cluster"]["id"] is None
        )
        self.assertEqual(no_cluster["cluster"]["name"], "No cluster")
        self.assertTrue(no_cluster["has_bible_sharers"])
        self.assertIn(
            self.unclustered_sharer.id,
            [person["id"] for person in no_cluster["bible_sharers"]],
        )

    def test_hq_branch_includes_roster_and_summary_counts(self):
        response = self.client.get(COVERAGE_URL, {"branch": self.hq.id})
        self.assertEqual(response.status_code, 200, response.data)
        ids = {row["id"] for row in response.data["people"]}
        self.assertIn(self.roster_only.id, ids)
        self.assertIn(self.grant_only.id, ids)
        self.assertIn(self.hq_sharer.id, ids)
        self.assertIn(self.unclustered_sharer.id, ids)
        self.assertNotIn(self.sat_sharer.id, ids)
        summary = response.data["summary"]
        self.assertEqual(summary["total_bible_sharers"], 4)
        self.assertEqual(summary["assigned_count"], 2)
        self.assertEqual(summary["unassigned_count"], 2)
        self.assertEqual(summary["total_clusters"], 2)
        self.assertEqual(summary["clusters_without_bible_sharers"], 1)
        self.assertEqual(summary["bible_sharers_ministry_id"], self.ministry.id)
        self.assertTrue(summary["can_manage_roster"])

    def test_invalid_branch_returns_400(self):
        response = self.client.get(COVERAGE_URL, {"branch": "abc"})
        self.assertEqual(response.status_code, 400)
