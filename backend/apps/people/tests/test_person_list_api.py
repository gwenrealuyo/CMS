from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.people.models import Branch, Journey, Person


class PersonListPaginationAndFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(
            name="List Branch A", code="LIST_A", is_active=True
        )
        self.branch_b = Branch.objects.create(
            name="List Branch B", code="LIST_B", is_active=True
        )
        self.admin = Person.objects.create_user(
            username="list_admin",
            email="list_admin@test.com",
            password="testpass123",
            first_name="List",
            last_name="Admin",
            role="ADMIN",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.member_a = Person.objects.create_user(
            username="list_member_a",
            email="member_a@test.com",
            password="testpass123",
            first_name="Alice",
            last_name="Anderson",
            phone="111-1111",
            role="MEMBER",
            branch=self.branch_a,
            status="ACTIVE",
            member_id="LIST-A-001",
        )
        self.member_b = Person.objects.create_user(
            username="list_member_b",
            email="member_b@test.com",
            password="testpass123",
            first_name="Bob",
            last_name="Brown",
            phone="222-2222",
            role="VISITOR",
            branch=self.branch_b,
            status="INACTIVE",
            member_id="LIST-B-002",
        )
        self.member_c = Person.objects.create_user(
            username="list_member_c",
            email="member_c@test.com",
            password="testpass123",
            first_name="Carol",
            last_name="Clark",
            role="MEMBER",
            branch=self.branch_a,
            status="SEMIACTIVE",
            member_id="LIST-A-003",
        )
        self.cluster = Cluster.objects.create(
            code="LIST-CL",
            name="List Cluster",
            branch=self.branch_a,
        )
        self.cluster.members.add(self.member_a, self.member_c)
        Journey.objects.create(
            user=self.member_a,
            type="NOTE",
            title="Should not appear on list",
            description="Heavy nested payload",
            date="2024-01-01",
        )
        self.client.force_authenticate(user=self.admin)

    def _results(self, response):
        data = response.data
        if isinstance(data, list):
            return data
        return data.get("results", [])

    def test_list_returns_paginated_envelope(self):
        response = self.client.get(
            "/api/people/people/", {"page": 1, "page_size": 1}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertGreaterEqual(response.data["count"], 3)

    def test_list_excludes_journeys_and_coordinator_assignments(self):
        response = self.client.get(
            "/api/people/people/", {"search": "Alice", "page_size": 10}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(
            r for r in self._results(response) if r["id"] == self.member_a.id
        )
        self.assertNotIn("journeys", row)
        self.assertNotIn("module_coordinator_assignments", row)
        self.assertIn("cluster_codes", row)
        self.assertIn("can_view_profile", row)
        self.assertIn(self.cluster.code, row["cluster_codes"])

    def test_retrieve_still_includes_journeys(self):
        response = self.client.get(f"/api/people/people/{self.member_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("journeys", response.data)
        self.assertGreaterEqual(len(response.data["journeys"]), 1)
        self.assertIn("module_coordinator_assignments", response.data)

    def test_filter_by_role(self):
        response = self.client.get(
            "/api/people/people/", {"role": "VISITOR", "page_size": 50}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertIn(self.member_b.id, ids)
        self.assertNotIn(self.member_a.id, ids)

    def test_filter_by_status(self):
        response = self.client.get(
            "/api/people/people/", {"status": "INACTIVE", "page_size": 50}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertEqual(ids, {self.member_b.id})

    def test_filter_by_branch(self):
        response = self.client.get(
            "/api/people/people/",
            {"branch": self.branch_b.id, "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertIn(self.member_b.id, ids)
        self.assertNotIn(self.member_a.id, ids)

    def test_filter_by_cluster(self):
        response = self.client.get(
            "/api/people/people/",
            {"cluster": self.cluster.id, "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertEqual(ids, {self.member_a.id, self.member_c.id})

    def test_filter_combined_with_search(self):
        response = self.client.get(
            "/api/people/people/",
            {
                "role": "MEMBER",
                "branch": self.branch_a.id,
                "search": "Carol",
                "page_size": 50,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertEqual(ids, {self.member_c.id})

    def test_filter_first_name_icontains(self):
        response = self.client.get(
            "/api/people/people/",
            {"first_name__icontains": "ali", "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertEqual(ids, {self.member_a.id})

    def test_ordering_by_last_name(self):
        response = self.client.get(
            "/api/people/people/",
            {
                "ordering": "last_name",
                "role__in": "MEMBER,VISITOR",
                "page_size": 50,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        last_names = [
            r["last_name"]
            for r in self._results(response)
            if r["id"] in {self.member_a.id, self.member_b.id, self.member_c.id}
        ]
        self.assertEqual(last_names, sorted(last_names))

    def test_list_admin_can_view_profile_true(self):
        response = self.client.get(
            "/api/people/people/", {"search": "Alice", "page_size": 10}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(
            r for r in self._results(response) if r["id"] == self.member_a.id
        )
        self.assertTrue(row["can_view_profile"])

    def test_retrieve_includes_prefetched_assignment_fields(self):
        response = self.client.get(f"/api/people/people/{self.member_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("journeys", response.data)
        self.assertIsInstance(response.data["journeys"], list)
        self.assertIn("module_coordinator_assignments", response.data)
