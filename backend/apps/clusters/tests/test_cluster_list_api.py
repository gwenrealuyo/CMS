from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.people.models import Branch, Family, Person


class ClusterListPaginationAndFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(
            name="Clu Branch A", code="CLU_A", is_active=True
        )
        self.branch_b = Branch.objects.create(
            name="Clu Branch B", code="CLU_B", is_active=True
        )
        self.admin = Person.objects.create_user(
            username="clu_list_admin",
            email="clu_list_admin@test.com",
            password="testpass123",
            first_name="Clu",
            last_name="Admin",
            role="ADMIN",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.member = Person.objects.create_user(
            username="clu_list_member",
            email="clu_list_member@test.com",
            password="testpass123",
            first_name="Alice",
            last_name="Member",
            role="MEMBER",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.visitor = Person.objects.create_user(
            username="clu_list_visitor",
            email="clu_list_visitor@test.com",
            password="testpass123",
            first_name="Bob",
            last_name="Visitor",
            role="VISITOR",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.unassigned = Person.objects.create_user(
            username="clu_list_unassigned",
            email="clu_list_unassigned@test.com",
            password="testpass123",
            first_name="Carol",
            last_name="Solo",
            role="MEMBER",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.family = Family.objects.create(
            name="Cluster Family",
            branch=self.branch_a,
            leader=self.member,
        )
        self.family.members.add(self.member)
        self.cluster_a = Cluster.objects.create(
            code="CLU-A",
            name="Alpha Cluster",
            branch=self.branch_a,
            location="North",
            meeting_schedule="Sunday 7pm",
            description="Alpha desc",
            is_active=True,
        )
        self.cluster_a.members.add(self.member, self.visitor)
        self.cluster_a.families.add(self.family)
        self.cluster_b = Cluster.objects.create(
            code="CLU-B",
            name="Beta Cluster",
            branch=self.branch_b,
            location="South",
            meeting_schedule="Monday 7pm",
            description="Beta desc",
            is_active=True,
        )
        self.client.force_authenticate(user=self.admin)

    def _results(self, response):
        data = response.data
        if isinstance(data, list):
            return data
        return data.get("results", [])

    def test_list_returns_paginated_envelope(self):
        response = self.client.get(
            "/api/clusters/clusters/", {"page": 1, "page_size": 1}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertGreaterEqual(response.data["count"], 2)

    def test_list_includes_counts_without_nested_rosters(self):
        response = self.client.get(
            "/api/clusters/clusters/", {"search": "Alpha", "page_size": 10}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(r for r in self._results(response) if r["id"] == self.cluster_a.id)
        self.assertEqual(row["member_count"], 2)
        self.assertEqual(row["visitor_count"], 1)
        self.assertEqual(row["family_count"], 1)
        self.assertNotIn("members", row)
        self.assertNotIn("families", row)
        self.assertNotIn("members_details", row)
        self.assertNotIn("families_details", row)
        self.assertNotIn("reporter_ids", row)

    def test_retrieve_still_includes_rosters(self):
        response = self.client.get(f"/api/clusters/clusters/{self.cluster_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("members", response.data)
        self.assertIn("families", response.data)
        self.assertIn("members_details", response.data)
        self.assertIn("families_details", response.data)

    def test_filter_by_branch(self):
        response = self.client.get(
            "/api/clusters/clusters/",
            {"branch": self.branch_b.id, "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertEqual(ids, {self.cluster_b.id})

    def test_search_by_name(self):
        response = self.client.get(
            "/api/clusters/clusters/", {"search": "Beta", "page_size": 50}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertEqual(ids, {self.cluster_b.id})

    def test_ordering_by_member_count(self):
        response = self.client.get(
            "/api/clusters/clusters/",
            {"ordering": "-member_count", "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._results(response)
        counts = [r["member_count"] for r in results]
        self.assertEqual(counts, sorted(counts, reverse=True))

    def test_unassigned_people_excludes_cluster_members(self):
        response = self.client.get(
            "/api/clusters/clusters/unassigned-people/", {"page_size": 50}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        ids = {r["id"] for r in response.data["results"]}
        self.assertIn(self.unassigned.id, ids)
        self.assertNotIn(self.member.id, ids)
        self.assertNotIn(self.visitor.id, ids)

    def test_unassigned_people_search(self):
        response = self.client.get(
            "/api/clusters/clusters/unassigned-people/",
            {"search": "Carol", "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in response.data["results"]}
        self.assertEqual(ids, {self.unassigned.id})

    def test_summary_counts(self):
        response = self.client.get("/api/clusters/clusters/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("cluster_count", response.data)
        self.assertIn("member_count", response.data)
        self.assertIn("unassigned_count", response.data)
        self.assertGreaterEqual(response.data["cluster_count"], 2)
        self.assertGreaterEqual(response.data["member_count"], 2)
        self.assertGreaterEqual(response.data["unassigned_count"], 1)
        self.assertIn(self.unassigned.id is not None, [True])
