from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.people.models import Person
from apps.evangelism.models import (
    EvangelismGroup,
    EvangelismWeeklyReport,
    Prospect,
    Conversion,
)


class EvangelismDashboardStatsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin_dash",
            password="password123",
            first_name="Admin",
            last_name="Dash",
            role="ADMIN",
            status="ACTIVE",
        )
        self.inviter = Person.objects.create_user(
            username="inviter_dash",
            password="password123",
            first_name="Inviter",
            last_name="One",
            role="MEMBER",
            status="ACTIVE",
        )
        self.cluster = Cluster.objects.create(
            code="CLU-DASH",
            name="Dash Cluster",
            coordinator=self.inviter,
        )
        self.group = EvangelismGroup.objects.create(
            name="Dash Group",
            cluster=self.cluster,
            coordinator=self.inviter,
            is_active=True,
        )
        self.client.force_authenticate(user=self.admin)

    def test_dashboard_stats_endpoint(self):
        year = 2028
        visitor_linked = Person.objects.create_user(
            username="prospect_person",
            password="password123",
            first_name="Prospect",
            last_name="Linked",
            role="VISITOR",
            status="INVITED",
        )
        Prospect.objects.create(
            first_name="Prospect",
            last_name="Linked",
            invited_by=self.inviter,
            inviter_cluster=self.cluster,
            evangelism_group=self.group,
            person=visitor_linked,
            is_dropped_off=False,
        )

        cluster_only_visitor = Person.objects.create_user(
            username="cluster_only_v",
            password="password123",
            first_name="Cluster",
            last_name="OnlyVisitor",
            role="VISITOR",
            status="ATTENDED",
        )
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=year,
            week_number=10,
            meeting_date=date(year, 3, 15),
            gathering_type="PHYSICAL",
            offerings=Decimal("0.00"),
            submitted_by=self.inviter,
        )
        report.visitors_attended.add(cluster_only_visitor)

        reached_in_year = Person.objects.create_user(
            username="reached_y",
            password="password123",
            first_name="Reached",
            last_name="InYear",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(year, 4, 1),
            spirit_baptism_date=date(year, 4, 20),
        )

        Person.objects.create_user(
            username="reached_split",
            password="password123",
            first_name="Split",
            last_name="Years",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(year - 1, 4, 1),
            spirit_baptism_date=date(year, 4, 20),
        )

        conv_person = Person.objects.create_user(
            username="conv_person",
            password="password123",
            first_name="Conv",
            last_name="Person",
            role="VISITOR",
            status="ATTENDED",
        )
        Conversion.objects.create(
            person=conv_person,
            converted_by=self.inviter,
            conversion_date=date(year, 6, 1),
            is_complete=True,
        )

        response = self.client.get(
            "/api/evangelism/groups/dashboard-stats/",
            {"year": year},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["year"], year)
        self.assertEqual(data["total_groups"], 1)
        self.assertEqual(data["active_groups"], 1)
        # Invited-only prospect is excluded; cluster weekly visitor counts
        self.assertEqual(data["total_visitors"], 1)
        self.assertEqual(data["total_reached"], 1)
        self.assertEqual(data["completed_conversions"], 1)

    def test_evangelism_weekly_report_visitor_counts(self):
        year = 2029
        eg_visitor = Person.objects.create_user(
            username="eg_weekly_v",
            password="password123",
            first_name="EG",
            last_name="WeeklyV",
            role="VISITOR",
            status="ATTENDED",
        )
        eg_report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=year,
            week_number=5,
            meeting_date=date(year, 2, 1),
            gathering_type="PHYSICAL",
            submitted_by=self.inviter,
        )
        eg_report.visitors_attended.add(eg_visitor)

        response = self.client.get(
            "/api/evangelism/groups/dashboard-stats/",
            {"year": year},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["total_visitors"], 1)

    def test_dashboard_stats_invalid_year(self):
        response = self.client.get(
            "/api/evangelism/groups/dashboard-stats/",
            {"year": "not-a-year"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_attended_prospect_included_in_total_visitors(self):
        year = 2030
        visitor_attended = Person.objects.create_user(
            username="attended_prospect_p",
            password="password123",
            first_name="Attended",
            last_name="Prospect",
            role="VISITOR",
            status="ATTENDED",
        )
        Prospect.objects.create(
            first_name="Attended",
            last_name="Prospect",
            invited_by=self.inviter,
            inviter_cluster=self.cluster,
            evangelism_group=self.group,
            person=visitor_attended,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            is_dropped_off=False,
        )

        response = self.client.get(
            "/api/evangelism/groups/dashboard-stats/",
            {"year": year},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["total_visitors"], 1)
