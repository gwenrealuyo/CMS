from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import Conversion, EvangelismGroup, Prospect
from apps.people.models import Branch, ModuleCoordinator, Person


class EvangelismGroupDirectoryAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTEVGDIR",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="evgdiradmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.coordinator = Person.objects.create_user(
            username="evgdircoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="evgdirmember",
            password="pass12345",
            first_name="Mia",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.visitor = Person.objects.create_user(
            username="evgdirvisit",
            password="pass12345",
            first_name="Vito",
            last_name="Visit",
            role="VISITOR",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="Directory Cluster",
            code="EVG-DIR",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="North Bible Study",
            coordinator=self.coordinator,
            cluster=self.cluster,
            location="Hall A",
            is_active=True,
        )
        self.group.members.add(self.coordinator, self.member, self.visitor, self.admin)
        Prospect.objects.create(
            first_name="Pat",
            last_name="Prospect",
            invited_by=self.member,
            evangelism_group=self.group,
            pipeline_stage=Prospect.PipelineStage.INVITED,
        )
        Conversion.objects.create(
            person=self.member,
            converted_by=self.coordinator,
            evangelism_group=self.group,
            conversion_date="2026-01-15",
        )
        ModuleCoordinator.objects.create(
            person=self.member,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
            resource_type="EvangelismGroup",
        )
        self.client.force_authenticate(self.admin)

    def test_list_is_paginated_and_omits_nested_members(self):
        response = self.client.get("/api/evangelism/groups/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)
        row = next(
            item for item in response.data["results"] if item["name"] == "North Bible Study"
        )
        self.assertNotIn("members", row)
        self.assertEqual(row["members_count"], 2)
        self.assertEqual(row["visitors_count"], 2)
        self.assertEqual(row["conversions_count"], 1)
        self.assertTrue(row["has_bible_sharers"])
        self.assertEqual(row["cluster"]["code"], "EVG-DIR")
        self.assertEqual(row["cluster"]["branch"], self.branch.id)
        self.assertNotIn("reporter_ids", row)

    def test_list_filters_and_orders_on_server(self):
        other = EvangelismGroup.objects.create(
            name="South Study",
            coordinator=self.coordinator,
            is_active=True,
        )
        other.members.add(self.coordinator)

        response = self.client.get(
            "/api/evangelism/groups/",
            {"search": "North", "ordering": "name,id"},
        )
        self.assertEqual(response.status_code, 200, response.data)
        names = [row["name"] for row in response.data["results"]]
        self.assertEqual(names, ["North Bible Study"])

        by_members = self.client.get(
            "/api/evangelism/groups/",
            {"ordering": "-members_count,id", "has_bible_sharers": "true"},
        )
        self.assertEqual(by_members.status_code, 200, by_members.data)
        self.assertEqual(by_members.data["results"][0]["name"], "North Bible Study")

    def test_retrieve_still_includes_members(self):
        response = self.client.get(f"/api/evangelism/groups/{self.group.id}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("members", response.data)
        self.assertIn("reporter_ids", response.data)
        self.assertEqual(response.data["members_count"], 2)

    def test_dashboard_stats_include_each1reach1_totals(self):
        from apps.evangelism.models import Each1Reach1Goal

        Each1Reach1Goal.objects.create(
            cluster=self.cluster,
            year=2026,
            target_conversions=10,
            achieved_conversions=4,
        )
        response = self.client.get(
            "/api/evangelism/groups/dashboard-stats/",
            {"year": 2026},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["each1reach1_target"], 10)
        self.assertEqual(response.data["each1reach1_achieved"], 4)

    def test_prospects_and_reports_are_paginated(self):
        prospects = self.client.get("/api/evangelism/prospects/")
        self.assertEqual(prospects.status_code, 200, prospects.data)
        self.assertIn("results", prospects.data)
        self.assertIn("count", prospects.data)

        reports = self.client.get("/api/evangelism/weekly-reports/")
        self.assertEqual(reports.status_code, 200, reports.data)
        self.assertIn("results", reports.data)
        self.assertIn("count", reports.data)
