from datetime import datetime, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord
from apps.clusters.models import Cluster, ClusterComplianceNote, ClusterWeeklyReport
from apps.evangelism.models import (
    Conversion,
    DropOff,
    EvangelismGroup,
    EvangelismWeeklyReport,
    Prospect,
)
from apps.events.models import Event
from apps.lessons.models import Lesson, LessonSessionReport, PersonLessonProgress
from apps.people.models import Branch, Family, Person
from apps.sunday_school.models import (
    SundaySchoolCategory,
    SundaySchoolClass,
    SundaySchoolClassMember,
)
from apps.finance.models import Donation, Offering, Pledge, PledgeContribution
from decimal import Decimal


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
            first_activity_attended_id="SUNDAY_SERVICE",
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


class V2bSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.summary_url = reverse("reports:v2b-summary")
        self.csv_url = reverse("reports:v2b-export-csv")
        self.year = timezone.now().year

        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(name="South", code="SOUTH")

        self.admin = Person.objects.create_user(
            username="admin_v2b",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.branch_pastor = Person.objects.create_user(
            username="pastor_v2b",
            password="pw",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_v2b",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.visitor = Person.objects.create_user(
            username="visitor_v2b",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

        self.north_inviter = Person.objects.create_user(
            username="north_inviter",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.south_inviter = Person.objects.create_user(
            username="south_inviter",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.south,
        )

        self.north_cluster = Cluster.objects.create(
            code="N-V2B",
            name="North Cluster",
            branch=self.north,
            coordinator=self.north_inviter,
        )
        self.south_cluster = Cluster.objects.create(
            code="S-V2B",
            name="South Cluster",
            branch=self.south,
            coordinator=self.south_inviter,
        )

        self.north_group = EvangelismGroup.objects.create(
            name="North Group",
            cluster=self.north_cluster,
            coordinator=self.north_inviter,
            is_active=True,
        )

        self.north_invited = Prospect.objects.create(
            first_name="North",
            last_name="Invited",
            invited_by=self.north_inviter,
            inviter_cluster=self.north_cluster,
            evangelism_group=self.north_group,
            pipeline_stage=Prospect.PipelineStage.INVITED,
            is_dropped_off=False,
        )
        self.north_attended = Prospect.objects.create(
            first_name="North",
            last_name="Attended",
            invited_by=self.north_inviter,
            inviter_cluster=self.north_cluster,
            evangelism_group=self.north_group,
            pipeline_stage=Prospect.PipelineStage.ATTENDED,
            is_dropped_off=False,
        )
        self.north_attended_person = Person.objects.create_user(
            username="north_attended_person",
            password="pw",
            role="VISITOR",
            status="ATTENDED",
            branch=self.north,
        )
        self.north_attended.person = self.north_attended_person
        self.north_attended.save(update_fields=["person"])

        self.ncc_lesson = Lesson.objects.create(
            code="v2b-l1",
            version_label="v1",
            title="Lesson One",
            order=1,
            is_latest=True,
            is_active=True,
        )
        self.ncc_session_date = timezone.now().date().replace(
            year=self.year, month=6, day=15
        )
        LessonSessionReport.objects.create(
            teacher=self.north_inviter,
            student=self.north_attended_person,
            lesson=self.ncc_lesson,
            session_date=self.ncc_session_date,
            session_start=timezone.make_aware(
                datetime.combine(self.ncc_session_date, datetime.min.time())
            ),
        )
        self.south_converted = Prospect.objects.create(
            first_name="South",
            last_name="Converted",
            invited_by=self.south_inviter,
            inviter_cluster=self.south_cluster,
            pipeline_stage=Prospect.PipelineStage.REACHED,
            is_dropped_off=False,
        )

        self.dropped_north = Prospect.objects.create(
            first_name="North",
            last_name="Dropped",
            invited_by=self.north_inviter,
            inviter_cluster=self.north_cluster,
            evangelism_group=self.north_group,
            pipeline_stage=Prospect.PipelineStage.INVITED,
            is_dropped_off=True,
        )
        DropOff.objects.create(
            prospect=self.dropped_north,
            drop_off_date=timezone.now().date(),
            drop_off_stage=Prospect.PipelineStage.INVITED,
            days_inactive=35,
            reason=DropOff.DropOffReason.NO_CONTACT,
        )

        self.reached_north = Person.objects.create_user(
            username="reached_north",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
            water_baptism_date=timezone.now().date().replace(year=self.year, month=3, day=1),
            spirit_baptism_date=timezone.now().date().replace(year=self.year, month=4, day=1),
        )

        conv_person = Person.objects.create_user(
            username="conv_north",
            password="pw",
            role="VISITOR",
            status="ATTENDED",
            branch=self.north,
        )
        Conversion.objects.create(
            person=conv_person,
            converted_by=self.north_inviter,
            cluster=self.north_cluster,
            conversion_date=timezone.now().date().replace(year=self.year, month=5, day=1),
            water_baptism_date=timezone.now().date().replace(year=self.year, month=5, day=1),
            spirit_baptism_date=timezone.now().date().replace(year=self.year, month=5, day=15),
            is_complete=True,
        )

    def test_admin_sees_all_branches(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"year": self.year})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data["summary"]["active_prospects"], 3)
        self.assertEqual(len(res.data["monthly_trend"]), 12)
        self.assertGreater(len(res.data["by_cluster"]), 0)

    def test_admin_can_filter_by_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            self.summary_url,
            {"branch_id": self.north.id, "year": self.year},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["active_prospects"], 2)
        self.assertEqual(res.data["by_cluster"], [])

    def test_funnel_cumulative_counts(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            self.summary_url,
            {"branch_id": self.north.id, "year": self.year},
        )
        funnel = {row["stage"]: row["count"] for row in res.data["funnel"]}
        self.assertEqual(funnel["INVITED"], 2)
        self.assertEqual(funnel["ATTENDED"], 1)
        self.assertEqual(funnel["TAKEN_NCC"], 1)

    def test_monthly_taken_ncc_count(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            self.summary_url,
            {"branch_id": self.north.id, "year": self.year},
        )
        june = next(
            row for row in res.data["monthly_trend"] if row["month"] == 6
        )
        self.assertEqual(june["taken_ncc_count"], 1)
        january = next(
            row for row in res.data["monthly_trend"] if row["month"] == 1
        )
        self.assertEqual(january["taken_ncc_count"], 0)

    def test_leakage_populated(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            self.summary_url,
            {"branch_id": self.north.id, "year": self.year},
        )
        self.assertGreaterEqual(res.data["summary"]["drop_offs"], 1)
        self.assertGreater(len(res.data["leakage"]["by_stage"]), 0)

    def test_branch_pastor_scoped(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(
            self.summary_url,
            {"branch_id": self.south.id, "year": self.year},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["active_prospects"], 2)

    def test_export_csv(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.csv_url, {"year": self.year})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("Visitor to Brethren Summary", res.content.decode())

    def test_forbidden_roles(self):
        for user in (self.member, self.visitor):
            self.client.force_authenticate(user=user)
            res = self.client.get(self.summary_url)
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class NccSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.summary_url = reverse("reports:ncc-summary")
        self.csv_url = reverse("reports:ncc-export-csv")

        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(name="South", code="SOUTH")

        self.admin = Person.objects.create_user(
            username="admin_ncc",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.branch_pastor = Person.objects.create_user(
            username="pastor_ncc",
            password="pw",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_ncc",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.visitor = Person.objects.create_user(
            username="visitor_ncc",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

        self.lesson = Lesson.objects.create(
            code="L1",
            version_label="v1",
            title="Lesson One",
            order=1,
            is_latest=True,
            is_active=True,
        )

        self.north_student = Person.objects.create_user(
            username="north_student_ncc",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )
        self.south_student = Person.objects.create_user(
            username="south_student_ncc",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.south,
        )
        self.unassigned_north_visitor = Person.objects.create_user(
            username="unassigned_north",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

        PersonLessonProgress.objects.create(
            person=self.north_student,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.COMPLETED,
        )
        PersonLessonProgress.objects.create(
            person=self.south_student,
            lesson=self.lesson,
            status=PersonLessonProgress.Status.IN_PROGRESS,
        )

    def test_admin_sees_all_branches(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data["total_participants"], 2)
        self.assertGreaterEqual(res.data["unassigned_visitors"], 1)

    def test_admin_can_filter_by_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"branch_id": self.north.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_participants"], 1)
        self.assertGreaterEqual(res.data["unassigned_visitors"], 1)

    def test_branch_pastor_scoped(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(self.summary_url, {"branch_id": self.south.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_participants"], 1)

    def test_export_csv(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.csv_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("New Converts Course Summary", res.content.decode())

    def test_forbidden_roles(self):
        for user in (self.member, self.visitor):
            self.client.force_authenticate(user=user)
            res = self.client.get(self.summary_url)
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class CymSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.summary_url = reverse("reports:cym-summary")
        self.csv_url = reverse("reports:cym-export-csv")

        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(name="South", code="SOUTH")

        self.admin = Person.objects.create_user(
            username="admin_cym",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.branch_pastor = Person.objects.create_user(
            username="pastor_cym",
            password="pw",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_cym",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )

        self.category = SundaySchoolCategory.objects.create(
            name="Kids",
            min_age=5,
            max_age=12,
            order=1,
        )
        self.north_class = SundaySchoolClass.objects.create(
            name="North Kids",
            category=self.category,
            is_active=True,
        )
        self.south_class = SundaySchoolClass.objects.create(
            name="South Kids",
            category=self.category,
            is_active=True,
        )

        self.north_student = Person.objects.create_user(
            username="north_cym_student",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
            date_of_birth=timezone.now().date().replace(year=2015),
        )
        self.south_student = Person.objects.create_user(
            username="south_cym_student",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.south,
            date_of_birth=timezone.now().date().replace(year=2016),
        )

        SundaySchoolClassMember.objects.create(
            sunday_school_class=self.north_class,
            person=self.north_student,
            role=SundaySchoolClassMember.Role.STUDENT,
        )
        SundaySchoolClassMember.objects.create(
            sunday_school_class=self.south_class,
            person=self.south_student,
            role=SundaySchoolClassMember.Role.STUDENT,
        )

    def test_admin_sees_all_students(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_students"], 2)
        self.assertGreaterEqual(len(res.data["by_class"]), 2)

    def test_admin_can_filter_by_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"branch_id": self.north.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_students"], 1)

    def test_branch_pastor_scoped(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(self.summary_url, {"branch_id": self.south.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_students"], 1)

    def test_month_scoped_request(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now().date()
        res = self.client.get(
            self.summary_url,
            {"year": now.year, "month": now.month},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_export_csv(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.csv_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("Children Youth Ministry Summary", res.content.decode())

    def test_forbidden_roles(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.get(self.summary_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


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


class OverviewSummaryTests(TestCase):
    EXPECTED_TABS = (
        "people",
        "v2b",
        "engagement",
        "ncc",
        "cym",
        "compliance",
        "stewardship",
    )

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("reports:overview-summary")

        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(name="South", code="SOUTH")

        self.admin = Person.objects.create_user(
            username="admin_overview",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.branch_pastor = Person.objects.create_user(
            username="pastor_overview",
            password="pw",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_overview",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.visitor = Person.objects.create_user(
            username="visitor_overview",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

        Person.objects.create_user(
            username="north_member_ov",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        Person.objects.create_user(
            username="south_member_ov",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.south,
        )

        Cluster.objects.create(
            name="North Cluster",
            code="N1",
            branch=self.north,
            coordinator=self.branch_pastor,
        )

    def _module_tabs(self, data):
        return [m["tab"] for m in data["modules"]]

    def test_admin_payload_shape(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("year", res.data)
        self.assertIn("months", res.data)
        self.assertEqual(len(res.data["modules"]), 7)
        self.assertEqual(tuple(self._module_tabs(res.data)), self.EXPECTED_TABS)

        people_mod = res.data["modules"][0]
        self.assertEqual(people_mod["tab"], "people")
        self.assertEqual(people_mod["headline"]["label"], "Total People")
        self.assertGreaterEqual(people_mod["headline"]["value"], 2)

    def test_admin_can_filter_by_branch(self):
        self.client.force_authenticate(user=self.admin)
        all_res = self.client.get(self.url)
        north_res = self.client.get(self.url, {"branch_id": self.north.id})
        south_res = self.client.get(self.url, {"branch_id": self.south.id})
        self.assertEqual(north_res.status_code, status.HTTP_200_OK)
        people_all = next(
            m for m in all_res.data["modules"] if m["tab"] == "people"
        )["headline"]["value"]
        people_north = next(
            m for m in north_res.data["modules"] if m["tab"] == "people"
        )["headline"]["value"]
        people_south = next(
            m for m in south_res.data["modules"] if m["tab"] == "people"
        )["headline"]["value"]
        self.assertGreater(people_all, people_north)
        self.assertGreater(people_north, people_south)

    def test_branch_pastor_scoped_to_own_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        pastor_res = self.client.get(self.url)
        self.client.force_authenticate(user=self.admin)
        north_res = self.client.get(self.url, {"branch_id": self.north.id})
        self.assertEqual(pastor_res.status_code, status.HTTP_200_OK)
        pastor_people = next(
            m for m in pastor_res.data["modules"] if m["tab"] == "people"
        )["headline"]["value"]
        north_people = next(
            m for m in north_res.data["modules"] if m["tab"] == "people"
        )["headline"]["value"]
        self.assertEqual(pastor_people, north_people)

    def test_branch_pastor_cannot_override_branch(self):
        self.client.force_authenticate(user=self.branch_pastor)
        default_res = self.client.get(self.url)
        override_res = self.client.get(self.url, {"branch_id": self.south.id})
        self.assertEqual(override_res.status_code, status.HTTP_200_OK)
        default_people = next(
            m for m in default_res.data["modules"] if m["tab"] == "people"
        )["headline"]["value"]
        override_people = next(
            m for m in override_res.data["modules"] if m["tab"] == "people"
        )["headline"]["value"]
        self.assertEqual(default_people, override_people)

    def test_respects_year_and_months_params(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url, {"year": 2020, "months": 6})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["year"], 2020)
        self.assertEqual(res.data["months"], 6)

    def test_forbidden_roles(self):
        for user in (self.member, self.visitor):
            self.client.force_authenticate(user=user)
            res = self.client.get(self.url)
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class StewardshipSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.summary_url = reverse("reports:stewardship-summary")
        self.csv_url = reverse("reports:stewardship-export-csv")
        self.year = timezone.now().year

        self.north = Branch.objects.create(name="North", code="NORTH")
        self.south = Branch.objects.create(name="South", code="SOUTH")

        self.admin = Person.objects.create_user(
            username="admin_steward",
            password="pw",
            role="ADMIN",
            status="ACTIVE",
        )
        self.branch_pastor = Person.objects.create_user(
            username="pastor_steward",
            password="pw",
            role="PASTOR",
            status="ACTIVE",
            branch=self.north,
        )
        self.member = Person.objects.create_user(
            username="member_steward",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.visitor = Person.objects.create_user(
            username="visitor_steward",
            password="pw",
            role="VISITOR",
            status="INVITED",
            branch=self.north,
        )

        self.north_donor = Person.objects.create_user(
            username="north_donor",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.north,
        )
        self.south_donor = Person.objects.create_user(
            username="south_donor",
            password="pw",
            role="MEMBER",
            status="ACTIVE",
            branch=self.south,
        )

        donation_date = timezone.now().date().replace(year=self.year, month=3, day=10)
        Donation.objects.create(
            donor=self.north_donor,
            amount=Decimal("100.00"),
            date=donation_date,
            purpose="Building Fund",
            receipt_number="STEW-N-001",
        )
        Donation.objects.create(
            donor=self.south_donor,
            amount=Decimal("200.00"),
            date=donation_date,
            purpose="Missions",
            receipt_number="STEW-S-001",
        )

        Offering.objects.create(
            service_date=donation_date,
            service_name="Sunday AM",
            amount=Decimal("500.00"),
        )

        self.north_pledge = Pledge.objects.create(
            pledger=self.north_donor,
            pledge_title="North Building",
            pledge_amount=Decimal("1000.00"),
            status=Pledge.Status.ACTIVE,
        )
        self.south_pledge = Pledge.objects.create(
            pledger=self.south_donor,
            pledge_title="South Missions",
            pledge_amount=Decimal("2000.00"),
            status=Pledge.Status.ACTIVE,
        )
        PledgeContribution.objects.create(
            pledge=self.north_pledge,
            contributor=self.north_donor,
            amount=Decimal("250.00"),
            contribution_date=donation_date,
        )
        PledgeContribution.objects.create(
            pledge=self.south_pledge,
            contributor=self.south_donor,
            amount=Decimal("400.00"),
            contribution_date=donation_date,
        )

    def test_admin_sees_all_branches(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"year": self.year})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        summary = res.data["summary"]
        self.assertTrue(summary["includes_offerings"])
        self.assertEqual(summary["donation_total"], 300.0)
        self.assertEqual(summary["offering_total"], 500.0)
        self.assertGreater(summary["total_collected"], 0)
        self.assertEqual(len(res.data["monthly_trend"]), 12)
        self.assertGreater(len(res.data["offerings_weekly"]), 0)
        self.assertGreater(len(res.data["pledges"]), 0)
        self.assertIn("Building Fund", res.data["donations"]["purpose_breakdown"])

    def test_admin_can_filter_by_branch(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(
            self.summary_url,
            {"branch_id": self.north.id, "year": self.year},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        summary = res.data["summary"]
        self.assertFalse(summary["includes_offerings"])
        self.assertEqual(summary["donation_total"], 100.0)
        self.assertEqual(summary["offering_total"], 0.0)
        self.assertEqual(res.data["offerings_weekly"], [])
        pledge_titles = [row["pledge_title"] for row in res.data["pledges"]]
        self.assertIn("North Building", pledge_titles)
        self.assertNotIn("South Missions", pledge_titles)

    def test_branch_pastor_scoped(self):
        self.client.force_authenticate(user=self.branch_pastor)
        res = self.client.get(
            self.summary_url,
            {"branch_id": self.south.id, "year": self.year},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["summary"]["donation_total"], 100.0)

    def test_monthly_trend_has_twelve_rows(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.summary_url, {"year": self.year})
        self.assertEqual(len(res.data["monthly_trend"]), 12)
        march = next(
            row for row in res.data["monthly_trend"] if row["month"] == 3
        )
        self.assertEqual(march["donation_total"], 300.0)
        self.assertEqual(march["offering_total"], 500.0)

    def test_export_csv(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.csv_url, {"year": self.year})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("Stewardship Summary", res.content.decode())

    def test_forbidden_roles(self):
        for user in (self.member, self.visitor):
            self.client.force_authenticate(user=user)
            res = self.client.get(self.summary_url)
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
