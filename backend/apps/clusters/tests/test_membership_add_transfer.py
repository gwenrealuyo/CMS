from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.people.models import Branch, Family, Journey, Person


class ClusterMembershipAddTransferAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTXFER",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="xferadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.east = Cluster.objects.create(
            name="East Cluster",
            code="XFER-EAST",
            branch=self.branch,
            is_active=True,
        )
        self.west = Cluster.objects.create(
            name="West Cluster",
            code="XFER-WEST",
            branch=self.branch,
            is_active=True,
        )
        self.client.force_authenticate(self.admin)

    def _person(self, username, **kwargs):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=kwargs.get("first_name", username.title()),
            last_name=kwargs.get("last_name", "Test"),
            role=kwargs.get("role", "MEMBER"),
            status="ACTIVE",
            branch=self.branch,
        )

    def _put_members(self, cluster, member_ids, transfer_member_ids=None, families=None):
        payload = {
            "code": cluster.code,
            "name": cluster.name,
            "branch": cluster.branch_id,
            "members": member_ids,
            "families": families if families is not None else [],
            "location": cluster.location or "",
            "meeting_schedule": cluster.meeting_schedule or "",
            "description": cluster.description or "",
        }
        if transfer_member_ids is not None:
            payload["transfer_member_ids"] = transfer_member_ids
        return self.client.put(
            f"/api/clusters/clusters/{cluster.id}/",
            payload,
            format="json",
        )

    def test_add_without_transfer_keeps_dual_membership(self):
        member = self._person("dualmember", first_name="Dual")
        self.east.members.add(member)

        response = self._put_members(
            self.west,
            member_ids=[member.id],
        )
        self.assertEqual(response.status_code, 200, response.data)

        member.refresh_from_db()
        cluster_ids = set(member.clusters.values_list("id", flat=True))
        self.assertEqual(cluster_ids, {self.east.id, self.west.id})

        journey = Journey.objects.filter(
            user=member, type="CLUSTER"
        ).order_by("-id").first()
        self.assertIsNotNone(journey)
        self.assertEqual(journey.description, "Added to this cluster.")
        self.assertNotIn("Transferred", journey.description)

    def test_transfer_removes_from_other_active_clusters(self):
        member = self._person("xfermember", first_name="Xfer")
        self.east.members.add(member)

        response = self._put_members(
            self.west,
            member_ids=[member.id],
            transfer_member_ids=[member.id],
        )
        self.assertEqual(response.status_code, 200, response.data)

        member.refresh_from_db()
        cluster_ids = set(member.clusters.values_list("id", flat=True))
        self.assertEqual(cluster_ids, {self.west.id})
        self.assertFalse(self.east.members.filter(id=member.id).exists())

        journey = Journey.objects.filter(
            user=member, type="CLUSTER"
        ).order_by("-id").first()
        self.assertIsNotNone(journey)
        self.assertIn("Transferred from", journey.description)
        self.assertIn("XFER-EAST", journey.description)

    def test_family_auto_add_skips_other_cluster_members(self):
        in_east = self._person("familyeast", first_name="InEast")
        free = self._person("familyfree", first_name="Free")
        self.east.members.add(in_east)

        family = Family.objects.create(name="Xfer Family", branch=self.branch)
        family.members.add(in_east, free)

        response = self._put_members(
            self.west,
            member_ids=[],
            families=[family.id],
        )
        self.assertEqual(response.status_code, 200, response.data)

        west_ids = set(self.west.members.values_list("id", flat=True))
        self.assertIn(free.id, west_ids)
        self.assertNotIn(in_east.id, west_ids)
        self.assertTrue(self.east.members.filter(id=in_east.id).exists())
