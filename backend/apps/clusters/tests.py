from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from datetime import date, timedelta

from .models import Cluster, ClusterWeeklyReport
from apps.people.models import Family

Person = get_user_model()


class ClusterModelTests(TestCase):
    def setUp(self):
        self.coordinator = Person.objects.create_user(
            username="coordinator",
            email="coord@example.com",
            password="password123",
            first_name="Coord",
            last_name="Inator",
            role="COORDINATOR",
        )
        self.member1 = Person.objects.create_user(
            username="member1",
            email="member1@example.com",
            password="password123",
            first_name="Member",
            last_name="One",
            role="MEMBER",
        )
        self.member2 = Person.objects.create_user(
            username="member2",
            email="member2@example.com",
            password="password123",
            first_name="Member",
            last_name="Two",
            role="MEMBER",
        )

    def test_cluster_creation(self):
        cluster = Cluster.objects.create(
            code="CLU-001",
            name="Test Cluster",
            coordinator=self.coordinator,
            location="Test Location",
            meeting_schedule="Every Sunday at 7 PM",
            description="Test description",
        )
        self.assertEqual(cluster.code, "CLU-001")
        self.assertEqual(cluster.name, "Test Cluster")
        self.assertEqual(cluster.coordinator, self.coordinator)
        self.assertEqual(str(cluster), "Test Cluster")

    def test_cluster_with_members(self):
        cluster = Cluster.objects.create(
            code="CLU-002",
            name="Member Cluster",
            coordinator=self.coordinator,
        )
        cluster.members.add(self.member1, self.member2)
        self.assertEqual(cluster.members.count(), 2)
        self.assertIn(self.member1, cluster.members.all())
        self.assertIn(self.member2, cluster.members.all())

    def test_cluster_string_representation(self):
        cluster = Cluster.objects.create(name="Named Cluster")
        self.assertEqual(str(cluster), "Named Cluster")

        cluster2 = Cluster.objects.create(code="CLU-003")
        self.assertEqual(str(cluster2), "CLU-003")

        cluster3 = Cluster.objects.create()
        self.assertEqual(str(cluster3), f"Cluster {cluster3.id}")


class ClusterWeeklyReportModelTests(TestCase):
    def setUp(self):
        self.coordinator = Person.objects.create_user(
            username="coordinator",
            email="coord@example.com",
            password="password123",
            first_name="Coord",
            last_name="Inator",
            role="COORDINATOR",
        )
        self.member1 = Person.objects.create_user(
            username="member1",
            email="member1@example.com",
            password="password123",
            first_name="Member",
            last_name="One",
            role="MEMBER",
        )
        self.member2 = Person.objects.create_user(
            username="member2",
            email="member2@example.com",
            password="password123",
            first_name="Member",
            last_name="Two",
            role="MEMBER",
        )
        self.visitor = Person.objects.create_user(
            username="visitor",
            email="visitor@example.com",
            password="password123",
            first_name="Visitor",
            last_name="One",
            role="VISITOR",
        )
        self.cluster = Cluster.objects.create(
            code="CLU-001",
            name="Test Cluster",
            coordinator=self.coordinator,
        )
        self.cluster.members.add(self.member1, self.member2)

    def test_report_creation(self):
        today = date.today()
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=today.year,
            week_number=today.isocalendar()[1],
            meeting_date=today,
            gathering_type="PHYSICAL",
            offerings=Decimal("1000.00"),
            submitted_by=self.coordinator,
        )
        self.assertEqual(report.cluster, self.cluster)
        self.assertEqual(report.year, today.year)
        self.assertEqual(report.gathering_type, "PHYSICAL")
        self.assertEqual(report.offerings, Decimal("1000.00"))

    def test_members_present_property(self):
        today = date.today()
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=today.year,
            week_number=today.isocalendar()[1],
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        report.members_attended.add(self.member1)
        self.assertEqual(report.members_present, 1)

        report.members_attended.add(self.member2)
        self.assertEqual(report.members_present, 2)

    def test_visitors_present_property(self):
        today = date.today()
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=today.year,
            week_number=today.isocalendar()[1],
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        report.visitors_attended.add(self.visitor)
        self.assertEqual(report.visitors_present, 1)

    def test_member_attendance_rate(self):
        today = date.today()
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=today.year,
            week_number=today.isocalendar()[1],
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        # 2 members total, 1 attended = 50%
        report.members_attended.add(self.member1)
        self.assertEqual(report.member_attendance_rate, 50.0)

        # 2 members total, 2 attended = 100%
        report.members_attended.add(self.member2)
        self.assertEqual(report.member_attendance_rate, 100.0)

    def test_member_attendance_rate_zero_members(self):
        empty_cluster = Cluster.objects.create(
            code="CLU-002",
            name="Empty Cluster",
            coordinator=self.coordinator,
        )
        today = date.today()
        report = ClusterWeeklyReport.objects.create(
            cluster=empty_cluster,
            year=today.year,
            week_number=today.isocalendar()[1],
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        # No members, should return 0.0 to avoid division by zero
        self.assertEqual(report.member_attendance_rate, 0.0)

    def test_unique_constraint(self):
        today = date.today()
        year = today.year
        week = today.isocalendar()[1]

        ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=year,
            week_number=week,
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )

        # Creating another report for the same cluster/year/week should fail
        with self.assertRaises(Exception):
            ClusterWeeklyReport.objects.create(
                cluster=self.cluster,
                year=year,
                week_number=week,
                meeting_date=today,
                gathering_type="ONLINE",
                submitted_by=self.coordinator,
            )


class ClusterAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = Person.objects.create_user(
            username="apiuser",
            email="apiuser@example.com",
            password="strongpass",
            role="ADMIN",
        )
        self.client.force_authenticate(user=self.user)
        self.coordinator = Person.objects.create_user(
            username="coordinator",
            email="coord@example.com",
            password="password123",
            first_name="Coord",
            last_name="Inator",
            role="COORDINATOR",
        )

    def test_list_clusters(self):
        Cluster.objects.create(
            code="CLU-001",
            name="Test Cluster",
            coordinator=self.coordinator,
        )
        response = self.client.get("/api/clusters/clusters/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_create_cluster(self):
        response = self.client.post(
            "/api/clusters/clusters/",
            {
                "code": "CLU-002",
                "name": "New Cluster",
                "coordinator_id": self.coordinator.id,
                "location": "New Location",
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Cluster.objects.count(), 1)
        self.assertEqual(Cluster.objects.first().code, "CLU-002")

    def test_retrieve_cluster(self):
        cluster = Cluster.objects.create(
            code="CLU-003",
            name="Retrieve Cluster",
            coordinator=self.coordinator,
        )
        response = self.client.get(f"/api/clusters/clusters/{cluster.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["code"], "CLU-003")

    def test_update_cluster(self):
        cluster = Cluster.objects.create(
            code="CLU-004",
            name="Update Cluster",
            coordinator=self.coordinator,
        )
        response = self.client.put(
            f"/api/clusters/clusters/{cluster.id}/",
            {
                "code": "CLU-004",
                "name": "Updated Cluster",
                "coordinator_id": self.coordinator.id,
                "location": "Updated Location",
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        cluster.refresh_from_db()
        self.assertEqual(cluster.name, "Updated Cluster")

    def test_delete_cluster(self):
        cluster = Cluster.objects.create(
            code="CLU-005",
            name="Delete Cluster",
            coordinator=self.coordinator,
        )
        response = self.client.delete(f"/api/clusters/clusters/{cluster.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Cluster.objects.count(), 0)


class ClusterWeeklyReportAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = Person.objects.create_user(
            username="apiuser",
            email="apiuser@example.com",
            password="strongpass",
            role="ADMIN",
        )
        self.client.force_authenticate(user=self.user)
        self.coordinator = Person.objects.create_user(
            username="coordinator",
            email="coord@example.com",
            password="password123",
            first_name="Coord",
            last_name="Inator",
            role="COORDINATOR",
        )
        self.member = Person.objects.create_user(
            username="member",
            email="member@example.com",
            password="password123",
            first_name="Member",
            last_name="One",
            role="MEMBER",
        )
        self.cluster = Cluster.objects.create(
            code="CLU-001",
            name="Test Cluster",
            coordinator=self.coordinator,
        )
        self.cluster.members.add(self.member)

    def test_list_reports(self):
        today = date.today()
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=today.year,
            week_number=today.isocalendar()[1],
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        response = self.client.get("/api/clusters/cluster-weekly-reports/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)

    def test_create_report(self):
        today = date.today()
        response = self.client.post(
            "/api/clusters/cluster-weekly-reports/",
            {
                "cluster": self.cluster.id,
                "year": today.year,
                "week_number": today.isocalendar()[1],
                "meeting_date": today.isoformat(),
                "gathering_type": "PHYSICAL",
                "members_attended": [self.member.id],
                "visitors_attended": [],
                "offerings": "1000.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ClusterWeeklyReport.objects.count(), 1)
        report = ClusterWeeklyReport.objects.first()
        self.assertEqual(report.members_present, 1)

    def test_analytics_endpoint(self):
        today = date.today()
        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=today.year,
            week_number=today.isocalendar()[1],
            meeting_date=today,
            gathering_type="PHYSICAL",
            offerings=Decimal("500.00"),
            submitted_by=self.coordinator,
        )
        report.members_attended.add(self.member)

        response = self.client.get("/api/clusters/cluster-weekly-reports/analytics/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_reports"], 1)
        self.assertEqual(response.data["total_attendance"]["members"], 1)
        self.assertEqual(float(response.data["total_offerings"]), 500.0)

    def test_overdue_endpoint(self):
        response = self.client.get("/api/clusters/cluster-weekly-reports/overdue/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("current_year", response.data)
        self.assertIn("current_week", response.data)
        self.assertIn("overdue_count", response.data)
        self.assertIn("overdue_clusters", response.data)


