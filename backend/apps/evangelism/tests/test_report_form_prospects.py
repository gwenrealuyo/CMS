from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, Prospect
from apps.people.models import Branch, ModuleCoordinator, Person


def _result_ids(data):
    rows = data["results"] if isinstance(data, dict) and "results" in data else data
    return {row["id"] for row in rows}


class ReportFormProspectScopeTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTRFP",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Makati",
            code="MAKARFP",
            is_active=True,
        )
        self.reporter = Person.objects.create_user(
            username="rfpreporter",
            password="pass12345",
            first_name="Rae",
            last_name="Porter",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
            branch=self.branch,
        )
        self.other_inviter = Person.objects.create_user(
            username="rfpotherinv",
            password="pass12345",
            first_name="Omar",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
            branch=self.other_branch,
        )
        self.cluster = Cluster.objects.create(
            name="Report Form Cluster",
            code="RFP-1",
            branch=self.branch,
            is_active=True,
        )
        self.other_cluster = Cluster.objects.create(
            name="Other Cluster",
            code="RFP-2",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="Report Form Group",
            cluster=self.cluster,
            coordinator=self.reporter,
            branch=self.branch,
            is_active=True,
        )
        self.other_group = EvangelismGroup.objects.create(
            name="Other Group",
            cluster=self.other_cluster,
            coordinator=self.reporter,
            branch=self.branch,
            is_active=True,
        )
        ModuleCoordinator.objects.create(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.cluster.id,
        )
        ModuleCoordinator.objects.create(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
        )
        self.unassigned = self._prospect("Una", "Signed")
        self.on_cluster = self._prospect(
            "Cal",
            "Cluster",
            inviter_cluster=self.cluster,
        )
        self.on_other_cluster = self._prospect(
            "Oth",
            "Cluster",
            inviter_cluster=self.other_cluster,
        )
        self.on_group = self._prospect(
            "Gro",
            "Member",
            evangelism_group=self.group,
        )
        self.on_other_group = self._prospect(
            "Oth",
            "Group",
            evangelism_group=self.other_group,
        )
        self.other_branch_invite = self._prospect(
            "Far",
            "Away",
            invited_by=self.other_inviter,
        )
        self.client.force_authenticate(self.reporter)

    def _prospect(self, first, last, **kwargs):
        defaults = {
            "first_name": first,
            "last_name": last,
            "invited_by": self.reporter,
            "pipeline_stage": Prospect.PipelineStage.INVITED,
            "is_dropped_off": False,
        }
        defaults.update(kwargs)
        return Prospect.objects.create(**defaults)

    def test_cluster_reporter_list_includes_unassigned_same_branch(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"for_cluster_report": self.cluster.id, "page_size": 100},
        )
        self.assertEqual(response.status_code, 200, response.data)
        ids = _result_ids(response.data)
        self.assertIn(self.unassigned.id, ids)
        self.assertIn(self.on_cluster.id, ids)
        self.assertNotIn(self.on_other_cluster.id, ids)
        self.assertNotIn(self.on_group.id, ids)
        self.assertNotIn(self.on_other_group.id, ids)
        self.assertNotIn(self.other_branch_invite.id, ids)

    def test_cluster_reporter_submit_claims_unassigned_prospect(self):
        response = self.client.post(
            "/api/clusters/cluster-weekly-reports/",
            {
                "cluster": self.cluster.id,
                "year": 2026,
                "week_number": 38,
                "meeting_date": "2026-09-14",
                "gathering_type": "PHYSICAL",
                "prospects_invited": [self.unassigned.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.unassigned.refresh_from_db()
        self.assertEqual(self.unassigned.inviter_cluster_id, self.cluster.id)

    def test_cluster_report_rejects_other_cluster_prospect(self):
        response = self.client.post(
            "/api/clusters/cluster-weekly-reports/",
            {
                "cluster": self.cluster.id,
                "year": 2026,
                "week_number": 39,
                "meeting_date": "2026-09-21",
                "gathering_type": "PHYSICAL",
                "prospects_invited": [self.on_other_cluster.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.on_other_cluster.refresh_from_db()
        self.assertEqual(self.on_other_cluster.inviter_cluster_id, self.other_cluster.id)

    def test_cluster_report_attended_claims_unassigned_prospect(self):
        response = self.client.post(
            "/api/clusters/cluster-weekly-reports/",
            {
                "cluster": self.cluster.id,
                "year": 2026,
                "week_number": 40,
                "meeting_date": "2026-09-28",
                "gathering_type": "PHYSICAL",
                "prospects_attended": [self.unassigned.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.unassigned.refresh_from_db()
        self.assertEqual(self.unassigned.inviter_cluster_id, self.cluster.id)
        self.assertIsNotNone(self.unassigned.person_id)

    def test_group_report_list_includes_unassigned_same_branch(self):
        response = self.client.get(
            "/api/evangelism/prospects/",
            {"for_group_report": self.group.id, "page_size": 100},
        )
        self.assertEqual(response.status_code, 200, response.data)
        ids = _result_ids(response.data)
        self.assertIn(self.unassigned.id, ids)
        self.assertIn(self.on_group.id, ids)
        self.assertNotIn(self.on_other_group.id, ids)
        self.assertNotIn(self.on_cluster.id, ids)
        self.assertNotIn(self.other_branch_invite.id, ids)

    def test_bible_sharer_submit_claims_unassigned_prospect(self):
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 38,
                "meeting_date": "2026-09-16",
                "gathering_type": "PHYSICAL",
                "prospects_invited": [self.unassigned.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.unassigned.refresh_from_db()
        self.assertEqual(self.unassigned.evangelism_group_id, self.group.id)
        self.assertIsNone(self.unassigned.inviter_cluster_id)

    def test_group_report_rejects_other_group_prospect(self):
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 39,
                "meeting_date": "2026-09-23",
                "gathering_type": "PHYSICAL",
                "prospects_invited": [self.on_other_group.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.on_other_group.refresh_from_db()
        self.assertEqual(self.on_other_group.evangelism_group_id, self.other_group.id)
