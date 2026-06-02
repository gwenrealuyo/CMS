from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from apps.people.models import Person

User = get_user_model()


class PersonSearchAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin",
            email="admin@test.com",
            password="testpass123",
            role="ADMIN",
        )
        self.target = Person.objects.create_user(
            username="lampuser",
            email="lamp@test.com",
            password="testpass123",
            first_name="Lamp",
            last_name="User",
            role="MEMBER",
            member_id="LAMP-TEST-001",
        )
        self.other = Person.objects.create_user(
            username="otheruser",
            email="other@test.com",
            password="testpass123",
            first_name="Other",
            last_name="Person",
            role="MEMBER",
            member_id="LAMP-OTHER-999",
        )

    def _people_ids(self, response):
        data = response.data
        results = data if isinstance(data, list) else data.get("results", [])
        return {row["id"] for row in results}

    def test_search_matches_member_id(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/people/people/", {"search": "LAMP-TEST"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = self._people_ids(response)
        self.assertIn(self.target.id, ids)
        self.assertNotIn(self.other.id, ids)

    def test_search_does_not_match_unrelated_member_id(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            "/api/people/people/", {"search": "LAMP-NOMATCH-XYZ"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = self._people_ids(response)
        self.assertNotIn(self.target.id, ids)
        self.assertNotIn(self.other.id, ids)
