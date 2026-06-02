from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup
from apps.people.models import Person


class EvangelismGroupMembersPatchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin_grp_patch",
            password="password123",
            first_name="Admin",
            last_name="Patch",
            role="ADMIN",
            status="ACTIVE",
        )
        self.member1 = Person.objects.create_user(
            username="member_grp_1",
            password="password123",
            first_name="Member",
            last_name="One",
            role="MEMBER",
            status="ACTIVE",
        )
        self.member2 = Person.objects.create_user(
            username="member_grp_2",
            password="password123",
            first_name="Member",
            last_name="Two",
            role="MEMBER",
            status="ACTIVE",
        )
        self.cluster = Cluster.objects.create(
            code="CLU-PATCH",
            name="Patch Cluster",
            coordinator=self.member1,
        )
        self.group = EvangelismGroup.objects.create(
            name="Patch Group",
            cluster=self.cluster,
            coordinator=self.member1,
            is_active=True,
        )
        self.group.members.add(self.member1)
        self.client.force_authenticate(user=self.admin)

    def test_patch_members_without_name_succeeds(self):
        response = self.client.patch(
            f"/api/evangelism/groups/{self.group.id}/",
            {"members": [self.member1.id, self.member2.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.group.members.count(), 2)
        self.assertIn(self.member2, self.group.members.all())
