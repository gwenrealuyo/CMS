from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup
from apps.ministries.bible_sharers import (
    backfill_bible_sharers_roster_from_assignments,
    ensure_bible_sharers_ministry,
    headquarters_branch,
    person_has_evangelism_bible_sharer_access,
    person_on_bible_sharers_roster,
)
from apps.ministries.models import (
    BIBLE_SHARERS_MINISTRY_CODE,
    Ministry,
    MinistryMember,
)
from apps.people.models import Branch, ModuleCoordinator, Person


class BibleSharersMinistryRosterTests(TestCase):
    def setUp(self):
        self.hq = headquarters_branch()
        self.assertIsNotNone(self.hq)
        self.satellite = (
            Branch.objects.filter(is_headquarters=False, is_active=True)
            .exclude(pk=self.hq.id)
            .first()
        )
        if self.satellite is None:
            self.satellite = Branch.objects.create(
                name="Satellite",
                code="BSSAT",
                is_active=True,
                is_headquarters=False,
            )
        self.admin = Person.objects.create_user(
            username="bs_admin",
            email="bs_admin@test.com",
            password="testpass123",
            first_name="Bs",
            last_name="Admin",
            role="ADMIN",
            branch=self.hq,
            status="ACTIVE",
        )
        self.hq_pastor = Person.objects.create_user(
            username="bs_hq_pastor",
            email="bs_hq_pastor@test.com",
            password="testpass123",
            first_name="Hq",
            last_name="Pastor",
            role="PASTOR",
            branch=self.hq,
            status="ACTIVE",
        )
        self.sat_pastor = Person.objects.create_user(
            username="bs_sat_pastor",
            email="bs_sat_pastor@test.com",
            password="testpass123",
            first_name="Sat",
            last_name="Pastor",
            role="PASTOR",
            branch=self.satellite,
            status="ACTIVE",
        )
        self.hq_ev_coord = Person.objects.create_user(
            username="bs_hq_ev",
            email="bs_hq_ev@test.com",
            password="testpass123",
            first_name="Hq",
            last_name="Evcoord",
            role="MEMBER",
            branch=self.hq,
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=self.hq_ev_coord,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.sat_ev_coord = Person.objects.create_user(
            username="bs_sat_ev",
            email="bs_sat_ev@test.com",
            password="testpass123",
            first_name="Sat",
            last_name="Evcoord",
            role="MEMBER",
            branch=self.satellite,
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=self.sat_ev_coord,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.member = Person.objects.create_user(
            username="bs_member",
            email="bs_member@test.com",
            password="testpass123",
            first_name="Roster",
            last_name="Member",
            role="MEMBER",
            branch=self.hq,
            status="ACTIVE",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_ensure_creates_only_on_hq_and_is_idempotent(self):
        first = ensure_bible_sharers_ministry()
        second = ensure_bible_sharers_ministry()
        self.assertIsNotNone(first)
        self.assertEqual(first.id, second.id)
        self.assertEqual(first.code, BIBLE_SHARERS_MINISTRY_CODE)
        self.assertTrue(first.is_system)
        self.assertEqual(first.branch_id, self.hq.id)
        self.assertFalse(first.is_ncc_roster)
        self.assertTrue(first.is_bible_sharers_roster)
        self.assertEqual(
            Ministry.objects.filter(
                code=BIBLE_SHARERS_MINISTRY_CODE, is_system=True
            ).count(),
            1,
        )
        self.assertFalse(
            Ministry.objects.filter(
                code=BIBLE_SHARERS_MINISTRY_CODE, branch=self.satellite
            ).exists()
        )

    def test_ensure_noop_without_headquarters(self):
        Ministry.objects.filter(code=BIBLE_SHARERS_MINISTRY_CODE).delete()
        Branch.objects.filter(is_headquarters=True).update(is_headquarters=False)
        self.assertIsNone(headquarters_branch())
        self.assertIsNone(ensure_bible_sharers_ministry())
        self.assertFalse(
            Ministry.objects.filter(code=BIBLE_SHARERS_MINISTRY_CODE).exists()
        )

    def test_signal_creates_on_hq_branch_not_satellite(self):
        extra_sat = Branch.objects.create(
            name="Another Satellite",
            code="BSSAT2",
            is_active=True,
            is_headquarters=False,
        )
        self.assertFalse(
            Ministry.objects.filter(
                code=BIBLE_SHARERS_MINISTRY_CODE, branch=extra_sat
            ).exists()
        )
        ensure_bible_sharers_ministry()
        self.assertTrue(
            Ministry.objects.filter(
                code=BIBLE_SHARERS_MINISTRY_CODE,
                branch=self.hq,
                is_system=True,
            ).exists()
        )
        self.assertEqual(
            Ministry.objects.filter(
                code=BIBLE_SHARERS_MINISTRY_CODE, is_system=True
            ).count(),
            1,
        )

    def test_reserved_code_rejected_via_api(self):
        response = self.client.post(
            "/api/ministries/",
            {
                "name": "Fake Bible Sharers",
                "code": BIBLE_SHARERS_MINISTRY_CODE,
                "activity_cadence": "weekly",
                "scope": "BRANCH",
                "branch": self.satellite.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details") or response.data
        self.assertIn("code", details)

    def test_system_ministry_cannot_be_deleted(self):
        ministry = ensure_bible_sharers_ministry()
        response = self.client.delete(f"/api/ministries/{ministry.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Ministry.objects.filter(pk=ministry.id).exists())

    def test_hq_evangelism_coordinator_can_manage_members(self):
        ministry = ensure_bible_sharers_ministry()
        self.client.force_authenticate(user=self.hq_ev_coord)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": self.member.id,
                "role": "team_member",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(person_on_bible_sharers_roster(self.member))

    def test_satellite_evangelism_coordinator_cannot_manage_members(self):
        ministry = ensure_bible_sharers_ministry()
        self.client.force_authenticate(user=self.sat_ev_coord)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": self.member.id,
                "role": "team_member",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_satellite_pastor_cannot_manage_members(self):
        ministry = ensure_bible_sharers_ministry()
        self.client.force_authenticate(user=self.sat_pastor)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": self.member.id,
                "role": "team_member",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_hq_pastor_can_manage_members(self):
        ministry = ensure_bible_sharers_ministry()
        self.client.force_authenticate(user=self.hq_pastor)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": ministry.id,
                "member_id": self.member.id,
                "role": "team_member",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_evangelism_coordinator_cannot_manage_other_ministry(self):
        other = Ministry.objects.create(
            name="Worship",
            code="WORSHIP-BSHQ",
            scope="BRANCH",
            branch=self.hq,
            is_active=True,
        )
        self.client.force_authenticate(user=self.hq_ev_coord)
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": other.id,
                "member_id": self.member.id,
                "role": "team_member",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_backfill_hq_assignments_only(self):
        ministry = ensure_bible_sharers_ministry()
        MinistryMember.objects.filter(ministry=ministry).delete()

        hq_cluster = Cluster.objects.create(
            code="BS-HQ-C",
            name="HQ Cluster",
            branch=self.hq,
        )
        sat_cluster = Cluster.objects.create(
            code="BS-SAT-C",
            name="Sat Cluster",
            branch=self.satellite,
        )
        hq_group = EvangelismGroup.objects.create(
            name="HQ Group",
            cluster=hq_cluster,
            is_active=True,
        )
        sat_group = EvangelismGroup.objects.create(
            name="Sat Group",
            cluster=sat_cluster,
            is_active=True,
        )
        sat_person = Person.objects.create_user(
            username="bs_sat_sharer",
            email="bs_sat_sharer@test.com",
            password="testpass123",
            first_name="Sat",
            last_name="Sharer",
            role="MEMBER",
            branch=self.satellite,
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=self.member,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=hq_group.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=sat_person,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=sat_group.id,
            resource_type="EvangelismGroup",
        )
        created = backfill_bible_sharers_roster_from_assignments()
        self.assertGreaterEqual(created, 1)
        self.assertTrue(person_on_bible_sharers_roster(self.member))
        self.assertFalse(person_on_bible_sharers_roster(sat_person))


class EvangelismHqBibleSharerRosterAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hq = headquarters_branch()
        self.assertIsNotNone(self.hq)
        self.satellite = (
            Branch.objects.filter(is_headquarters=False, is_active=True)
            .exclude(pk=self.hq.id)
            .first()
        )
        if self.satellite is None:
            self.satellite = Branch.objects.create(
                name="Satellite",
                code="EVBSSAT",
                is_active=True,
            )
        self.admin = Person.objects.create_user(
            username="ev_bs_admin",
            password="password123",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.coordinator = Person.objects.create_user(
            username="ev_bs_coord",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.sharer = Person.objects.create_user(
            username="ev_bs_sharer",
            password="password123",
            first_name="Sharer",
            last_name="Hq",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        self.hq_cluster = Cluster.objects.create(
            code="EV-BS-HQ",
            name="HQ Role Cluster",
            branch=self.hq,
        )
        self.sat_cluster = Cluster.objects.create(
            code="EV-BS-SAT",
            name="Sat Role Cluster",
            branch=self.satellite,
        )
        self.hq_group = EvangelismGroup.objects.create(
            name="HQ Role Group",
            cluster=self.hq_cluster,
            coordinator=self.coordinator,
            is_active=True,
        )
        self.hq_group.members.add(self.coordinator, self.sharer)
        self.sat_group = EvangelismGroup.objects.create(
            name="Sat Role Group",
            cluster=self.sat_cluster,
            coordinator=self.coordinator,
            is_active=True,
        )
        self.sat_group.members.add(self.coordinator, self.sharer)
        self.client.force_authenticate(user=self.admin)
        self.ministry = ensure_bible_sharers_ministry()

    def test_hq_group_rejects_non_roster_bible_sharer(self):
        response = self.client.patch(
            f"/api/evangelism/groups/{self.hq_group.id}/",
            {"bible_sharer_ids": [self.sharer.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = response.data.get("details") or response.data
        self.assertIn("bible_sharer_ids", details)

    def test_hq_group_accepts_inactive_roster_member(self):
        MinistryMember.objects.create(
            ministry=self.ministry,
            member=self.sharer,
            role="team_member",
            is_active=False,
        )
        response = self.client.patch(
            f"/api/evangelism/groups/{self.hq_group.id}/",
            {"bible_sharer_ids": [self.sharer.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(set(response.data["bible_sharer_ids"]), {self.sharer.id})

    def test_non_hq_group_still_accepts_any_member(self):
        response = self.client.patch(
            f"/api/evangelism/groups/{self.sat_group.id}/",
            {"bible_sharer_ids": [self.sharer.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(set(response.data["bible_sharer_ids"]), {self.sharer.id})


class BibleSharersEvangelismGrantTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.hq = headquarters_branch()
        self.assertIsNotNone(self.hq)
        self.admin = Person.objects.create_user(
            username="bs_grant_admin",
            email="bs_grant_admin@test.com",
            password="testpass123",
            first_name="Grant",
            last_name="Admin",
            role="ADMIN",
            branch=self.hq,
            status="ACTIVE",
        )
        self.sharer = Person.objects.create_user(
            username="bs_grant_sharer",
            email="bs_grant_sharer@test.com",
            password="testpass123",
            first_name="Grant",
            last_name="Sharer",
            role="MEMBER",
            branch=self.hq,
            status="ACTIVE",
        )
        self.ministry = ensure_bible_sharers_ministry()
        self.cluster = Cluster.objects.create(
            code="BS-GNT",
            name="Grant Cluster",
            branch=self.hq,
        )
        self.group = EvangelismGroup.objects.create(
            name="Grant Group",
            cluster=self.cluster,
            is_active=True,
        )
        self.group.members.add(self.sharer)
        self.client.force_authenticate(user=self.admin)

    def _module_wide_qs(self, person=None):
        person = person or self.sharer
        return ModuleCoordinator.objects.filter(
            person=person,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id__isnull=True,
        )

    def _group_qs(self, person=None):
        person = person or self.sharer
        return ModuleCoordinator.objects.filter(
            person=person,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
        )

    def _report_payload(self):
        return {
            "evangelism_group_id": self.group.id,
            "year": 2026,
            "week_number": 10,
            "meeting_date": "2026-03-04",
            "gathering_type": "PHYSICAL",
            "members_attended": [],
            "visitors_attended": [],
        }

    def test_grant_on_add_creates_module_wide_row(self):
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": self.ministry.id,
                "member_id": self.sharer.id,
                "role": "team_member",
                "grant_evangelism_bible_sharer_access": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["has_evangelism_bible_sharer_access"])
        self.assertTrue(self._module_wide_qs().exists())
        self.assertTrue(person_has_evangelism_bible_sharer_access(self.sharer))

    def test_default_grant_on_create(self):
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": self.ministry.id,
                "member_id": self.sharer.id,
                "role": "team_member",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["has_evangelism_bible_sharer_access"])
        self.assertTrue(self._module_wide_qs().exists())

    def test_grant_off_does_not_create_row(self):
        response = self.client.post(
            "/api/ministries/members/",
            {
                "ministry": self.ministry.id,
                "member_id": self.sharer.id,
                "role": "team_member",
                "grant_evangelism_bible_sharer_access": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertFalse(response.data["has_evangelism_bible_sharer_access"])
        self.assertFalse(self._module_wide_qs().exists())

    def test_uncheck_and_inactive_delete_module_wide_only(self):
        membership = MinistryMember.objects.create(
            ministry=self.ministry,
            member=self.sharer,
            role="team_member",
            is_active=True,
        )
        ModuleCoordinator.objects.create(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=None,
            resource_type="",
        )
        ModuleCoordinator.objects.create(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )
        response = self.client.patch(
            f"/api/ministries/members/{membership.id}/",
            {"grant_evangelism_bible_sharer_access": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(self._module_wide_qs().exists())
        self.assertTrue(self._group_qs().exists())

        ModuleCoordinator.objects.create(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=None,
            resource_type="",
        )
        response = self.client.patch(
            f"/api/ministries/members/{membership.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(self._module_wide_qs().exists())
        self.assertTrue(self._group_qs().exists())
        self.assertFalse(response.data["has_evangelism_bible_sharer_access"])

    def test_module_wide_only_is_read_only(self):
        MinistryMember.objects.create(
            ministry=self.ministry,
            member=self.sharer,
            role="team_member",
            is_active=True,
        )
        ModuleCoordinator.objects.create(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=None,
            resource_type="",
        )
        self.client.force_authenticate(user=self.sharer)
        groups = self.client.get("/api/evangelism/groups/")
        self.assertEqual(groups.status_code, status.HTTP_200_OK)
        payload = groups.data
        rows = (
            payload["results"]
            if isinstance(payload, dict) and "results" in payload
            else payload
        )
        self.assertIn(self.group.id, {row["id"] for row in rows})

        patch = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"location": "Hall"},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_403_FORBIDDEN)

        report = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(),
            format="json",
        )
        self.assertEqual(report.status_code, status.HTTP_403_FORBIDDEN)

    def test_group_assigned_bible_sharer_can_submit_report(self):
        ModuleCoordinator.objects.create(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )
        self.client.force_authenticate(user=self.sharer)
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
