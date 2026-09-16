from rest_framework.test import APITestCase

from apps.evangelism.models import Prospect
from apps.people.models import Branch, Person


class ProspectDeleteAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTPROSDEL",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="prosdeladmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.pastor = Person.objects.create_user(
            username="prosdelpastor",
            password="pass12345",
            first_name="Paul",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="prosdelmember",
            password="pass12345",
            first_name="Mia",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.linked_person = Person.objects.create_user(
            username="prosdelvisitor",
            password="pass12345",
            first_name="Andrew",
            last_name="Lopez",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        self.linked = Prospect.objects.create(
            first_name="Andrew",
            last_name="Lopez",
            invited_by=self.member,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            person=self.linked_person,
        )
        self.unlinked = Prospect.objects.create(
            first_name="Ivy",
            last_name="Invitee",
            invited_by=self.member,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )

    def test_admin_can_delete_prospect_without_removing_linked_person(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"/api/evangelism/prospects/{self.linked.id}/")
        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(Prospect.objects.filter(id=self.linked.id).exists())
        self.linked_person.refresh_from_db()
        self.assertEqual(self.linked_person.first_name, "Andrew")

    def test_member_cannot_delete_prospect(self):
        self.client.force_authenticate(self.member)
        response = self.client.delete(
            f"/api/evangelism/prospects/{self.unlinked.id}/"
        )
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Prospect.objects.filter(id=self.unlinked.id).exists())

    def test_pastor_cannot_delete_prospect(self):
        self.client.force_authenticate(self.pastor)
        response = self.client.delete(
            f"/api/evangelism/prospects/{self.unlinked.id}/"
        )
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Prospect.objects.filter(id=self.unlinked.id).exists())
