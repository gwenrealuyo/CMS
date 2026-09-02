from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, Prospect
from apps.people.models import Branch, Person


class ProspectListFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(name="Branch A", code="BRA")
        self.branch_b = Branch.objects.create(name="Branch B", code="BRB")
        self.admin = Person.objects.create_user(
            username="admin_prospects",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch_a,
        )
        self.inviter = Person.objects.create_user(
            username="inviter_prospects",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch_a,
        )
        self.cluster_a = Cluster.objects.create(
            code="CA",
            name="Cluster A",
            branch=self.branch_a,
            coordinator=self.inviter,
        )
        self.cluster_b = Cluster.objects.create(
            code="CB",
            name="Cluster B",
            branch=self.branch_b,
            coordinator=self.inviter,
        )
        self.group = EvangelismGroup.objects.create(
            name="Group A",
            cluster=self.cluster_a,
            coordinator=self.inviter,
        )
        self.cluster_only = Prospect.objects.create(
            first_name="Invited",
            last_name="Cluster",
            invited_by=self.inviter,
            inviter_cluster=self.cluster_a,
            pipeline_stage=Prospect.PipelineStage.INVITED,
            date_first_invited=date(2026, 1, 10),
            is_dropped_off=False,
        )
        self.group_linked = Prospect.objects.create(
            first_name="Invited",
            last_name="Group",
            invited_by=self.inviter,
            inviter_cluster=self.cluster_a,
            evangelism_group=self.group,
            pipeline_stage=Prospect.PipelineStage.INVITED,
            date_first_invited=date(2026, 1, 11),
            is_dropped_off=False,
        )
        self.endorsed = Prospect.objects.create(
            first_name="Invited",
            last_name="Endorsed",
            invited_by=self.inviter,
            inviter_cluster=self.cluster_a,
            endorsed_cluster=self.cluster_b,
            pipeline_stage=Prospect.PipelineStage.INVITED,
            date_first_invited=date(2026, 1, 12),
            is_dropped_off=False,
        )
        attended_person = Person.objects.create_user(
            username="attended_visitor",
            password="pw",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch_b,
            first_name="Attended",
            last_name="Person",
            date_first_attended=date(2026, 2, 1),
            water_baptism_date=date(2026, 3, 1),
        )
        self.attended = Prospect.objects.create(
            first_name="Attended",
            last_name="Person",
            invited_by=self.inviter,
            inviter_cluster=self.cluster_b,
            person=attended_person,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            date_first_invited=date(2026, 1, 20),
            is_dropped_off=False,
        )
        self.client.force_authenticate(user=self.admin)

    def _ids(self, response):
        return {row["id"] for row in response.data}

    def test_filter_by_branch(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"branch": self.branch_b.id},
        )
        self.assertEqual(response.status_code, 200)
        ids = self._ids(response)
        self.assertIn(self.endorsed.id, ids)
        self.assertIn(self.attended.id, ids)
        self.assertNotIn(self.cluster_only.id, ids)
        self.assertNotIn(self.group_linked.id, ids)

    def test_filter_by_cluster_includes_endorsed(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"cluster": self.cluster_b.id},
        )
        self.assertEqual(response.status_code, 200)
        ids = self._ids(response)
        self.assertIn(self.endorsed.id, ids)
        self.assertIn(self.attended.id, ids)
        self.assertNotIn(self.cluster_only.id, ids)

    def test_filter_by_source_cluster_only(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"source": "cluster"},
        )
        self.assertEqual(response.status_code, 200)
        ids = self._ids(response)
        self.assertIn(self.cluster_only.id, ids)
        self.assertIn(self.endorsed.id, ids)
        self.assertIn(self.attended.id, ids)
        self.assertNotIn(self.group_linked.id, ids)

    def test_filter_by_source_both(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"source": "both"},
        )
        self.assertEqual(response.status_code, 200)
        ids = self._ids(response)
        self.assertEqual(ids, {self.group_linked.id})

    def test_pipeline_and_invited_default_shape(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"pipeline_stage": "INVITED", "is_dropped_off": False},
        )
        self.assertEqual(response.status_code, 200)
        ids = self._ids(response)
        self.assertIn(self.cluster_only.id, ids)
        self.assertNotIn(self.attended.id, ids)
        attended_row = next(
            row for row in self.client.get("/api/evangelism/prospects/").data
            if row["id"] == self.attended.id
        )
        self.assertEqual(str(attended_row["date_first_attended"]), "2026-02-01")
        self.assertEqual(str(attended_row["water_baptism_date"]), "2026-03-01")
        self.assertIsNone(attended_row["reached_date"])
