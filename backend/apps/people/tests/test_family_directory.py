from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.people.models import Branch, Family, Person


class FamilyDirectoryAPITests(APITestCase):
    def setUp(self):
        self.muntinlupa = Branch.objects.create(
            name="Muntinlupa",
            code="MUNT",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Other Branch",
            code="OTHERFAM",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="famdiradmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.muntinlupa,
        )
        self.member = Person.objects.create_user(
            username="famdirmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.muntinlupa,
        )
        self.santos = Family.objects.create(name="Santos")
        self.santos.members.add(self.member)
        self.reyes = Family.objects.create(
            name="Reyes",
            branch=self.other_branch,
        )

    def _names(self, response):
        return {row["name"] for row in response.data.get("results", [])}

    def test_empty_search_returns_all_families(self):
        self.client.force_authenticate(self.admin)
        filtered = self.client.get("/api/people/families/", {"search": "Santos"})
        self.assertEqual(filtered.status_code, 200, filtered.data)
        self.assertEqual(self._names(filtered), {"Santos"})

        cleared = self.client.get("/api/people/families/", {"search": ""})
        self.assertEqual(cleared.status_code, 200, cleared.data)
        self.assertEqual(self._names(cleared), {"Santos", "Reyes"})

        unfiltered = self.client.get("/api/people/families/")
        self.assertEqual(unfiltered.status_code, 200, unfiltered.data)
        self.assertEqual(self._names(unfiltered), {"Santos", "Reyes"})

    def test_branch_filter_includes_families_via_members(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/people/families/",
            {"branch": self.muntinlupa.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self._names(response), {"Santos"})
        self.assertEqual(response.data["count"], 1)

    def _person(self, username, role, branch, **kwargs):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=kwargs.get("first_name", username.title()),
            last_name=kwargs.get("last_name", "Test"),
            role=role,
            status="ACTIVE",
            branch=branch,
        )

    def _antonio_household(self):
        """Pastor + members + visitor + admin (admin should never be counted)."""
        pastor = self._person(
            "famdirpastor", "PASTOR", self.muntinlupa, first_name="Jess"
        )
        member_b = self._person(
            "famdirlinda", "MEMBER", self.muntinlupa, first_name="Linda"
        )
        visitor = self._person(
            "famdirvisit", "VISITOR", self.muntinlupa, first_name="Vic"
        )
        family = Family.objects.create(name="Antonio", branch=self.muntinlupa)
        family.members.add(self.member, pastor, member_b, visitor, self.admin)
        return family, pastor, member_b, visitor

    def _family_row(self, response, name):
        rows = [
            row for row in response.data.get("results", []) if row["name"] == name
        ]
        self.assertEqual(len(rows), 1, response.data)
        return rows[0]

    def test_roster_counts_split_members_and_visitors(self):
        family, pastor, member_b, visitor = self._antonio_household()
        self.client.force_authenticate(self.admin)

        listed = self.client.get("/api/people/families/")
        self.assertEqual(listed.status_code, 200, listed.data)
        row = self._family_row(listed, "Antonio")
        self.assertEqual(row["member_count"], 3)
        self.assertEqual(row["visitor_count"], 1)
        preview_ids = {item["id"] for item in row["member_preview"]}
        self.assertIn(self.member.id, preview_ids)
        self.assertIn(pastor.id, preview_ids)
        self.assertIn(member_b.id, preview_ids)
        self.assertIn(visitor.id, preview_ids)
        self.assertNotIn(self.admin.id, preview_ids)

        detail = self.client.get(f"/api/people/families/{family.id}/")
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["member_count"], 3)
        self.assertEqual(detail.data["visitor_count"], 1)

    def test_member_user_sees_full_household_member_count(self):
        self._antonio_household()
        self.client.force_authenticate(self.member)

        response = self.client.get("/api/people/families/")
        self.assertEqual(response.status_code, 200, response.data)
        row = self._family_row(response, "Antonio")
        self.assertEqual(row["member_count"], 3)
        self.assertEqual(row["visitor_count"], 1)

    def test_cluster_coordinator_count_is_not_cluster_overlap(self):
        family, _pastor, member_b, _visitor = self._antonio_household()
        coordinator = self._person(
            "famdircoord",
            "MEMBER",
            self.muntinlupa,
            first_name="Cora",
        )
        cluster = Cluster.objects.create(
            name="Antonio Cluster",
            code="ANTCL",
            coordinator=coordinator,
            branch=self.muntinlupa,
        )
        cluster.members.add(member_b)
        cluster.families.add(family)

        self.client.force_authenticate(coordinator)
        response = self.client.get("/api/people/families/")
        self.assertEqual(response.status_code, 200, response.data)
        row = self._family_row(response, "Antonio")
        self.assertEqual(row["member_count"], 3)
        self.assertEqual(row["visitor_count"], 1)

    def test_branch_filter_does_not_collapse_household_counts(self):
        family, _pastor, member_b, visitor = self._antonio_household()
        member_b.branch = self.other_branch
        member_b.save(update_fields=["branch"])
        visitor.branch = self.other_branch
        visitor.save(update_fields=["branch"])
        family.branch = None
        family.save(update_fields=["branch"])

        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/people/families/",
            {"branch": self.muntinlupa.id},
        )
        self.assertEqual(response.status_code, 200, response.data)
        row = self._family_row(response, "Antonio")
        self.assertEqual(row["member_count"], 3)
        self.assertEqual(row["visitor_count"], 1)
