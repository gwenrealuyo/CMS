from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from apps.people.models import Branch, Family, Person

User = get_user_model()


class FamilySearchAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(name="Main", code="MAIN")
        self.admin = Person.objects.create_user(
            username="admin",
            email="admin@test.com",
            password="testpass123",
            role="ADMIN",
        )
        self.member = Person.objects.create_user(
            username="member",
            email="member@test.com",
            password="testpass123",
            role="MEMBER",
            branch=self.branch,
        )
        self.family_alpha = Family.objects.create(name="Alpha Household")
        self.family_beta = Family.objects.create(name="Beta Household")
        self.family_alpha.members.add(self.member)

    def test_search_returns_matching_family_by_name(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/people/families/", {"search": "Alpha"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        results = data if isinstance(data, list) else data.get("results", [])
        names = [row["name"] for row in results]
        self.assertIn("Alpha Household", names)
        self.assertNotIn("Beta Household", names)

    def test_search_respects_branch_scoping_for_non_admin(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/people/families/", {"search": "Household"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        results = data if isinstance(data, list) else data.get("results", [])
        names = [row["name"] for row in results]
        self.assertIn("Alpha Household", names)
        self.assertNotIn("Beta Household", names)
