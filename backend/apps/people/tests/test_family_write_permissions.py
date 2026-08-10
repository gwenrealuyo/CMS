"""Family create/update restricted to Admin, Pastor, and Cluster coordinators."""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.people.models import Branch, Family, ModuleCoordinator, Person


class FamilyWritePermissionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch = Branch.objects.create(
            name="HQ",
            code="HQ",
            is_headquarters=True,
            is_active=True,
        )
        cls.admin = Person.objects.create_user(
            username="fam_write_admin",
            email="fam_write_admin@test.com",
            password="x",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.pastor = Person.objects.create_user(
            username="fam_write_pastor",
            email="fam_write_pastor@test.com",
            password="x",
            first_name="Pastor",
            last_name="User",
            role="PASTOR",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.plain_member = Person.objects.create_user(
            username="fam_write_member",
            email="fam_write_member@test.com",
            password="x",
            first_name="Plain",
            last_name="Member",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.cluster_coord = Person.objects.create_user(
            username="fam_write_cluster_coord",
            email="fam_write_cluster_coord@test.com",
            password="x",
            first_name="Cluster",
            last_name="Coord",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.cluster_senior = Person.objects.create_user(
            username="fam_write_cluster_senior",
            email="fam_write_cluster_senior@test.com",
            password="x",
            first_name="Cluster",
            last_name="Senior",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.evangelism_coord = Person.objects.create_user(
            username="fam_write_evang_coord",
            email="fam_write_evang_coord@test.com",
            password="x",
            first_name="Evang",
            last_name="Coord",
            role="MEMBER",
            branch=cls.branch,
            status="ACTIVE",
        )
        cls.cluster = Cluster.objects.create(
            code="FW1", name="Family Write Cluster", branch=cls.branch
        )
        ModuleCoordinator.objects.create(
            person=cls.cluster_coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=cls.cluster.id,
            resource_type="cluster",
        )
        ModuleCoordinator.objects.create(
            person=cls.cluster_senior,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        ModuleCoordinator.objects.create(
            person=cls.evangelism_coord,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=1,
            resource_type="evangelism_group",
        )
        cls.existing_family = Family.objects.create(
            name="Existing Family",
            branch=cls.branch,
            is_active=True,
        )
        cls.existing_family.members.add(cls.plain_member)
        cls.cluster.families.add(cls.existing_family)
        cls.cluster.members.add(cls.plain_member)

    def setUp(self):
        self.client = APIClient()

    def _create_payload(self, name="New Family"):
        return {
            "name": name,
            "members": [],
            "leader": None,
            "branch": self.branch.id,
            "address": "",
            "notes": "",
        }

    def test_plain_member_cannot_create_family(self):
        self.client.force_authenticate(user=self.plain_member)
        res = self.client.post(
            "/api/people/families/",
            self._create_payload("Plain Member Family"),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_plain_member_cannot_update_family(self):
        self.client.force_authenticate(user=self.plain_member)
        res = self.client.patch(
            f"/api/people/families/{self.existing_family.id}/",
            {"name": "Renamed By Member"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_evangelism_coordinator_cannot_create_family(self):
        self.client.force_authenticate(user=self.evangelism_coord)
        res = self.client.post(
            "/api/people/families/",
            self._create_payload("Evang Coord Family"),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_cluster_coordinator_can_create_family(self):
        self.client.force_authenticate(user=self.cluster_coord)
        res = self.client.post(
            "/api/people/families/",
            self._create_payload("Cluster Coord Family"),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["name"], "Cluster Coord Family")

    def test_cluster_senior_coordinator_can_create_family(self):
        self.client.force_authenticate(user=self.cluster_senior)
        res = self.client.post(
            "/api/people/families/",
            self._create_payload("Cluster Senior Family"),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_pastor_can_create_family(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.post(
            "/api/people/families/",
            self._create_payload("Pastor Family"),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_admin_can_create_family(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/people/families/",
            self._create_payload("Admin Family"),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_cluster_coordinator_can_update_family(self):
        self.client.force_authenticate(user=self.cluster_coord)
        res = self.client.patch(
            f"/api/people/families/{self.existing_family.id}/",
            {"name": "Renamed By Coord"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.existing_family.refresh_from_db()
        self.assertEqual(self.existing_family.name, "Renamed By Coord")
