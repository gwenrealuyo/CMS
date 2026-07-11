"""Family.branch create/update and branch-scoped listing."""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, Family, Person


class FamilyBranchAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.branch_a = Branch.objects.create(
            name="Branch A",
            code="BA",
            is_headquarters=False,
            is_active=True,
        )
        cls.branch_b = Branch.objects.create(
            name="Branch B",
            code="BB",
            is_headquarters=False,
            is_active=True,
        )
        cls.admin = Person.objects.create_user(
            username="fam_branch_admin",
            email="fam_branch_admin@test.com",
            password="x",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            branch=cls.branch_a,
            status="ACTIVE",
        )
        cls.pastor_a = Person.objects.create_user(
            username="fam_branch_pastor_a",
            email="fam_branch_pastor_a@test.com",
            password="x",
            first_name="Pastor",
            last_name="A",
            role="PASTOR",
            branch=cls.branch_a,
            status="ACTIVE",
        )
        cls.member_a = Person.objects.create_user(
            username="fam_branch_member_a",
            email="fam_branch_member_a@test.com",
            password="x",
            first_name="Member",
            last_name="A",
            role="MEMBER",
            branch=cls.branch_a,
            status="ACTIVE",
        )

    def setUp(self):
        self.client = APIClient()

    def _family_names(self, response):
        data = response.data
        results = data if isinstance(data, list) else data.get("results", [])
        return {row["name"] for row in results}

    def test_create_family_with_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/people/families/",
            {
                "name": "Branched Family",
                "members": [self.member_a.id],
                "leader": None,
                "branch": self.branch_a.id,
                "address": "",
                "notes": "",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["branch"], self.branch_a.id)
        family = Family.objects.get(id=res.data["id"])
        self.assertEqual(family.branch_id, self.branch_a.id)

    def test_update_family_branch(self):
        family = Family.objects.create(name="To Reassign", branch=self.branch_a)
        family.members.add(self.member_a)
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/people/families/{family.id}/",
            {"branch": self.branch_b.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["branch"], self.branch_b.id)
        family.refresh_from_db()
        self.assertEqual(family.branch_id, self.branch_b.id)

    def test_pastor_sees_family_by_family_branch_without_members(self):
        """Families with Family.branch set are visible even with no members."""
        Family.objects.create(name="Empty Branched", branch=self.branch_a)
        Family.objects.create(name="Other Branch Empty", branch=self.branch_b)

        self.client.force_authenticate(user=self.pastor_a)
        res = self.client.get("/api/people/families/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = self._family_names(res)
        self.assertIn("Empty Branched", names)
        self.assertNotIn("Other Branch Empty", names)

    def test_pastor_still_sees_member_branch_fallback(self):
        """Existing families without Family.branch remain visible via members."""
        family = Family.objects.create(name="Legacy Member Branch")
        family.members.add(self.member_a)

        self.client.force_authenticate(user=self.pastor_a)
        res = self.client.get("/api/people/families/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("Legacy Member Branch", self._family_names(res))
