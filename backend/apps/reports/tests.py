from datetime import datetime, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord
from apps.clusters.models import Cluster, ClusterComplianceNote, ClusterWeeklyReport
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.events.models import Event
from apps.people.models import Branch, Family, Person


class ReportsMetaScopeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("reports:reports-meta")

        self.hq = Branch.objects.create(
            name="Headquarters", code="HQ", is_headquarters=True
        )
        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(
            name="South", code="SOUTH", is_active=False
        )

        self.admin = Person.objects.create_user(
            username="admin_meta",
            password="password123",
            role="ADMIN",
            status="ACTIVE",
        )
        self.hq_pastor = Person.objects.create_user(
            username="hq_pastor_meta",
            password="password123",
            role="PASTOR",
            status="ACTIVE",
            branch=self.hq,
        )
        self.branch_pastor = Person.objects.create_user(
            username="branch_pastor_meta",
            password="password123",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_meta",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.coordinator = Person.objects.create_user(
            username="coordinator_meta",
            password="password123",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.visitor = Person.objects.create_user(
            username="visitor_meta",
            password="password123",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

    def test_admin_can_pick_all_active_branches(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["can_pick_branch"])
        self.assertFalse(res.data["branch_locked"])
        self.assertIsNone(res.data["effective_branch_id"])
        branch_ids = {b["id"] for b in res.data["branches"]}
        self.assertIn(self.hq.id, branch_ids)
        self.assertIn(self.north.id, branch_ids)
        # Inactive branches are excluded.
        self.assertNotIn(self.south.id, branch_ids)

    def test_admin_can_filter_to_specific_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url, {"branch_id": self.north.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["can_pick_branch"])
        self.assertEqual(res.data["effective_branch_id"], self.north.id)

    def test_hq_pastor_can_pick_branches(self):
        self.client.force_authenticate(user=self.hq_pastor)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["can_pick_branch"])
        self.assertFalse(res.data["branch_locked"])

    def test_branch_pastor_is_locked_to_own_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["can_pick_branch"])
        self.assertTrue(res.data["branch_locked"])
        self.assertEqual(res.data["effective_branch_id"], self.north.id)
        self.assertEqual(len(res.data["branches"]), 1)
        self.assertEqual(res.data["branches"][0]["id"], self.north.id)

    def test_branch_pastor_cannot_override_branch_param(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(self.url, {"branch_id": self.hq.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["effective_branch_id"], self.north.id)

    def test_member_is_forbidden(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordinator_is_forbidden(self):
        self.client.force_authenticate(user=self.coordinator)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_visitor_is_forbidden(self):
        self.client.force_authenticate(user=self.visitor)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_is_unauthorized(self):
        res = self.client.get(self.url)
        self.assertIn(
            res.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )


class ComplianceReportTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.hq = Branch.objects.create(
            name="Headquarters", code="HQ", is_headquarters=True
        )
        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(name="South", code="SOUTH")

        self.admin = Person.objects.create_user(
            username="admin_comp", password="pw", role="ADMIN", status="ACTIVE"
        )
        self.branch_pastor = Person.objects.create_user(
            username="branch_pastor_comp",
            password="pw",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_comp",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.visitor = Person.objects.create_user(
            username="visitor_comp",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

        self.north_cluster = Cluster.objects.create(
            code="N1", name="North Cluster", branch=self.north
        )
        self.south_cluster = Cluster.objects.create(
            code="S1", name="South Cluster", branch=self.south
        )

        today = timezone.now().date()
        year, week, _ = today.isocalendar()
        ClusterWeeklyReport.objects.create(
            cluster=self.north_cluster,
            year=year,
            week_number=week,
            meeting_date=today,
            gathering_type="PHYSICAL",
        )

    def _codes(self, clusters_rows):
        return {row["cluster"]["code"] for row in clusters_rows}

    def test_admin_sees_all_branches(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(reverse("reports:compliance"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["total_clusters"], 2)
        self.assertEqual(self._codes(res.data["clusters"]), {"N1", "S1"})

    def test_admin_can_filter_by_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            reverse("reports:compliance"), {"branch_id": self.south.id}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self._codes(res.data["clusters"]), {"S1"})

    def test_branch_pastor_scoped_to_own_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(reverse("reports:compliance"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self._codes(res.data["clusters"]), {"N1"})

    def test_branch_pastor_cannot_override_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(
            reverse("reports:compliance"), {"branch_id": self.south.id}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self._codes(res.data["clusters"]), {"N1"})

    def test_overdue_at_risk_history_ok_for_admin(self):
        self.client.force_authenticate(user=self.admin)
        for name in (
            "reports:compliance-overdue",
            "reports:compliance-at-risk",
            "reports:compliance-history",
            "reports:compliance-notes",
        ):
            res = self.client.get(reverse(name))
            self.assertEqual(res.status_code, status.HTTP_200_OK, name)

    def test_history_supports_month_grouping(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            reverse("reports:compliance-history"), {"group_by": "month"}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["group_by"], "month")

    def test_export_csv_returns_csv(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(reverse("reports:compliance-export-csv"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "text/csv")
        self.assertIn("Cluster Code", res.content.decode())

    def test_add_note_in_scope_succeeds(self):
        self.client.force_authenticate(user=self.branch_pastor)
        today = timezone.now().date()
        res = self.client.post(
            reverse("reports:compliance-notes"),
            {
                "cluster_id": self.north_cluster.id,
                "note": "Following up.",
                "period_start": (today - timedelta(days=7)).isoformat(),
                "period_end": today.isoformat(),
            },
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ClusterComplianceNote.objects.count(), 1)

    def test_add_note_out_of_scope_forbidden(self):
        self.client.force_authenticate(user=self.branch_pastor)
        today = timezone.now().date()
        res = self.client.post(
            reverse("reports:compliance-notes"),
            {
                "cluster_id": self.south_cluster.id,
                "note": "Should fail.",
                "period_start": (today - timedelta(days=7)).isoformat(),
                "period_end": today.isoformat(),
            },
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(ClusterComplianceNote.objects.count(), 0)

    def test_notes_list_scoped_to_branch(self):
        today = timezone.now().date()
        ClusterComplianceNote.objects.create(
            cluster=self.south_cluster,
            note="South note",
            period_start=today - timedelta(days=7),
            period_end=today,
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(reverse("reports:compliance-notes"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_forbidden_roles(self):
        for user in (self.member, self.visitor):
            self.client.force_authenticate(user=user)
            for name in (
                "reports:compliance",
                "reports:compliance-overdue",
                "reports:compliance-at-risk",
                "reports:compliance-history",
                "reports:compliance-notes",
                "reports:compliance-export-csv",
            ):
                res = self.client.get(reverse(name))
                self.assertEqual(
                    res.status_code, status.HTTP_403_FORBIDDEN, f"{user.username} {name}"
                )


class PeopleSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.summary_url = reverse("reports:people-summary")
        self.csv_url = reverse("reports:people-export-csv")

        self.hq = Branch.objects.create(
            name="Headquarters", code="HQ", is_headquarters=True
        )
        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(name="South", code="SOUTH")

        self.admin = Person.objects.create_user(
            username="admin_people",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.branch_pastor = Person.objects.create_user(
            username="branch_pastor_people",
            password="pw",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_people",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.visitor = Person.objects.create_user(
            username="visitor_people",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

        today = timezone.now().date()
        self.north_member = Person.objects.create_user(
            username="north_member",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
            gender="MALE",
            date_of_birth=today.replace(year=today.year - 30),
            water_baptism_date=today,
            first_activity_attended="SUNDAY_SERVICE",
        )
        self.north_visitor = Person.objects.create_user(
            username="north_visitor",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
            gender="FEMALE",
        )
        self.south_member = Person.objects.create_user(
            username="south_member",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.south,
            spirit_baptism_date=today,
        )

        self.north_cluster = Cluster.objects.create(
            code="PN1", name="North Cluster", branch=self.north
        )
        self.north_cluster.members.add(self.north_member)

        self.family = Family.objects.create(name="North Family")
        self.family.members.add(self.north_member)

    def test_admin_sees_all_branches(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["total_people"], 6)
        self.assertGreaterEqual(len(res.data["by_branch"]), 2)

    def test_admin_can_filter_by_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"branch_id": self.north.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["total_people"], 5)
        self.assertEqual(res.data["by_branch"], [])

    def test_branch_pastor_scoped_to_own_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["total_people"], 5)
        self.assertEqual(res.data["by_branch"], [])

    def test_branch_pastor_cannot_override_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(self.summary_url, {"branch_id": self.south.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["total_people"], 5)

    def test_kpis_and_structural_counts(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"branch_id": self.north.id})
        summary = res.data["summary"]
        self.assertEqual(summary["total_members"], 2)
        self.assertEqual(summary["total_visitors"], 2)
        self.assertEqual(summary["active_members"], 2)
        self.assertEqual(summary["with_family"], 1)
        self.assertEqual(summary["without_family"], 4)
        self.assertEqual(summary["in_cluster"], 1)
        self.assertEqual(summary["without_cluster"], 4)

    def test_baptism_trend_includes_current_month(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"months": 3})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        today = timezone.now().date()
        period = f"{today.year}-{today.month:02d}"
        water_counts = {
            row["period"]: row["count"] for row in res.data["baptism_trend"]["water"]
        }
        spirit_counts = {
            row["period"]: row["count"] for row in res.data["baptism_trend"]["spirit"]
        }
        self.assertGreaterEqual(water_counts.get(period, 0), 1)
        self.assertGreaterEqual(spirit_counts.get(period, 0), 1)

    def test_export_csv_returns_csv(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.csv_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "text/csv")
        body = res.content.decode()
        self.assertIn("People & Demographics Summary", body)
        self.assertIn("total_people", body)

    def test_forbidden_roles(self):
        for user in (self.member, self.visitor):
            self.client.force_authenticate(user=user)
            for url in (self.summary_url, self.csv_url):
                res = self.client.get(url)
                self.assertEqual(
                    res.status_code,
                    status.HTTP_403_FORBIDDEN,
                    f"{user.username} {url}",
                )


class EngagementSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.summary_url = reverse("reports:engagement-summary")
        self.csv_url = reverse("reports:engagement-export-csv")

        self.hq = Branch.objects.create(
            name="Headquarters", code="HQ", is_headquarters=True
        )
        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(name="South", code="SOUTH")

        self.admin = Person.objects.create_user(
            username="admin_engagement",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.branch_pastor = Person.objects.create_user(
            username="branch_pastor_engagement",
            password="pw",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_engagement",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.visitor = Person.objects.create_user(
            username="visitor_engagement",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

        today = timezone.now().date()
        iso = today.isocalendar()
        self.year = iso[0]
        self.week_number = iso[1]

        self.north_member = Person.objects.create_user(
            username="north_member_eng",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.north_visitor = Person.objects.create_user(
            username="north_visitor_eng",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )
        self.south_member = Person.objects.create_user(
            username="south_member_eng",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.south,
        )

        self.north_cluster = Cluster.objects.create(
            code="EN1", name="North Cluster", branch=self.north
        )
        self.south_cluster = Cluster.objects.create(
            code="ES1", name="South Cluster", branch=self.south
        )

        self.north_cluster_report = ClusterWeeklyReport.objects.create(
            cluster=self.north_cluster,
            year=self.year,
            week_number=self.week_number,
            meeting_date=today,
            gathering_type="PHYSICAL",
        )
        self.north_cluster_report.members_attended.add(self.north_member)
        self.north_cluster_report.visitors_attended.add(self.north_visitor)

        self.south_cluster_report = ClusterWeeklyReport.objects.create(
            cluster=self.south_cluster,
            year=self.year,
            week_number=self.week_number,
            meeting_date=today,
            gathering_type="ONLINE",
        )
        self.south_cluster_report.members_attended.add(self.south_member)

        self.north_group = EvangelismGroup.objects.create(
            name="North Group", cluster=self.north_cluster
        )
        self.south_group = EvangelismGroup.objects.create(
            name="South Group", cluster=self.south_cluster
        )

        self.north_ev_report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.north_group,
            year=self.year,
            week_number=self.week_number,
            meeting_date=today,
            gathering_type="PHYSICAL",
        )
        self.north_ev_report.members_attended.add(self.north_member)

        self.south_ev_report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.south_group,
            year=self.year,
            week_number=self.week_number,
            meeting_date=today,
            gathering_type="PHYSICAL",
        )
        self.south_ev_report.members_attended.add(self.south_member)

        self.north_service = Event.objects.create(
            title="North Sunday Service",
            event_type_id="SUNDAY_SERVICE",
            branch=self.north,
            start_date=timezone.make_aware(
                datetime.combine(today, datetime.min.time())
            ),
            end_date=timezone.make_aware(
                datetime.combine(today, datetime.min.time())
            )
            + timedelta(hours=2),
            location="North Hall",
        )
        self.south_service = Event.objects.create(
            title="South Sunday Service",
            event_type_id="SUNDAY_SERVICE",
            branch=self.south,
            start_date=timezone.make_aware(
                datetime.combine(today, datetime.min.time())
            ),
            end_date=timezone.make_aware(
                datetime.combine(today, datetime.min.time())
            )
            + timedelta(hours=2),
            location="South Hall",
        )

        AttendanceRecord.objects.create(
            event=self.north_service,
            person=self.north_member,
            occurrence_date=today,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
        )
        AttendanceRecord.objects.create(
            event=self.north_service,
            person=self.north_visitor,
            occurrence_date=today,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
        )
        AttendanceRecord.objects.create(
            event=self.south_service,
            person=self.south_member,
            occurrence_date=today,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
        )

    def test_admin_sees_all_branches(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["cluster_reports"], 2)
        self.assertEqual(res.data["summary"]["evangelism_reports"], 2)
        self.assertEqual(res.data["summary"]["service_occurrences"], 2)
        self.assertGreaterEqual(len(res.data["by_branch"]), 2)

    def test_admin_can_filter_by_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"branch_id": self.north.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["cluster_reports"], 1)
        self.assertEqual(res.data["summary"]["evangelism_reports"], 1)
        self.assertEqual(res.data["summary"]["service_occurrences"], 1)
        self.assertEqual(res.data["by_branch"], [])

    def test_branch_pastor_scoped_to_own_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["cluster_reports"], 1)
        self.assertEqual(res.data["by_branch"], [])

    def test_branch_pastor_cannot_override_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(self.summary_url, {"branch_id": self.south.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["cluster_reports"], 1)

    def test_kpis_and_monthly_trends(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"branch_id": self.north.id})
        summary = res.data["summary"]
        self.assertEqual(summary["cluster_avg_members"], 1.0)
        self.assertEqual(summary["cluster_avg_visitors"], 1.0)
        self.assertEqual(summary["evangelism_avg_members"], 1.0)
        self.assertEqual(summary["service_avg_headcount"], 2.0)

        period = f"{self.year}-{timezone.now().date().month:02d}"
        cluster_periods = {
            row["period"] for row in res.data["cluster"]["monthly_trend"]
        }
        self.assertIn(period, cluster_periods)

    def test_export_csv_returns_csv(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.csv_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "text/csv")
        body = res.content.decode()
        self.assertIn("Engagement & Attendance Summary", body)
        self.assertIn("cluster_reports", body)

    def test_forbidden_roles(self):
        for user in (self.member, self.visitor):
            self.client.force_authenticate(user=user)
            for url in (self.summary_url, self.csv_url):
                res = self.client.get(url)
                self.assertEqual(
                    res.status_code,
                    status.HTTP_403_FORBIDDEN,
                    f"{user.username} {url}",
                )
