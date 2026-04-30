from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.test import APIRequestFactory
from datetime import date, timedelta

from .models import Cluster, ClusterWeeklyReport
from apps.people.models import Family, Branch, ModuleCoordinator
from apps.clusters.serializers import ClusterSerializer
from apps.people.serializers import PersonSerializer

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

    def test_admin_filters_list_by_branch_id(self):
        ba = Branch.objects.create(name="Admin BA", code="BR_ADMBA")
        bb = Branch.objects.create(name="Admin BB", code="BR_ADMBB")
        Cluster.objects.create(
            code="CLU-BA",
            name="Branch A Cluster",
            coordinator=self.coordinator,
            branch=ba,
        )
        Cluster.objects.create(
            code="CLU-BB",
            name="Branch B Cluster",
            coordinator=self.coordinator,
            branch=bb,
        )
        response = self.client.get(
            "/api/clusters/clusters/",
            {"branch_id": ba.id},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "CLU-BA")

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

    def test_create_cluster_adds_coordinator_to_members(self):
        response = self.client.post(
            "/api/clusters/clusters/",
            {
                "code": "CLU-COORD-MEM",
                "name": "Coord Member Cluster",
                "coordinator_id": self.coordinator.id,
                "location": "Here",
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        cluster = Cluster.objects.get(code="CLU-COORD-MEM")
        self.assertIn(self.coordinator, cluster.members.all())

    def test_update_cluster_adds_coordinator_to_members_when_omitted_from_members(
        self,
    ):
        member = Person.objects.create_user(
            username="plainmember",
            email="plain@example.com",
            password="password123",
            first_name="Plain",
            last_name="Member",
            role="MEMBER",
        )
        cluster = Cluster.objects.create(
            code="CLU-MIX",
            name="Mixed Cluster",
            coordinator=None,
            location="There",
        )
        cluster.members.add(member)

        response = self.client.put(
            f"/api/clusters/clusters/{cluster.id}/",
            {
                "code": "CLU-MIX",
                "name": "Mixed Cluster",
                "coordinator_id": self.coordinator.id,
                "location": "There",
                "families": [],
                "members": [member.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        cluster.refresh_from_db()
        ids = set(cluster.members.values_list("id", flat=True))
        self.assertIn(self.coordinator.id, ids)
        self.assertIn(member.id, ids)

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


class NonSeniorClusterCoordinatorScopeAPITests(TestCase):
    """Non-senior CLUSTER coordinators: clusters in their branch; mutations only on managed clusters."""

    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(name="Scope A", code="BR_SCPA")
        self.branch_b = Branch.objects.create(name="Scope B", code="BR_SCPB")
        self.coord_a = Person.objects.create_user(
            username="coord_scope_a",
            email="scope_a@example.com",
            password="password123",
            role="COORDINATOR",
            branch=self.branch_a,
        )
        self.coord_b = Person.objects.create_user(
            username="coord_scope_b",
            email="scope_b@example.com",
            password="password123",
            role="COORDINATOR",
            branch=self.branch_b,
        )
        self.cluster_a = Cluster.objects.create(
            code="CLU-SCOPE-A",
            name="Cluster Scope A",
            coordinator=self.coord_a,
            branch=self.branch_a,
        )
        self.cluster_b = Cluster.objects.create(
            code="CLU-SCOPE-B",
            name="Cluster Scope B",
            coordinator=self.coord_b,
            branch=self.branch_b,
        )
        ModuleCoordinator.objects.create(
            person=self.coord_a,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.cluster_a.id,
            resource_type="Cluster",
        )
        ModuleCoordinator.objects.create(
            person=self.coord_b,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.cluster_b.id,
            resource_type="Cluster",
        )

    def _cluster_list_results(self, response):
        data = response.data
        if isinstance(data, list):
            return data
        return data.get("results", data)

    def test_coord_branch_id_query_param_ignored(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.get(
            "/api/clusters/clusters/",
            {"branch_id": self.branch_b.id},
        )
        self.assertEqual(response.status_code, 200)
        results = self._cluster_list_results(response)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["code"], "CLU-SCOPE-A")

    def test_coord_lists_clusters_in_own_branch(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.get("/api/clusters/clusters/")
        self.assertEqual(response.status_code, 200)
        results = self._cluster_list_results(response)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["code"], "CLU-SCOPE-A")

    def test_coord_cannot_retrieve_cluster_outside_branch(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.get(f"/api/clusters/clusters/{self.cluster_b.id}/")
        self.assertEqual(response.status_code, 404)

    def test_coord_cannot_patch_other_cluster(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.patch(
            f"/api/clusters/clusters/{self.cluster_b.id}/",
            {"name": "Should Not Apply"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_coord_can_patch_own_cluster(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.patch(
            f"/api/clusters/clusters/{self.cluster_a.id}/",
            {"name": "Updated Scope A"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.cluster_a.refresh_from_db()
        self.assertEqual(self.cluster_a.name, "Updated Scope A")

    def test_coord_can_delete_own_cluster(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.delete(f"/api/clusters/clusters/{self.cluster_a.id}/")
        self.assertEqual(response.status_code, 204)

    def test_coord_cannot_delete_other_cluster(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.delete(f"/api/clusters/clusters/{self.cluster_b.id}/")
        self.assertEqual(response.status_code, 404)


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

    def test_create_report_allows_coordinator_in_members_attended(self):
        today = date.today()
        response = self.client.post(
            "/api/clusters/cluster-weekly-reports/",
            {
                "cluster": self.cluster.id,
                "year": today.year,
                "week_number": today.isocalendar()[1],
                "meeting_date": today.isoformat(),
                "gathering_type": "PHYSICAL",
                "members_attended": [self.coordinator.id],
                "visitors_attended": [],
                "offerings": "1000.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        report = ClusterWeeklyReport.objects.first()
        self.assertIn(self.coordinator.id, report.members_attended.values_list("id", flat=True))

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

        self.assertIn("chart_series", response.data)
        cs = response.data["chart_series"]
        self.assertEqual(len(cs["monthly_attendance"]), 1)
        self.assertEqual(cs["monthly_attendance"][0]["members"], 1)
        self.assertEqual(len(cs["cluster_comparison"]), 1)
        self.assertEqual(cs["cluster_comparison"][0]["sum_members_attended"], 1)

    def test_analytics_aggregate_sums_across_multiple_reports(self):
        visitor = Person.objects.create_user(
            username="visitor_stat",
            email="visitor_stat@example.com",
            password="password123",
            first_name="Visit",
            last_name="Or",
            role="VISITOR",
        )
        today = date.today()
        report_a = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=today.year,
            week_number=10,
            meeting_date=today,
            gathering_type="PHYSICAL",
            offerings=Decimal("100.00"),
            submitted_by=self.coordinator,
        )
        report_a.members_attended.add(self.member)
        report_b = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=today.year,
            week_number=11,
            meeting_date=today,
            gathering_type="ONLINE",
            offerings=Decimal("400.00"),
            submitted_by=self.coordinator,
        )
        report_b.members_attended.add(self.member, self.coordinator)
        report_b.visitors_attended.add(visitor)

        response = self.client.get("/api/clusters/cluster-weekly-reports/analytics/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_reports"], 2)
        self.assertEqual(response.data["total_attendance"]["members"], 3)
        self.assertEqual(response.data["total_attendance"]["visitors"], 1)
        self.assertEqual(response.data["average_attendance"]["avg_members"], 1.5)
        self.assertEqual(response.data["average_attendance"]["avg_visitors"], 0.5)
        self.assertEqual(float(response.data["total_offerings"]), 500.0)

        cs = response.data["chart_series"]
        self.assertEqual(len(cs["monthly_attendance"]), 1)
        self.assertEqual(cs["monthly_attendance"][0]["members"], 3)
        self.assertEqual(cs["monthly_attendance"][0]["visitors"], 1)
        self.assertEqual(len(cs["cluster_comparison"]), 1)
        self.assertEqual(cs["cluster_comparison"][0]["report_count"], 2)
        self.assertEqual(cs["cluster_comparison"][0]["sum_members_attended"], 3)

    def test_analytics_chart_series_two_months_two_clusters(self):
        cluster2 = Cluster.objects.create(
            code="CLU-002",
            name="Second Cluster",
            coordinator=self.coordinator,
        )
        cluster2.members.add(self.member)

        jan = date(2025, 1, 15)
        feb = date(2025, 2, 10)
        r1 = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2025,
            week_number=3,
            meeting_date=jan,
            gathering_type="PHYSICAL",
            offerings=Decimal("0"),
            submitted_by=self.coordinator,
        )
        r1.members_attended.add(self.member)
        r2 = ClusterWeeklyReport.objects.create(
            cluster=cluster2,
            year=2025,
            week_number=6,
            meeting_date=feb,
            gathering_type="ONLINE",
            offerings=Decimal("0"),
            submitted_by=self.coordinator,
        )
        r2.members_attended.add(self.member, self.coordinator)

        response = self.client.get("/api/clusters/cluster-weekly-reports/analytics/")
        self.assertEqual(response.status_code, 200)
        cs = response.data["chart_series"]
        monthly = cs["monthly_attendance"]
        self.assertEqual(len(monthly), 2)
        keys = {m["month_key"] for m in monthly}
        self.assertIn("2025-01", keys)
        self.assertIn("2025-02", keys)
        jan_row = next(m for m in monthly if m["month_key"] == "2025-01")
        feb_row = next(m for m in monthly if m["month_key"] == "2025-02")
        self.assertEqual(jan_row["members"], 1)
        self.assertEqual(feb_row["members"], 2)

        cc = cs["cluster_comparison"]
        self.assertEqual(len(cc), 2)
        by_id = {c["cluster_id"]: c for c in cc}
        self.assertEqual(by_id[self.cluster.id]["report_count"], 1)
        self.assertEqual(by_id[self.cluster.id]["sum_members_attended"], 1)
        self.assertEqual(by_id[cluster2.id]["report_count"], 1)
        self.assertEqual(by_id[cluster2.id]["sum_members_attended"], 2)

    def test_overdue_endpoint(self):
        response = self.client.get("/api/clusters/cluster-weekly-reports/overdue/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("current_year", response.data)
        self.assertIn("current_week", response.data)
        self.assertIn("overdue_count", response.data)
        self.assertIn("overdue_clusters", response.data)


class ClusterWeeklyReportDistinctYearsTests(TestCase):
    """distinct_years uses facet filters only; not list RBAC."""

    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(name="DY-A", code="BR_DYA")
        self.branch_b = Branch.objects.create(name="DY-B", code="BR_DYB")
        self.admin = Person.objects.create_user(
            username="adm_dy",
            email="adm_dy@example.com",
            password="password123",
            first_name="Admin",
            last_name="DistinctYears",
            role="ADMIN",
        )
        self.coord = Person.objects.create_user(
            username="coord_dy",
            email="coord_dy@example.com",
            password="password123",
            first_name="Coord",
            last_name="DY",
            role="COORDINATOR",
            branch=self.branch_a,
        )
        self.member = Person.objects.create_user(
            username="mem_dy",
            email="mem_dy@example.com",
            password="password123",
            first_name="Member",
            last_name="DY",
            role="MEMBER",
            branch=self.branch_a,
        )
        self.cluster_a = Cluster.objects.create(
            code="CL-DY-A",
            name="Distinct A",
            coordinator=self.coord,
            branch=self.branch_a,
        )
        self.cluster_a.members.add(self.member)
        self.cluster_b = Cluster.objects.create(
            code="CL-DY-B",
            name="Distinct B",
            coordinator=self.coord,
            branch=self.branch_b,
        )

    def test_returns_distinct_years_descending(self):
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_a,
            year=2024,
            week_number=20,
            meeting_date=date(2024, 5, 15),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_a,
            year=2022,
            week_number=20,
            meeting_date=date(2022, 5, 15),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        self.client.force_authenticate(user=self.admin)
        r = self.client.get("/api/clusters/cluster-weekly-reports/distinct_years/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["years"], [2024, 2022])

    def test_filters_by_branch_facet(self):
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_a,
            year=2023,
            week_number=10,
            meeting_date=date(2023, 3, 1),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_b,
            year=2019,
            week_number=10,
            meeting_date=date(2019, 3, 1),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(
            "/api/clusters/cluster-weekly-reports/distinct_years/",
            {"branch_id": self.branch_a.id},
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["years"], [2023])

    def test_member_sees_years_outside_list_scope_when_not_faceted(self):
        """Row visibility differs from distinct_years (plan: organizational metadata)."""
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_a,
            year=2025,
            week_number=5,
            meeting_date=date(2025, 2, 1),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_b,
            year=1999,
            week_number=5,
            meeting_date=date(1999, 2, 1),
            gathering_type="ONLINE",
            submitted_by=self.coord,
        )
        self.client.force_authenticate(user=self.member)
        r_years = self.client.get("/api/clusters/cluster-weekly-reports/distinct_years/")
        self.assertEqual(r_years.status_code, 200)
        self.assertEqual(set(r_years.data["years"]), {2025, 1999})

        r_list = self.client.get("/api/clusters/cluster-weekly-reports/")
        self.assertEqual(r_list.status_code, 200)
        list_years = {row["year"] for row in r_list.data["results"]}
        self.assertEqual(list_years, {2025})


class ClusterWeeklyReportBranchScopeTests(TestCase):
    """Privileged users may filter by branch query param; others are scoped to user.branch."""

    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(name="BR-A-RPT", code="BR_ARPT")
        self.branch_b = Branch.objects.create(name="BR-B-RPT", code="BR_BRPT")
        self.admin = Person.objects.create_user(
            username="adm_brpt",
            email="adm_brpt@example.com",
            password="password123",
            first_name="Admin",
            last_name="Reports",
            role="ADMIN",
        )
        self.coord_a = Person.objects.create_user(
            username="coord_br_a",
            email="coord_br_a@example.com",
            password="password123",
            first_name="Coord",
            last_name="BranchA",
            role="COORDINATOR",
            branch=self.branch_a,
        )
        self.coord_b = Person.objects.create_user(
            username="coord_br_b",
            email="coord_br_b@example.com",
            password="password123",
            first_name="Coord",
            last_name="BranchB",
            role="COORDINATOR",
            branch=self.branch_b,
        )
        self.cluster_a = Cluster.objects.create(
            code="CL-BR-A",
            name="Cluster A",
            coordinator=self.coord_a,
            branch=self.branch_a,
        )
        self.cluster_b = Cluster.objects.create(
            code="CL-BR-B",
            name="Cluster B",
            coordinator=self.coord_b,
            branch=self.branch_b,
        )
        today = date.today()
        self.report_a = ClusterWeeklyReport.objects.create(
            cluster=self.cluster_a,
            year=today.year,
            week_number=10,
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coord_a,
        )
        self.report_b = ClusterWeeklyReport.objects.create(
            cluster=self.cluster_b,
            year=today.year,
            week_number=11,
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coord_b,
        )

    def test_admin_filters_by_branch_id(self):
        self.client.force_authenticate(user=self.admin)
        url = "/api/clusters/cluster-weekly-reports/"
        r_all = self.client.get(url)
        self.assertEqual(r_all.status_code, 200)
        self.assertEqual(len(r_all.data["results"]), 2)

        r_a = self.client.get(url, {"branch_id": self.branch_a.id})
        self.assertEqual(len(r_a.data["results"]), 1)
        self.assertEqual(r_a.data["results"][0]["id"], self.report_a.id)

        r_b = self.client.get(url, {"branch": str(self.branch_b.id)})
        self.assertEqual(len(r_b.data["results"]), 1)
        self.assertEqual(r_b.data["results"][0]["id"], self.report_b.id)

    def test_coordinator_sees_only_own_branch_reports(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.get("/api/clusters/cluster-weekly-reports/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["id"], self.report_a.id)

    def test_coordinator_cannot_expand_scope_via_branch_param(self):
        self.client.force_authenticate(user=self.coord_a)
        response = self.client.get(
            "/api/clusters/cluster-weekly-reports/",
            {"branch_id": self.branch_b.id},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["id"], self.report_a.id)

    def test_senior_cluster_coordinator_can_filter_by_branch(self):
        senior = Person.objects.create_user(
            username="senior_br",
            email="senior_br@example.com",
            password="password123",
            first_name="Senior",
            last_name="Coord",
            role="COORDINATOR",
            branch=self.branch_a,
        )
        ModuleCoordinator.objects.create(
            person=senior,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        self.client.force_authenticate(user=senior)
        r_b = self.client.get(
            "/api/clusters/cluster-weekly-reports/",
            {"branch_id": self.branch_b.id},
        )
        self.assertEqual(r_b.status_code, 200)
        self.assertEqual(len(r_b.data["results"]), 1)
        self.assertEqual(r_b.data["results"][0]["id"], self.report_b.id)


class ClusterBranchMembershipTests(TestCase):
    """Branch-cluster membership pruning."""

    def test_person_branch_transfer_removes_mismatched_cluster_memberships(self):
        branch_a = Branch.objects.create(name="TA_mt", code="TA_MT")
        branch_b = Branch.objects.create(name="TB_mt", code="TB_MT")
        admin = Person.objects.create_user(
            username="adm_mt",
            email="adm_mt@test.com",
            password="password123",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
        )
        member = Person.objects.create_user(
            username="mem_mt",
            email="mem_mt@test.com",
            password="password123",
            first_name="Member",
            last_name="Transfer",
            role="MEMBER",
            branch=branch_a,
        )
        cluster = Cluster.objects.create(code="MT1", name="Mem Transfer", branch=branch_a)
        cluster.members.add(member)

        factory = APIRequestFactory()
        request = factory.patch("/")
        request.user = admin

        serializer = PersonSerializer(
            member,
            data={"branch": branch_b.id},
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        cluster.refresh_from_db()
        self.assertNotIn(member, cluster.members.all())

    def test_cluster_branch_change_removes_members_not_matching_new_branch(self):
        branch_a = Branch.objects.create(name="TA_mt2", code="TA_MT2")
        branch_b = Branch.objects.create(name="TB_mt2", code="TB_MT2")
        admin = Person.objects.create_user(
            username="adm_mt2",
            email="adm_mt2@test.com",
            password="password123",
            first_name="Admin",
            last_name="Two",
            role="ADMIN",
        )
        member = Person.objects.create_user(
            username="mem_mt2",
            email="mem_mt2@test.com",
            password="password123",
            first_name="Member",
            last_name="Stay",
            role="MEMBER",
            branch=branch_a,
        )
        cluster = Cluster.objects.create(code="MT2", name="Cluster Move", branch=branch_a)
        cluster.members.add(member)

        factory = APIRequestFactory()
        request = factory.patch("/")
        request.user = admin

        serializer = ClusterSerializer(
            cluster,
            data={"branch": branch_b.id},
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        cluster.refresh_from_db()
        self.assertNotIn(member, cluster.members.all())

    def test_cluster_update_clears_coordinator_wrong_branch(self):
        branch_a = Branch.objects.create(name="TA_mt3", code="TA_MT3")
        branch_b = Branch.objects.create(name="TB_mt3", code="TB_MT3")
        admin = Person.objects.create_user(
            username="adm_mt3",
            email="adm_mt3@test.com",
            password="password123",
            first_name="Admin",
            last_name="Three",
            role="ADMIN",
        )
        coord = Person.objects.create_user(
            username="coord_mt3",
            email="coord_mt3@test.com",
            password="password123",
            first_name="Coord",
            last_name="WrongBranch",
            role="COORDINATOR",
            branch=branch_b,
        )
        cluster = Cluster.objects.create(
            code="MT3",
            name="Coord Clear",
            branch=branch_a,
            coordinator=coord,
        )

        factory = APIRequestFactory()
        request = factory.patch("/")
        request.user = admin

        serializer = ClusterSerializer(
            cluster,
            data={"name": "Renamed cluster"},
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        cluster.refresh_from_db()
        self.assertIsNone(cluster.coordinator_id)


class MemberClusterBrowseAPITests(TestCase):
    """MEMBER can read/browse clusters in their branch; weekly reports stay membership-scoped."""

    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(name="Browse Branch", code="BR_BRWS")
        self.branch_other = Branch.objects.create(name="Browse Other", code="BR_BRWO")
        self.coordinator = Person.objects.create_user(
            username="coord_browse",
            email="coord_browse@example.com",
            password="password123",
            first_name="Coord",
            last_name="Browse",
            role="COORDINATOR",
            branch=self.branch,
        )
        self.coord_other = Person.objects.create_user(
            username="coord_browse_o",
            email="coord_browse_o@example.com",
            password="password123",
            first_name="Coord",
            last_name="OtherBr",
            role="COORDINATOR",
            branch=self.branch_other,
        )
        self.member = Person.objects.create_user(
            username="member_browse",
            email="member_browse@example.com",
            password="password123",
            first_name="Member",
            last_name="Browse",
            role="MEMBER",
            branch=self.branch,
        )
        self.cluster_in = Cluster.objects.create(
            code="CLU-IN",
            name="In Cluster",
            coordinator=self.coordinator,
            branch=self.branch,
        )
        self.cluster_in.members.add(self.member)
        self.cluster_out = Cluster.objects.create(
            code="CLU-OUT",
            name="Out Cluster",
            coordinator=self.coordinator,
            branch=self.branch,
        )
        self.cluster_other_branch = Cluster.objects.create(
            code="CLU-OTHER-BR",
            name="Other Branch Cluster",
            coordinator=self.coord_other,
            branch=self.branch_other,
        )

    def test_member_lists_clusters_in_own_branch_only(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/clusters/clusters/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        codes = {row["code"] for row in response.data}
        self.assertEqual(codes, {"CLU-IN", "CLU-OUT"})

    def test_member_weekly_reports_only_for_member_clusters(self):
        today = date.today()
        week = today.isocalendar()[1]
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_in,
            year=today.year,
            week_number=week,
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_out,
            year=today.year,
            week_number=week,
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        self.client.force_authenticate(user=self.member)
        response = self.client.get("/api/clusters/cluster-weekly-reports/")
        self.assertEqual(response.status_code, 200)
        results = response.data["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["cluster"], self.cluster_in.id)

    def test_member_weekly_reports_ignore_branch_query_param(self):
        today = date.today()
        week = today.isocalendar()[1]
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster_in,
            year=today.year,
            week_number=week,
            meeting_date=today,
            gathering_type="PHYSICAL",
            submitted_by=self.coordinator,
        )
        other_branch = Branch.objects.create(name="Other Br", code="BR_OTHRWR")
        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            "/api/clusters/cluster-weekly-reports/",
            {"branch_id": other_branch.id},
        )
        self.assertEqual(response.status_code, 200)
        results = response.data["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["cluster"], self.cluster_in.id)

    def test_member_cannot_create_cluster(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/clusters/clusters/",
            {
                "code": "CLU-X",
                "name": "Hack",
                "coordinator_id": self.coordinator.id,
                "location": "X",
                "families": [],
                "members": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_member_cannot_update_cluster(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/clusters/clusters/{self.cluster_in.id}/",
            {"name": "Renamed by member"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_member_cannot_create_weekly_report(self):
        today = date.today()
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            "/api/clusters/cluster-weekly-reports/",
            {
                "cluster": self.cluster_in.id,
                "year": today.year,
                "week_number": today.isocalendar()[1],
                "meeting_date": today.isoformat(),
                "gathering_type": "PHYSICAL",
                "members_attended": [self.member.id],
                "visitors_attended": [],
                "offerings": "0.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)