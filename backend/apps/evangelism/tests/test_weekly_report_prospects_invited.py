from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport, Prospect
from apps.people.models import Branch, Person


class EvangelismWeeklyReportProspectsInvitedTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTEVRINV",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="evrinadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="evrinmember",
            password="pass12345",
            first_name="Mia",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="East Cluster",
            code="EVR-EAST",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="East Bible Study",
            cluster=self.cluster,
            coordinator=self.member,
            is_active=True,
        )
        self.group.members.add(self.member)
        self.client.force_authenticate(self.admin)

    def _prospect(self, first="Pat", last="Prospect", **kwargs):
        defaults = {
            "first_name": first,
            "last_name": last,
            "invited_by": self.member,
            "evangelism_group": self.group,
            "pipeline_stage": Prospect.PipelineStage.INVITED,
            "is_dropped_off": False,
        }
        defaults.update(kwargs)
        return Prospect.objects.create(**defaults)

    def test_create_links_invited_prospects_and_derives_count(self):
        prospect = self._prospect()
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 38,
                "meeting_date": "2026-09-14",
                "gathering_type": "PHYSICAL",
                "prospects_invited": [prospect.id],
                "new_prospects": 99,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["new_prospects"], 1)
        self.assertEqual(response.data["prospects_invited"], [prospect.id])
        report = EvangelismWeeklyReport.objects.get(pk=response.data["id"])
        self.assertEqual(report.new_prospects, 1)
        self.assertEqual(list(report.prospects_invited.values_list("id", flat=True)), [prospect.id])
        self.assertIsNone(prospect.inviter_cluster_id)

    def test_nested_create_sets_group_not_inviter_cluster(self):
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 39,
                "meeting_date": "2026-09-21",
                "gathering_type": "PHYSICAL",
                "new_invited_prospects": [
                    {
                        "first_name": "Nina",
                        "last_name": "New",
                        "invited_by_id": self.member.id,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["new_prospects"], 1)
        prospect = Prospect.objects.get(first_name="Nina", last_name="New")
        self.assertEqual(prospect.evangelism_group_id, self.group.id)
        self.assertIsNone(prospect.inviter_cluster_id)
        self.assertEqual(prospect.pipeline_stage, Prospect.PipelineStage.INVITED)
        self.assertIn(prospect.id, response.data["prospects_invited"])

    def test_rejects_invited_and_attended_overlap(self):
        visitor = Person.objects.create_user(
            username="evrinvisitor",
            password="pass12345",
            first_name="Vic",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        prospect = self._prospect(person=visitor)
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 40,
                "meeting_date": "2026-09-28",
                "gathering_type": "PHYSICAL",
                "prospects_invited": [prospect.id],
                "visitors_attended": [visitor.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("prospects_invited", response.data.get("details", response.data))

    def test_unlink_does_not_delete_prospect(self):
        prospect = self._prospect()
        create = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 41,
                "meeting_date": "2026-10-05",
                "gathering_type": "PHYSICAL",
                "prospects_invited": [prospect.id],
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        report_id = create.data["id"]
        update = self.client.patch(
            f"/api/evangelism/weekly-reports/{report_id}/",
            {"prospects_invited": []},
            format="json",
        )
        self.assertEqual(update.status_code, 200, update.data)
        self.assertEqual(update.data["new_prospects"], 0)
        self.assertTrue(Prospect.objects.filter(pk=prospect.id).exists())
