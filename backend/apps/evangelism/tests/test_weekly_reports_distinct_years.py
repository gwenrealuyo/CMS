from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.people.models import Branch, Person
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport


class EvangelismWeeklyReportDistinctYearsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(name="EG-Y-A", code="BR_EGYA")
        self.branch_b = Branch.objects.create(name="EG-Y-B", code="BR_EGYB")
        self.admin = Person.objects.create_user(
            username="adm_egy",
            email="adm_egy@example.com",
            password="password123",
            role="ADMIN",
            status="ACTIVE",
        )
        self.coord = Person.objects.create_user(
            username="coord_egy",
            email="coord_egy@example.com",
            password="password123",
            role="COORDINATOR",
            branch=self.branch_a,
            status="ACTIVE",
        )
        self.cluster_a = Cluster.objects.create(
            code="CL-EGY-A",
            name="EGY A",
            coordinator=self.coord,
            branch=self.branch_a,
        )
        self.cluster_b = Cluster.objects.create(
            code="CL-EGY-B",
            name="EGY B",
            coordinator=self.coord,
            branch=self.branch_b,
        )
        self.group_a = EvangelismGroup.objects.create(
            name="Group A",
            cluster=self.cluster_a,
            coordinator=self.coord,
            is_active=True,
        )
        self.group_b = EvangelismGroup.objects.create(
            name="Group B",
            cluster=self.cluster_b,
            coordinator=self.coord,
            is_active=True,
        )

    def test_returns_distinct_years_descending(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group_a,
            year=2024,
            week_number=20,
            meeting_date=date(2024, 5, 15),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group_a,
            year=2022,
            week_number=21,
            meeting_date=date(2022, 5, 22),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        self.client.force_authenticate(user=self.admin)
        r = self.client.get("/api/evangelism/weekly-reports/distinct_years/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["years"], [2024, 2022])

    def test_filters_by_branch(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group_a,
            year=2023,
            week_number=10,
            meeting_date=date(2023, 3, 1),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group_b,
            year=2019,
            week_number=10,
            meeting_date=date(2019, 3, 1),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(
            "/api/evangelism/weekly-reports/distinct_years/",
            {"branch": self.branch_a.id},
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["years"], [2023])

    def test_filters_by_evangelism_group(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group_a,
            year=2021,
            week_number=5,
            meeting_date=date(2021, 2, 1),
            gathering_type="ONLINE",
            submitted_by=self.coord,
        )
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group_b,
            year=2020,
            week_number=5,
            meeting_date=date(2020, 2, 1),
            gathering_type="ONLINE",
            submitted_by=self.coord,
        )
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(
            "/api/evangelism/weekly-reports/distinct_years/",
            {"evangelism_group": self.group_a.id},
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["years"], [2021])

    def test_filters_by_gathering_type(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group_a,
            year=2025,
            week_number=8,
            meeting_date=date(2025, 2, 20),
            gathering_type="HYBRID",
            submitted_by=self.coord,
        )
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group_a,
            year=2025,
            week_number=9,
            meeting_date=date(2025, 2, 27),
            gathering_type="PHYSICAL",
            submitted_by=self.coord,
        )
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(
            "/api/evangelism/weekly-reports/distinct_years/",
            {"gathering_type": "HYBRID"},
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["years"], [2025])
