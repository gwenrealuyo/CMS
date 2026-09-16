from datetime import date
from unittest.mock import patch

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup
from apps.notifications.services import (
    _build_evangelism_group_pending,
    _build_evangelism_report_due,
)
from apps.people.models import Branch, ModuleCoordinator, Person


class EvangelismGroupApprovalAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTEVGAPP",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="evgappadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.pastor = Person.objects.create_user(
            username="evgapppastor",
            password="pass12345",
            first_name="Pat",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.branch,
        )
        self.senior = Person.objects.create_user(
            username="evgappsenior",
            password="pass12345",
            first_name="Sam",
            last_name="Senior",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.coordinator = Person.objects.create_user(
            username="evgappcoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.other_coord = Person.objects.create_user(
            username="evgappother",
            password="pass12345",
            first_name="Omar",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="evgappmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="Approval Cluster",
            code="EVG-APP",
            branch=self.branch,
            is_active=True,
        )
        self.owned_group = EvangelismGroup.objects.create(
            name="Cora Study",
            coordinator=self.coordinator,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self.other_group = EvangelismGroup.objects.create(
            name="Omar Study",
            coordinator=self.other_coord,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        ModuleCoordinator.objects.create(
            person=self.senior,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.owned_group.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=self.other_coord,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.other_group.id,
            resource_type="EvangelismGroup",
        )

    def _group_payload(self, **overrides):
        payload = {
            "name": "New Small Group",
            "cluster_id": self.cluster.id,
            "branch_id": self.branch.id,
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    def test_coordinator_create_is_pending_privileged_create_is_approved(self):
        self.client.force_authenticate(self.coordinator)
        pending = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(name="Coord Pending"),
            format="json",
        )
        self.assertEqual(pending.status_code, 201, pending.data)
        self.assertEqual(pending.data["approval_status"], "pending")
        self.assertEqual(pending.data["created_by"], self.coordinator.id)
        self.assertEqual(pending.data["coordinator"]["id"], self.coordinator.id)

        self.client.force_authenticate(self.senior)
        senior = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(name="Senior Live"),
            format="json",
        )
        self.assertEqual(senior.status_code, 201, senior.data)
        self.assertEqual(senior.data["approval_status"], "approved")

        self.client.force_authenticate(self.pastor)
        pastor = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(name="Pastor Live"),
            format="json",
        )
        self.assertEqual(pastor.status_code, 201, pastor.data)
        self.assertEqual(pastor.data["approval_status"], "approved")

        self.client.force_authenticate(self.admin)
        admin = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(name="Admin Live"),
            format="json",
        )
        self.assertEqual(admin.status_code, 201, admin.data)
        self.assertEqual(admin.data["approval_status"], "approved")

    def test_coordinator_lists_approved_branch_groups_and_own_pending(self):
        other_pending = EvangelismGroup.objects.create(
            name="Secret Pending",
            coordinator=self.other_coord,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.PENDING,
            created_by=self.other_coord,
        )
        own_pending = EvangelismGroup.objects.create(
            name="My Pending",
            coordinator=self.coordinator,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.PENDING,
            created_by=self.coordinator,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.get("/api/evangelism/groups/", {"page_size": 100})
        self.assertEqual(response.status_code, 200, response.data)
        names = {row["name"] for row in response.data["results"]}
        self.assertIn("Cora Study", names)
        self.assertIn("Omar Study", names)
        self.assertIn("My Pending", names)
        self.assertNotIn("Secret Pending", names)

        hidden = self.client.get(f"/api/evangelism/groups/{other_pending.id}/")
        self.assertEqual(hidden.status_code, 404)

        visible = self.client.get(f"/api/evangelism/groups/{own_pending.id}/")
        self.assertEqual(visible.status_code, 200, visible.data)
        self.assertEqual(visible.data["approval_status"], "pending")

    def test_coordinator_can_patch_own_pending_not_others_approved(self):
        own_pending = EvangelismGroup.objects.create(
            name="Draft Group",
            coordinator=self.coordinator,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.PENDING,
            created_by=self.coordinator,
        )
        self.client.force_authenticate(self.coordinator)
        ok = self.client.patch(
            f"/api/evangelism/groups/{own_pending.id}/",
            {"description": "Updated draft"},
            format="json",
        )
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["description"], "Updated draft")

        denied = self.client.patch(
            f"/api/evangelism/groups/{self.other_group.id}/",
            {"description": "Hijack"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

    def test_coordinator_cannot_report_on_pending_then_can_after_approve(self):
        self.client.force_authenticate(self.coordinator)
        created = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(name="Report After Approve"),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        group_id = created.data["id"]
        blocked = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": group_id,
                "meeting_date": "2026-09-16",
                "gathering_type": "PHYSICAL",
            },
            format="json",
        )
        self.assertIn(blocked.status_code, (400, 403), blocked.data)

        self.client.force_authenticate(self.senior)
        approved = self.client.post(
            f"/api/evangelism/groups/{group_id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["approval_status"], "approved")

        self.client.force_authenticate(self.coordinator)
        allowed = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": group_id,
                "meeting_date": "2026-09-16",
                "gathering_type": "PHYSICAL",
            },
            format="json",
        )
        self.assertEqual(allowed.status_code, 201, allowed.data)

    def test_coordinator_cannot_report_for_unmanaged_group(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.other_group.id,
                "meeting_date": "2026-09-16",
                "gathering_type": "PHYSICAL",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.data)

    def test_senior_can_reject_non_senior_cannot_approve(self):
        pending = EvangelismGroup.objects.create(
            name="Needs Review",
            coordinator=self.coordinator,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.PENDING,
            created_by=self.coordinator,
        )
        self.client.force_authenticate(self.coordinator)
        denied = self.client.post(
            f"/api/evangelism/groups/{pending.id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.senior)
        rejected = self.client.post(
            f"/api/evangelism/groups/{pending.id}/reject/",
            {"review_note": "Overlap"},
            format="json",
        )
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data["approval_status"], "rejected")
        self.assertEqual(rejected.data["review_note"], "Overlap")

    def test_report_due_skips_pending_groups(self):
        pending = EvangelismGroup.objects.create(
            name="Pending Due",
            coordinator=self.coordinator,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            meeting_frequency=EvangelismGroup.MeetingFrequency.WEEKLY,
            approval_status=EvangelismGroup.ApprovalStatus.PENDING,
            created_by=self.coordinator,
        )
        with patch(
            "apps.notifications.services.church_today", return_value=date(2026, 9, 16)
        ):
            items = _build_evangelism_report_due(self.coordinator)
        group_ids = {
            int(item.key.split(":")[1])
            for item in items
            if item.type == "evangelism_report_due"
        }
        self.assertIn(self.owned_group.id, group_ids)
        self.assertNotIn(pending.id, group_ids)

        pending_alerts = _build_evangelism_group_pending(self.senior)
        self.assertTrue(
            any(item.key == f"evangelism_group_pending:{pending.id}" for item in pending_alerts)
        )
        self.assertEqual(
            _build_evangelism_group_pending(self.coordinator),
            [],
        )

    def _member_ids(self, payload):
        return {row["id"] for row in payload.get("members", [])}

    def test_coordinator_can_create_pending_group_with_members(self):
        self.client.force_authenticate(self.coordinator)
        created = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(
                name="Pending With Members",
                members=[self.member.id],
            ),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["approval_status"], "pending")
        self.assertIn(self.member.id, self._member_ids(created.data))

    def test_coordinator_can_enroll_and_patch_members_on_own_pending(self):
        extra = Person.objects.create_user(
            username="evgapppatch",
            password="pass12345",
            first_name="Pia",
            last_name="Patch",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        own_pending = EvangelismGroup.objects.create(
            name="Draft Members",
            coordinator=self.coordinator,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.PENDING,
            created_by=self.coordinator,
        )
        self.client.force_authenticate(self.coordinator)
        enrolled = self.client.post(
            f"/api/evangelism/groups/{own_pending.id}/enroll/",
            {"person_ids": [self.member.id]},
            format="json",
        )
        self.assertIn(enrolled.status_code, (200, 201), enrolled.data)

        patched = self.client.patch(
            f"/api/evangelism/groups/{own_pending.id}/",
            {"members": [self.member.id, extra.id]},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        ids = self._member_ids(patched.data)
        self.assertIn(self.member.id, ids)
        self.assertIn(extra.id, ids)

        session = self.client.post(
            "/api/evangelism/sessions/",
            {
                "evangelism_group_id": own_pending.id,
                "session_date": "2026-09-16",
                "topic": "Too soon",
            },
            format="json",
        )
        self.assertIn(session.status_code, (400, 403), session.data)

        denied = self.client.post(
            f"/api/evangelism/groups/{self.other_group.id}/enroll/",
            {"person_ids": [self.member.id]},
            format="json",
        )
        self.assertEqual(denied.status_code, 403, denied.data)

    def test_coordinator_can_enroll_after_approval(self):
        extra = Person.objects.create_user(
            username="evgappafter",
            password="pass12345",
            first_name="Ava",
            last_name="After",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.client.force_authenticate(self.coordinator)
        created = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(name="Approve Then Enroll", members=[self.member.id]),
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        group_id = created.data["id"]

        self.client.force_authenticate(self.senior)
        approved = self.client.post(
            f"/api/evangelism/groups/{group_id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)

        self.client.force_authenticate(self.coordinator)
        enrolled = self.client.post(
            f"/api/evangelism/groups/{group_id}/enroll/",
            {"person_ids": [extra.id]},
            format="json",
        )
        self.assertIn(enrolled.status_code, (200, 201), enrolled.data)

        patched = self.client.patch(
            f"/api/evangelism/groups/{group_id}/",
            {"members": [self.member.id, extra.id]},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        ids = self._member_ids(patched.data)
        self.assertIn(self.member.id, ids)
        self.assertIn(extra.id, ids)
