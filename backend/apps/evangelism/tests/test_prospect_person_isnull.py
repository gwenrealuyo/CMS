from rest_framework.test import APITestCase

from apps.evangelism.models import Prospect
from apps.people.models import Branch, Person


class ProspectPersonIsnullFilterAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTPROSISNULL",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="prosisnulladmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.inviter = Person.objects.create_user(
            username="prosisnullinviter",
            password="pass12345",
            first_name="Ivy",
            last_name="Inviter",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.linked_person = Person.objects.create_user(
            username="andrewlinked",
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
            invited_by=self.inviter,
            pipeline_stage=Prospect.PipelineStage.REACHED,
            person=self.linked_person,
        )
        self.unlinked = Prospect.objects.create(
            first_name="Andrew",
            last_name="Lopez",
            invited_by=self.inviter,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        self.client.force_authenticate(self.admin)

    def _result_ids(self, data):
        rows = data if isinstance(data, list) else data.get("results", [])
        return {row["id"] for row in rows}

    def test_search_without_person_isnull_returns_linked_and_unlinked(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"search": "andrew"},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            self._result_ids(response.data),
            {self.linked.id, self.unlinked.id},
        )

    def test_search_with_person_isnull_true_omits_linked_prospects(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"search": "andrew", "person_isnull": "true"},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self._result_ids(response.data), {self.unlinked.id})
