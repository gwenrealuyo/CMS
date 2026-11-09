from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterTransferRequest
from apps.clusters.primary_membership import sync_primary_cluster
from apps.people.models import Branch, Journey, ModuleCoordinator, Person


class PrimaryClusterAndTransferAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Primary Branch",
            code="PRIMBR",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="primadmin",
            password="pass12345",
            first_name="Pat",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.senior = Person.objects.create_user(
            username="primsenior",
            password="pass12345",
            first_name="Sue",
            last_name="Senior",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        ModuleCoordinator.objects.create(
            person=self.senior,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        self.reporter = Person.objects.create_user(
            username="primreporter",
            password="pass12345",
            first_name="Ray",
            last_name="Reporter",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.east = Cluster.objects.create(
            name="Primary East",
            code="PRIM-EAST",
            branch=self.branch,
            is_active=True,
            coordinator=self.admin,
        )
        self.west = Cluster.objects.create(
            name="Primary West",
            code="PRIM-WEST",
            branch=self.branch,
            is_active=True,
        )
        ModuleCoordinator.objects.create(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.east.id,
        )
        self.client.force_authenticate(self.admin)

    def _person(self, username):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=username.title(),
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )

    def test_sole_membership_auto_primary(self):
        member = self._person("solemember")
        self.east.members.add(member)
        sync_primary_cluster(member)
        member.refresh_from_db()
        self.assertEqual(member.primary_cluster_id, self.east.id)

    def test_dual_add_keeps_existing_primary(self):
        member = self._person("dualprim")
        self.east.members.add(member)
        sync_primary_cluster(member)

        response = self.client.put(
            f"/api/clusters/clusters/{self.west.id}/",
            {
                "code": self.west.code,
                "name": self.west.name,
                "branch": self.branch.id,
                "members": [member.id],
                "families": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        member.refresh_from_db()
        self.assertEqual(
            set(member.clusters.values_list("id", flat=True)),
            {self.east.id, self.west.id},
        )
        self.assertEqual(member.primary_cluster_id, self.east.id)

    def test_person_multi_requires_primary_cluster_id(self):
        member = self._person("needprim")
        self.east.members.add(member)
        self.west.members.add(member)
        member.primary_cluster = None
        member.save(update_fields=["primary_cluster"])

        response = self.client.patch(
            f"/api/people/people/{member.id}/",
            {"cluster_ids": [self.east.id, self.west.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("primary_cluster_id", details)

        response_ok = self.client.patch(
            f"/api/people/people/{member.id}/",
            {
                "cluster_ids": [self.east.id, self.west.id],
                "primary_cluster_id": self.west.id,
            },
            format="json",
        )
        self.assertEqual(response_ok.status_code, 200, response_ok.data)
        member.refresh_from_db()
        self.assertEqual(member.primary_cluster_id, self.west.id)

    def test_person_edit_dual_add_secondary_keeps_primary(self):
        member = self._person("editdual")
        self.east.members.add(member)
        sync_primary_cluster(member)

        response = self.client.patch(
            f"/api/people/people/{member.id}/",
            {
                "cluster_ids": [self.east.id, self.west.id],
                "primary_cluster_id": self.east.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        member.refresh_from_db()
        self.assertEqual(
            set(member.clusters.values_list("id", flat=True)),
            {self.east.id, self.west.id},
        )
        self.assertEqual(member.primary_cluster_id, self.east.id)

    def test_person_edit_cannot_change_primary_cluster_id(self):
        member = self._person("editprimchg")
        self.east.members.add(member)
        self.west.members.add(member)
        sync_primary_cluster(member, preferred_cluster_id=self.east.id)
        member.refresh_from_db()
        self.assertEqual(member.primary_cluster_id, self.east.id)

        response = self.client.patch(
            f"/api/people/people/{member.id}/",
            {
                "cluster_ids": [self.east.id, self.west.id],
                "primary_cluster_id": self.west.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("primary_cluster_id", details)
        member.refresh_from_db()
        self.assertEqual(member.primary_cluster_id, self.east.id)

    def test_person_edit_cannot_drop_primary_from_cluster_ids(self):
        member = self._person("editprimdrop")
        self.east.members.add(member)
        self.west.members.add(member)
        sync_primary_cluster(member, preferred_cluster_id=self.east.id)

        response = self.client.patch(
            f"/api/people/people/{member.id}/",
            {"cluster_ids": [self.west.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("cluster_ids", details)
        member.refresh_from_db()
        self.assertEqual(
            set(member.clusters.values_list("id", flat=True)),
            {self.east.id, self.west.id},
        )
        self.assertEqual(member.primary_cluster_id, self.east.id)

    def test_person_edit_can_remove_secondary_cluster(self):
        member = self._person("editsecrm")
        self.east.members.add(member)
        self.west.members.add(member)
        sync_primary_cluster(member, preferred_cluster_id=self.east.id)

        response = self.client.patch(
            f"/api/people/people/{member.id}/",
            {
                "cluster_ids": [self.east.id],
                "primary_cluster_id": self.east.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        member.refresh_from_db()
        self.assertEqual(
            set(member.clusters.values_list("id", flat=True)), {self.east.id}
        )
        self.assertEqual(member.primary_cluster_id, self.east.id)

    def test_transfer_request_requires_reason(self):
        member = self._person("xferreason")
        self.east.members.add(member)
        sync_primary_cluster(member)

        blank = self.client.post(
            "/api/clusters/transfer-requests/",
            {
                "person_id": member.id,
                "from_cluster_id": self.east.id,
                "to_cluster_id": self.west.id,
                "reason": "   ",
            },
            format="json",
        )
        self.assertEqual(blank.status_code, 400, blank.data)
        details = blank.data.get("details") or blank.data
        self.assertIn("reason", details)

    def test_list_transfer_requests_filter_by_person_and_pending(self):
        member = self._person("xferlist")
        other = self._person("xferlist2")
        self.east.members.add(member)
        self.east.members.add(other)
        sync_primary_cluster(member)
        sync_primary_cluster(other)
        ClusterTransferRequest.objects.create(
            person=member,
            from_cluster=self.east,
            to_cluster=self.west,
            requested_by=self.admin,
        )
        ClusterTransferRequest.objects.create(
            person=other,
            from_cluster=self.east,
            to_cluster=self.west,
            requested_by=self.admin,
        )

        response = self.client.get(
            "/api/clusters/transfer-requests/",
            {"status": "pending", "person": member.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["person"]["id"], member.id)

    def test_transfer_request_approve_applies_move(self):
        member = self._person("xferreq")
        self.east.members.add(member)
        sync_primary_cluster(member)

        create = self.client.post(
            "/api/clusters/transfer-requests/",
            {
                "person_id": member.id,
                "from_cluster_id": self.east.id,
                "to_cluster_id": self.west.id,
                "reason": "Pastoral move",
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        transfer_id = create.data["id"]

        approve = self.client.post(
            f"/api/clusters/transfer-requests/{transfer_id}/approve/",
            {"note": "ok"},
            format="json",
        )
        self.assertEqual(approve.status_code, 200, approve.data)
        self.assertEqual(approve.data["status"], "approved")

        member.refresh_from_db()
        self.assertEqual(
            set(member.clusters.values_list("id", flat=True)), {self.west.id}
        )
        self.assertEqual(member.primary_cluster_id, self.west.id)
        journey = (
            Journey.objects.filter(user=member, type="CLUSTER")
            .order_by("-id")
            .first()
        )
        self.assertIsNotNone(journey)
        self.assertIn("Transferred from", journey.description)
        self.assertIn("PRIM-EAST", journey.description)

    def test_transfer_reject_leaves_memberships(self):
        member = self._person("xferrej")
        self.east.members.add(member)
        sync_primary_cluster(member)
        transfer = ClusterTransferRequest.objects.create(
            person=member,
            from_cluster=self.east,
            to_cluster=self.west,
            requested_by=self.admin,
        )
        reject = self.client.post(
            f"/api/clusters/transfer-requests/{transfer.id}/reject/",
            {"note": "no"},
            format="json",
        )
        self.assertEqual(reject.status_code, 200, reject.data)
        member.refresh_from_db()
        self.assertEqual(
            set(member.clusters.values_list("id", flat=True)), {self.east.id}
        )
        self.assertEqual(member.primary_cluster_id, self.east.id)

    def test_reporter_cannot_approve_transfer(self):
        member = self._person("xferrep")
        self.east.members.add(member)
        sync_primary_cluster(member)
        transfer = ClusterTransferRequest.objects.create(
            person=member,
            from_cluster=self.east,
            to_cluster=self.west,
            requested_by=self.admin,
        )
        self.client.force_authenticate(self.reporter)
        approve = self.client.post(
            f"/api/clusters/transfer-requests/{transfer.id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approve.status_code, 403)
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, ClusterTransferRequest.Status.PENDING)
