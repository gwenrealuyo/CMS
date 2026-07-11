from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.people.models import Branch, Family, Person


class PersonMembershipApiTests(TestCase):
    """Person create/update accepts family_ids and cluster_ids."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name="Membership Branch",
            code="MEM_BR",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="mem_admin",
            email="mem_admin@test.com",
            password="testpass123",
            first_name="Mem",
            last_name="Admin",
            role="ADMIN",
            branch=self.branch,
            status="ACTIVE",
        )
        self.family_a = Family.objects.create(name="Family A")
        self.family_b = Family.objects.create(name="Family B")
        self.cluster_a = Cluster.objects.create(
            code="CL-A",
            name="Cluster A",
            branch=self.branch,
        )
        self.cluster_b = Cluster.objects.create(
            code="CL-B",
            name="Cluster B",
            branch=self.branch,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_create_person_with_family_and_cluster_ids(self):
        payload = {
            "first_name": "New",
            "last_name": "Member",
            "role": "MEMBER",
            "status": "ACTIVE",
            "branch": self.branch.id,
            "family_ids": [self.family_a.id],
            "cluster_ids": [self.cluster_a.id],
            "generate_temporary_password": True,
        }
        response = self.client.post("/api/people/people/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        person = Person.objects.get(pk=response.data["id"])
        self.assertEqual(
            set(person.families.values_list("id", flat=True)),
            {self.family_a.id},
        )
        self.assertEqual(
            set(person.clusters.values_list("id", flat=True)),
            {self.cluster_a.id},
        )
        self.assertEqual(response.data["family_ids"], [self.family_a.id])
        self.assertEqual(response.data["cluster_ids"], [self.cluster_a.id])

    def test_update_replaces_membership(self):
        person = Person.objects.create_user(
            username="replace_mem",
            email="replace_mem@test.com",
            password="testpass123",
            first_name="Replace",
            last_name="Member",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        self.family_a.members.add(person)
        self.cluster_a.members.add(person)

        response = self.client.patch(
            f"/api/people/people/{person.id}/",
            {
                "family_ids": [self.family_b.id],
                "cluster_ids": [self.cluster_b.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        person.refresh_from_db()
        self.assertEqual(
            set(person.families.values_list("id", flat=True)),
            {self.family_b.id},
        )
        self.assertEqual(
            set(person.clusters.values_list("id", flat=True)),
            {self.cluster_b.id},
        )

    def test_update_empty_lists_clears_membership(self):
        person = Person.objects.create_user(
            username="clear_mem",
            email="clear_mem@test.com",
            password="testpass123",
            first_name="Clear",
            last_name="Member",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        self.family_a.members.add(person)
        self.cluster_a.members.add(person)

        response = self.client.patch(
            f"/api/people/people/{person.id}/",
            {"family_ids": [], "cluster_ids": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        person.refresh_from_db()
        self.assertEqual(person.families.count(), 0)
        self.assertEqual(person.clusters.count(), 0)

    def test_patch_omitting_membership_leaves_unchanged(self):
        person = Person.objects.create_user(
            username="omit_mem",
            email="omit_mem@test.com",
            password="testpass123",
            first_name="Omit",
            last_name="Member",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        self.family_a.members.add(person)
        self.cluster_a.members.add(person)

        response = self.client.patch(
            f"/api/people/people/{person.id}/",
            {"nickname": "Ollie"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        person.refresh_from_db()
        self.assertEqual(person.nickname, "Ollie")
        self.assertEqual(
            set(person.families.values_list("id", flat=True)),
            {self.family_a.id},
        )
        self.assertEqual(
            set(person.clusters.values_list("id", flat=True)),
            {self.cluster_a.id},
        )
