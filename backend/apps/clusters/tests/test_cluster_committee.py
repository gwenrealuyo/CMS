from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.clusters.permissions import (
    can_manage_cluster_committee_leadership,
    can_pick_cluster_branch,
    has_cluster_oversight_access,
)
from apps.ministries.cluster_committee import (
    ensure_cluster_committee_ministry,
    seed_cluster_committee_ministries_for_all_branches,
)
from apps.ministries.models import CLUSTER_COMMITTEE_MINISTRY_CODE, Ministry
from apps.people.coordinator_assignment_validation import user_can_add_person
from apps.people.models import Branch, ModuleCoordinator, Person


class ClusterCommitteeTests(APITestCase):
    def setUp(self):
        self.hq = Branch.objects.create(
            name="Headquarters",
            code="HQCC",
            is_active=True,
            is_headquarters=True,
        )
        self.branch = Branch.objects.create(
            name="Satellite",
            code="SATCC",
            is_active=True,
            is_headquarters=False,
        )
        self.other = Branch.objects.create(
            name="Other Satellite",
            code="OTHCC",
            is_active=True,
            is_headquarters=False,
        )
        self.primary = self._member("ccprimary", self.branch)
        self.support = self._member("ccsupport", self.branch)
        self.hq_primary = self._member("cchqprimary", self.hq)
        self.hq_senior = self._member("cchqsenior", self.hq)
        self.local_senior = self._member("cclocalsenior", self.branch)
        ModuleCoordinator.objects.create(
            person=self.hq_senior,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            resource_id=None,
        )
        ModuleCoordinator.objects.create(
            person=self.local_senior,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            resource_id=None,
        )
        self.committee = Ministry.objects.get(
            code=CLUSTER_COMMITTEE_MINISTRY_CODE,
            branch=self.branch,
        )
        self.hq_committee = Ministry.objects.get(
            code=CLUSTER_COMMITTEE_MINISTRY_CODE,
            branch=self.hq,
        )
        self.committee.primary_coordinator = self.primary
        self.committee.save()
        self.committee.support_coordinators.add(self.support)
        self.hq_committee.primary_coordinator = self.hq_primary
        self.hq_committee.save()

    def _member(self, username, branch):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=username,
            last_name="Committee",
            role="MEMBER",
            status="ACTIVE",
            branch=branch,
            water_baptism_date=date(2020, 1, 1),
        )

    def _details(self, response):
        return response.data.get("details", response.data)

    def test_seed_creates_one_committee_per_active_branch(self):
        self.assertTrue(self.committee.is_system)
        self.assertEqual(self.committee.name, "Cluster Committee")
        self.assertEqual(self.committee.scope, "BRANCH")
        before = Ministry.objects.filter(code=CLUSTER_COMMITTEE_MINISTRY_CODE).count()
        created = seed_cluster_committee_ministries_for_all_branches()
        self.assertEqual(created, 0)
        again = ensure_cluster_committee_ministry(self.branch)
        self.assertEqual(again.pk, self.committee.pk)
        self.assertEqual(
            Ministry.objects.filter(code=CLUSTER_COMMITTEE_MINISTRY_CODE).count(),
            before,
        )
        self.assertFalse(
            ModuleCoordinator.objects.filter(
                person=self.primary,
                module=ModuleCoordinator.ModuleType.CLUSTER,
                level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
            ).exists()
        )

    def test_support_can_add_and_patch_cluster_but_not_committee_leadership(self):
        self.assertTrue(has_cluster_oversight_access(self.support))
        self.assertFalse(can_pick_cluster_branch(self.support))
        self.assertTrue(user_can_add_person(self.support))
        self.client.force_authenticate(self.support)
        created = self.client.post(
            "/api/clusters/clusters/",
            {
                "name": "Support Cluster",
                "code": "SUP-01",
                "branch": self.branch.id,
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        patched = self.client.patch(
            f"/api/clusters/clusters/{created.data['id']}/",
            {"location": "Hall B"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        other_branch = self.client.post(
            "/api/clusters/clusters/",
            {
                "name": "Wrong Branch",
                "code": "SUP-02",
                "branch": self.other.id,
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(other_branch.status_code, 400, other_branch.data)
        self.assertIn("branch", self._details(other_branch))
        leadership = self.client.patch(
            f"/api/ministries/{self.committee.id}/",
            {"support_coordinator_ids": []},
            format="json",
        )
        self.assertEqual(leadership.status_code, 403, leadership.data)
        person = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Person",
                "role": "MEMBER",
                "status": "ACTIVE",
                "branch": self.branch.id,
            },
            format="json",
        )
        self.assertEqual(person.status_code, 201, person.data)

    def test_non_hq_primary_sets_supports_and_cannot_pick_branch(self):
        self.assertTrue(has_cluster_oversight_access(self.primary))
        self.assertFalse(can_pick_cluster_branch(self.primary))
        self.assertTrue(
            can_manage_cluster_committee_leadership(self.primary, self.committee)
        )
        self.assertFalse(
            can_manage_cluster_committee_leadership(self.support, self.committee)
        )
        self.client.force_authenticate(self.primary)
        extra = self._member("ccsupport2", self.branch)
        updated = self.client.patch(
            f"/api/ministries/{self.committee.id}/",
            {"support_coordinator_ids": [self.support.id, extra.id]},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.committee.refresh_from_db()
        self.assertCountEqual(
            list(self.committee.support_coordinators.values_list("id", flat=True)),
            [self.support.id, extra.id],
        )
        denied = self.client.post(
            "/api/clusters/clusters/",
            {
                "name": "Other",
                "code": "PRI-02",
                "branch": self.other.id,
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(denied.status_code, 400, denied.data)
        self.assertIn("branch", self._details(denied))

    def test_hq_primary_and_hq_senior_can_pick_another_branch(self):
        self.assertTrue(can_pick_cluster_branch(self.hq_primary))
        self.assertTrue(can_pick_cluster_branch(self.hq_senior))
        self.assertFalse(can_pick_cluster_branch(self.local_senior))
        self.client.force_authenticate(self.hq_primary)
        hq_created = self.client.post(
            "/api/clusters/clusters/",
            {
                "name": "From HQ Primary",
                "code": "HQ-01",
                "branch": self.other.id,
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(hq_created.status_code, 201, hq_created.data)
        self.client.force_authenticate(self.hq_senior)
        senior_created = self.client.post(
            "/api/clusters/clusters/",
            {
                "name": "From HQ Senior",
                "code": "HQ-02",
                "branch": self.branch.id,
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(senior_created.status_code, 201, senior_created.data)
        self.client.force_authenticate(self.local_senior)
        locked = self.client.post(
            "/api/clusters/clusters/",
            {
                "name": "Local Senior",
                "code": "LOC-02",
                "branch": self.other.id,
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(locked.status_code, 400, locked.data)
        own = self.client.post(
            "/api/clusters/clusters/",
            {
                "name": "Local Own",
                "code": "LOC-01",
                "branch": self.branch.id,
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(own.status_code, 201, own.data)

    def test_resource_assistant_still_cannot_change_leadership(self):
        coordinator = self._member("cccoord", self.branch)
        assistant = self._member("ccasst", self.branch)
        cluster = Cluster.objects.create(
            name="Assist Still",
            code="ASST-CC",
            branch=self.branch,
            coordinator=coordinator,
            is_active=True,
        )
        cluster.members.add(coordinator, assistant)
        ModuleCoordinator.objects.create(
            person=assistant,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.ASSISTANT_COORDINATOR,
            resource_id=cluster.id,
        )
        self.client.force_authenticate(assistant)
        response = self.client.patch(
            f"/api/clusters/clusters/{cluster.id}/",
            {"assistant_ids": [assistant.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("assistant_ids", self._details(response))
