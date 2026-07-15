from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, Family, Person


class FamilyListPaginationAndFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(
            name="Fam Branch A", code="FAM_A", is_active=True
        )
        self.branch_b = Branch.objects.create(
            name="Fam Branch B", code="FAM_B", is_active=True
        )
        self.admin = Person.objects.create_user(
            username="fam_list_admin",
            email="fam_list_admin@test.com",
            password="testpass123",
            first_name="Fam",
            last_name="Admin",
            role="ADMIN",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.member = Person.objects.create_user(
            username="fam_list_member",
            email="fam_list_member@test.com",
            password="testpass123",
            first_name="Alice",
            last_name="Member",
            role="MEMBER",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.visitor = Person.objects.create_user(
            username="fam_list_visitor",
            email="fam_list_visitor@test.com",
            password="testpass123",
            first_name="Bob",
            last_name="Visitor",
            role="VISITOR",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.unassigned = Person.objects.create_user(
            username="fam_list_unassigned",
            email="fam_list_unassigned@test.com",
            password="testpass123",
            first_name="Carol",
            last_name="Solo",
            role="MEMBER",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.family_a = Family.objects.create(
            name="Anderson Family",
            branch=self.branch_a,
            leader=self.member,
            notes="Note A",
        )
        self.family_a.members.add(self.member, self.visitor)
        self.family_b = Family.objects.create(
            name="Brown Family",
            branch=self.branch_b,
            leader=None,
        )
        self.client.force_authenticate(user=self.admin)

    def _results(self, response):
        data = response.data
        if isinstance(data, list):
            return data
        return data.get("results", [])

    def test_list_returns_paginated_envelope(self):
        response = self.client.get(
            "/api/people/families/", {"page": 1, "page_size": 1}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertGreaterEqual(response.data["count"], 2)

    def test_list_includes_counts_and_preview(self):
        response = self.client.get(
            "/api/people/families/", {"search": "Anderson", "page_size": 10}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(r for r in self._results(response) if r["id"] == self.family_a.id)
        self.assertEqual(row["member_count"], 2)
        self.assertEqual(row["visitor_count"], 1)
        self.assertIn("member_preview", row)
        self.assertLessEqual(len(row["member_preview"]), 5)
        self.assertNotIn("members", row)
        self.assertNotIn("address", row)

    def test_retrieve_still_includes_members(self):
        response = self.client.get(f"/api/people/families/{self.family_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("members", response.data)
        self.assertEqual(len(response.data["members"]), 2)

    def test_filter_by_branch(self):
        response = self.client.get(
            "/api/people/families/",
            {"branch": self.branch_b.id, "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertEqual(ids, {self.family_b.id})

    def test_search_by_name(self):
        response = self.client.get(
            "/api/people/families/", {"search": "Brown", "page_size": 50}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in self._results(response)}
        self.assertEqual(ids, {self.family_b.id})

    def test_ordering_by_member_count(self):
        response = self.client.get(
            "/api/people/families/",
            {"ordering": "-member_count", "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._results(response)
        counts = [r["member_count"] for r in results]
        self.assertEqual(counts, sorted(counts, reverse=True))

    def test_unassigned_people_excludes_family_members(self):
        response = self.client.get(
            "/api/people/families/unassigned-people/", {"page_size": 50}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        ids = {r["id"] for r in response.data["results"]}
        self.assertIn(self.unassigned.id, ids)
        self.assertNotIn(self.member.id, ids)
        self.assertNotIn(self.visitor.id, ids)

    def test_unassigned_people_search(self):
        response = self.client.get(
            "/api/people/families/unassigned-people/",
            {"search": "Carol", "page_size": 50},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in response.data["results"]}
        self.assertEqual(ids, {self.unassigned.id})
