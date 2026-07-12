"""ADMIN possible-duplicates people API."""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, Person


class PossiblePeopleDuplicatesAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch_a = Branch.objects.create(
            name="Branch A", code="BA", is_active=True
        )
        cls.branch_b = Branch.objects.create(
            name="Branch B", code="BB", is_active=True
        )
        cls.admin = Person.objects.create_user(
            username="dup_admin",
            email="dup_admin@test.com",
            password="x",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            branch=cls.branch_a,
            status="ACTIVE",
        )
        cls.pastor = Person.objects.create_user(
            username="dup_pastor",
            email="dup_pastor@test.com",
            password="x",
            first_name="Pastor",
            last_name="User",
            role="PASTOR",
            branch=cls.branch_a,
            status="ACTIVE",
        )
        cls.juan1 = Person.objects.create_user(
            username="juan1",
            email="juan1@test.com",
            password="x",
            first_name="Juan",
            last_name="Garcia",
            role="MEMBER",
            branch=cls.branch_a,
            member_id="LAMP-1",
            status="ACTIVE",
        )
        cls.juan2 = Person.objects.create_user(
            username="juan2",
            email="juan2@test.com",
            password="x",
            first_name="juan",
            last_name="GARCIA",
            role="MEMBER",
            branch=cls.branch_a,
            member_id="LAMP-2",
            status="ACTIVE",
        )
        cls.maria = Person.objects.create_user(
            username="maria1",
            email="maria1@test.com",
            password="x",
            first_name="Maria",
            last_name="Santos",
            role="MEMBER",
            branch=cls.branch_b,
            member_id="LAMP-1",
            status="ACTIVE",
        )

    def setUp(self):
        self.client = APIClient()

    def test_pastor_forbidden(self):
        self.client.force_authenticate(user=self.pastor)
        res = self.client.get("/api/people/people/possible-duplicates/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_sees_name_and_member_id_groups(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/people/people/possible-duplicates/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        groups = res.data["groups"]
        match_types = {g["match_type"] for g in groups}
        self.assertIn("name", match_types)
        self.assertIn("member_id", match_types)

        name_group = next(g for g in groups if g["match_type"] == "name")
        self.assertEqual(name_group["count"], 2)
        self.assertTrue(name_group["same_branch"])
        ids = {p["id"] for p in name_group["people"]}
        self.assertEqual(ids, {self.juan1.id, self.juan2.id})

        mid_group = next(g for g in groups if g["match_type"] == "member_id")
        self.assertEqual(mid_group["count"], 2)
        mid_ids = {p["id"] for p in mid_group["people"]}
        self.assertEqual(mid_ids, {self.juan1.id, self.maria.id})

    def test_match_name_only(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            "/api/people/people/possible-duplicates/", {"match": "name"}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(
            all(g["match_type"] == "name" for g in res.data["groups"])
        )

    def test_same_branch_only_filters_member_id_cross_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            "/api/people/people/possible-duplicates/",
            {"match": "member_id", "same_branch_only": "1"},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["groups"], [])
