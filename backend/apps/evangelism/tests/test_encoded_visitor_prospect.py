from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, Prospect
from apps.people.models import Branch, ModuleCoordinator, Person

PROSPECTS_URL = "/api/evangelism/prospects/"


class EncodedVisitorProspectAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTENCVID",
            is_active=True,
        )
        self.coordinator = Person.objects.create_user(
            username="encvidcoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.other_coord = Person.objects.create_user(
            username="encvidother",
            password="pass12345",
            first_name="Omar",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="East Cluster",
            code="ENC-EAST",
            branch=self.branch,
            is_active=True,
        )
        self.owned_group = EvangelismGroup.objects.create(
            name="Cora Study",
            coordinator=self.coordinator,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self.other_group = EvangelismGroup.objects.create(
            name="West Study",
            coordinator=self.other_coord,
            cluster=self.cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self.owned_group.members.add(self.coordinator)
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.owned_group.id,
            resource_type="EvangelismGroup",
        )
        ModuleCoordinator.objects.create(
            person=self.other_coord,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.other_group.id,
            resource_type="EvangelismGroup",
        )
        self.encoded_visitor = Person.objects.create_user(
            username="encvideva",
            password="pass12345",
            first_name="Eva",
            last_name="Cubian",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            date_first_attended=date(2026, 3, 1),
            date_first_invited=date(2026, 2, 20),
            gender="FEMALE",
            facebook_name="eva.cubian",
        )

    def test_coordinator_can_link_encoded_visitor_on_own_approved_group(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            PROSPECTS_URL,
            {
                "person_id": self.encoded_visitor.id,
                "invited_by_id": self.coordinator.id,
                "evangelism_group_id": self.owned_group.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["person"]["id"], self.encoded_visitor.id)
        self.assertEqual(response.data["first_name"], "Eva")
        self.assertEqual(response.data["last_name"], "Cubian")
        self.assertEqual(response.data["pipeline_stage"], Prospect.PipelineStage.ATTENDED)
        self.assertEqual(response.data["facebook_name"], "eva.cubian")

    def test_invitation_without_person_stays_invited_and_unlinked(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            PROSPECTS_URL,
            {
                "first_name": "Jemuel",
                "last_name": "Cubian",
                "invited_by_id": self.coordinator.id,
                "evangelism_group_id": self.owned_group.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data.get("person"))
        self.assertEqual(response.data["pipeline_stage"], Prospect.PipelineStage.INVITED)

    def test_encoded_visitor_already_on_group_is_rejected(self):
        Prospect.objects.create(
            first_name="Eva",
            last_name="Cubian",
            invited_by=self.coordinator,
            evangelism_group=self.owned_group,
            person=self.encoded_visitor,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
        )
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            PROSPECTS_URL,
            {
                "person_id": self.encoded_visitor.id,
                "invited_by_id": self.coordinator.id,
                "evangelism_group_id": self.owned_group.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details") or response.data
        self.assertIn("person_id", details)

    def test_coordinator_cannot_link_encoded_visitor_on_other_group(self):
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            PROSPECTS_URL,
            {
                "person_id": self.encoded_visitor.id,
                "invited_by_id": self.coordinator.id,
                "evangelism_group_id": self.other_group.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)