from datetime import date

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.people.models import Branch, Person


class WeeklyTallyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin_weekly_tally",
            password="password123",
            first_name="Admin",
            last_name="Tally",
            role="ADMIN",
            status="ACTIVE",
        )
        self.client.force_authenticate(user=self.admin)

        self.branch = Branch.objects.create(name="Weekly Tally Branch", code="WTB")
        self.coordinator = Person.objects.create_user(
            username="weekly_tally_coord",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            code="WT-001",
            name="Weekly Tally Cluster",
            branch=self.branch,
            coordinator=self.coordinator,
        )
        self.member_a = Person.objects.create_user(
            username="weekly_member_a",
            password="password123",
            first_name="Member",
            last_name="A",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member_b = Person.objects.create_user(
            username="weekly_member_b",
            password="password123",
            first_name="Member",
            last_name="B",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.visitor = Person.objects.create_user(
            username="weekly_visitor",
            password="password123",
            first_name="Visitor",
            last_name="One",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        self.eg1 = EvangelismGroup.objects.create(
            name="EG One",
            cluster=self.cluster,
            coordinator=self.coordinator,
        )
        self.eg2 = EvangelismGroup.objects.create(
            name="EG Two",
            cluster=self.cluster,
            coordinator=self.coordinator,
        )
        self.eg_unassigned = EvangelismGroup.objects.create(
            name="EG Unassigned",
            cluster=None,
            coordinator=self.coordinator,
        )

    def _row_for(self, rows, *, cluster_id, year, week_number):
        matches = [
            row
            for row in rows
            if row["cluster_id"] == cluster_id
            and row["year"] == year
            and row["week_number"] == week_number
        ]
        self.assertEqual(len(matches), 1, matches)
        return matches[0]

    def test_same_person_across_streams_counts_once(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.eg1,
            year=2026,
            week_number=10,
            meeting_date=date(2026, 3, 3),
            gathering_type="PHYSICAL",
            new_prospects=1,
            conversions_this_week=0,
            submitted_by=self.admin,
        ).members_attended.add(self.member_a)

        ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=10,
            meeting_date=date(2026, 3, 4),
            gathering_type="PHYSICAL",
            submitted_by=self.admin,
        ).members_attended.add(self.member_a)

        response = self.client.get(
            "/api/evangelism/weekly-reports/tally/",
            {"year": 2026},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = self._row_for(
            response.data,
            cluster_id=self.cluster.id,
            year=2026,
            week_number=10,
        )
        self.assertEqual(row["members_count"], 1)
        self.assertEqual(row["evangelism_reports_count"], 1)
        self.assertEqual(row["cluster_reports_count"], 1)
        self.assertEqual(row["new_prospects"], 1)
        self.assertEqual(row["meeting_date"], "2026-03-03")

    def test_mixed_gathering_types(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.eg1,
            year=2026,
            week_number=11,
            meeting_date=date(2026, 3, 10),
            gathering_type="PHYSICAL",
            submitted_by=self.admin,
        )
        ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=11,
            meeting_date=date(2026, 3, 11),
            gathering_type="ONLINE",
            submitted_by=self.admin,
        )

        response = self.client.get(
            "/api/evangelism/weekly-reports/tally/",
            {"year": 2026, "week_number": 11},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = self._row_for(
            response.data,
            cluster_id=self.cluster.id,
            year=2026,
            week_number=11,
        )
        self.assertEqual(row["gathering_type"], "MIXED")

    def test_unassigned_evangelism_group(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.eg_unassigned,
            year=2026,
            week_number=12,
            meeting_date=date(2026, 3, 17),
            gathering_type="HYBRID",
            submitted_by=self.admin,
        ).members_attended.add(self.member_b)

        response = self.client.get(
            "/api/evangelism/weekly-reports/tally/",
            {"year": 2026, "week_number": 12},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = self._row_for(
            response.data,
            cluster_id=None,
            year=2026,
            week_number=12,
        )
        self.assertEqual(row["cluster_code"], "Unassigned")
        self.assertEqual(row["cluster_name"], "Unassigned")
        self.assertEqual(row["members_count"], 1)
        self.assertEqual(row["gathering_type"], "HYBRID")

    def test_distinct_people_across_evangelism_groups(self):
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.eg1,
            year=2026,
            week_number=13,
            meeting_date=date(2026, 3, 24),
            gathering_type="PHYSICAL",
            submitted_by=self.admin,
        ).members_attended.add(self.member_a)
        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.eg2,
            year=2026,
            week_number=13,
            meeting_date=date(2026, 3, 25),
            gathering_type="PHYSICAL",
            submitted_by=self.admin,
        ).members_attended.add(self.member_b)

        response = self.client.get(
            "/api/evangelism/weekly-reports/tally/",
            {"year": 2026, "week_number": 13},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = self._row_for(
            response.data,
            cluster_id=self.cluster.id,
            year=2026,
            week_number=13,
        )
        self.assertEqual(row["members_count"], 2)
        self.assertEqual(row["evangelism_reports_count"], 2)

    def test_year_and_cluster_filters(self):
        other_cluster = Cluster.objects.create(
            code="WT-002",
            name="Other Cluster",
            branch=self.branch,
            coordinator=self.coordinator,
        )
        other_eg = EvangelismGroup.objects.create(
            name="Other EG",
            cluster=other_cluster,
            coordinator=self.coordinator,
        )

        EvangelismWeeklyReport.objects.create(
            evangelism_group=self.eg1,
            year=2026,
            week_number=14,
            meeting_date=date(2026, 3, 31),
            gathering_type="PHYSICAL",
            submitted_by=self.admin,
        ).visitors_attended.add(self.visitor)
        EvangelismWeeklyReport.objects.create(
            evangelism_group=other_eg,
            year=2025,
            week_number=14,
            meeting_date=date(2025, 4, 1),
            gathering_type="ONLINE",
            submitted_by=self.admin,
        ).visitors_attended.add(self.visitor)

        by_year = self.client.get(
            "/api/evangelism/weekly-reports/tally/",
            {"year": 2026},
        )
        self.assertEqual(by_year.status_code, status.HTTP_200_OK)
        self.assertTrue(all(row["year"] == 2026 for row in by_year.data))
        self.assertEqual(len(by_year.data), 1)

        by_cluster = self.client.get(
            "/api/evangelism/weekly-reports/tally/",
            {"year": 2026, "cluster": self.cluster.id},
        )
        self.assertEqual(by_cluster.status_code, status.HTTP_200_OK)
        self.assertEqual(len(by_cluster.data), 1)
        self.assertEqual(by_cluster.data[0]["cluster_id"], self.cluster.id)
        self.assertEqual(by_cluster.data[0]["visitors_count"], 1)

    def test_query_count_bounded_with_many_reports(self):
        """N+1 regression: query count must not grow with report count."""
        for week in range(1, 9):
            report = EvangelismWeeklyReport.objects.create(
                evangelism_group=self.eg1,
                year=2026,
                week_number=week,
                meeting_date=date(2026, 1, week),
                gathering_type="PHYSICAL",
                new_prospects=week,
                conversions_this_week=0,
                submitted_by=self.admin,
            )
            report.members_attended.add(self.member_a, self.member_b)
            report.visitors_attended.add(self.visitor)

            cluster_report = ClusterWeeklyReport.objects.create(
                cluster=self.cluster,
                year=2026,
                week_number=week,
                meeting_date=date(2026, 1, week + 1),
                gathering_type="HYBRID",
                submitted_by=self.admin,
            )
            cluster_report.members_attended.add(self.member_a)
            cluster_report.visitors_attended.add(self.visitor)

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(
                "/api/evangelism/weekly-reports/tally/",
                {"year": 2026},
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 8)
        # Auth/session + ~8 aggregation queries; stay well below old N*4 pattern.
        self.assertLessEqual(len(ctx.captured_queries), 20)
