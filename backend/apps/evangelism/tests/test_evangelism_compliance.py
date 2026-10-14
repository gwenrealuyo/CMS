from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.people.models import Branch, ModuleCoordinator, Person
from core.datetime_utils import church_today

COMPLIANCE_URL = "/api/evangelism/weekly-reports/compliance/"
CSV_URL = "/api/evangelism/weekly-reports/compliance_export_csv/"


class EvangelismComplianceAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTCOMP",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Other",
            code="OTHRCOMP",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="evcompadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="evcompmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        self.coordinator = Person.objects.create_user(
            username="evcompcoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        self.cluster_senior = Person.objects.create_user(
            username="evcompclsenior",
            password="pass12345",
            first_name="Carl",
            last_name="Senior",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        ModuleCoordinator.objects.create(
            person=self.cluster_senior,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )

        self.cluster_none = Cluster.objects.create(
            name="No Group",
            code="COMP-NONE",
            branch=self.branch,
            is_active=True,
        )
        self.cluster_partial = Cluster.objects.create(
            name="Partial",
            code="COMP-PART",
            branch=self.branch,
            is_active=True,
        )
        self.cluster_double = Cluster.objects.create(
            name="Double",
            code="COMP-DBL",
            branch=self.branch,
            is_active=True,
        )
        self.cluster_pending = Cluster.objects.create(
            name="Pending Only",
            code="COMP-PEND",
            branch=self.branch,
            is_active=True,
        )
        self.cluster_inactive = Cluster.objects.create(
            name="Inactive Only",
            code="COMP-INACT",
            branch=self.branch,
            is_active=True,
        )
        self.other_cluster = Cluster.objects.create(
            name="Other Branch",
            code="COMP-OTH",
            branch=self.other_branch,
            is_active=True,
        )

        partial_group = EvangelismGroup.objects.create(
            name="Partial BS",
            cluster=self.cluster_partial,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        double_a = EvangelismGroup.objects.create(
            name="Double A",
            cluster=self.cluster_double,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        double_b = EvangelismGroup.objects.create(
            name="Double B",
            cluster=self.cluster_double,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        EvangelismGroup.objects.create(
            name="Pending BS",
            cluster=self.cluster_pending,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.PENDING,
        )
        EvangelismGroup.objects.create(
            name="Inactive BS",
            cluster=self.cluster_inactive,
            branch=self.branch,
            is_active=False,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )

        self._report(partial_group, date(2026, 1, 5), 2026, 2)
        self._report(double_a, date(2026, 1, 5), 2026, 2)
        self._report(double_b, date(2026, 1, 5), 2026, 2)
        self._report(double_a, date(2026, 1, 12), 2026, 3)
        self._report(partial_group, date(2025, 12, 1), 2025, 49)

    def _report(self, group, meeting_date, year, week_number):
        return EvangelismWeeklyReport.objects.create(
            evangelism_group=group,
            year=year,
            week_number=week_number,
            meeting_date=meeting_date,
            gathering_type="PHYSICAL",
        )

    def _get(self, user, **params):
        self.client.force_authenticate(user)
        return self.client.get(COMPLIANCE_URL, params)

    def test_compliance_rates_and_missing_group(self):
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-12",
            branch_id=self.branch.id,
        )
        self.assertEqual(response.status_code, 200)
        summary = response.data["summary"]
        self.assertEqual(summary["total_clusters"], 5)
        self.assertEqual(summary["clusters_with_group"], 2)
        self.assertEqual(summary["clusters_without_group"], 3)
        self.assertEqual(summary["setup_coverage_rate"], 40.0)
        self.assertEqual(summary["report_compliance_rate"], 75.0)
        self.assertEqual(summary["compliant_clusters"], 1)
        self.assertEqual(summary["partial_clusters"], 1)
        self.assertEqual(summary["non_compliant_clusters"], 0)

        by_code = {row["cluster"]["code"]: row for row in response.data["clusters"]}
        self.assertEqual(by_code["COMP-NONE"]["status"], "NO_GROUP")
        self.assertIsNone(by_code["COMP-NONE"]["compliance_rate"])
        self.assertEqual(by_code["COMP-PEND"]["status"], "NO_GROUP")
        self.assertEqual(by_code["COMP-INACT"]["status"], "NO_GROUP")

        partial = by_code["COMP-PART"]
        self.assertEqual(partial["status"], "PARTIAL")
        self.assertEqual(partial["reports_submitted"], 1)
        self.assertEqual(partial["reports_expected"], 2)
        self.assertEqual(partial["compliance_rate"], 50.0)
        self.assertEqual([group["name"] for group in partial["groups"]], ["Partial BS"])

        doubled = by_code["COMP-DBL"]
        self.assertEqual(doubled["status"], "COMPLIANT")
        self.assertEqual(doubled["reports_submitted"], 2)
        self.assertEqual(doubled["reports_expected"], 2)
        self.assertEqual(doubled["compliance_rate"], 100.0)
        self.assertEqual(
            [group["name"] for group in doubled["groups"]],
            ["Double A", "Double B"],
        )

    def test_same_week_from_two_groups_counts_once(self):
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-05",
            branch_id=self.branch.id,
        )
        doubled = next(
            row
            for row in response.data["clusters"]
            if row["cluster"]["code"] == "COMP-DBL"
        )
        self.assertEqual(doubled["reports_submitted"], 1)
        self.assertEqual(doubled["reports_expected"], 1)
        self.assertEqual(doubled["compliance_rate"], 100.0)

    def test_status_filter_does_not_change_summary(self):
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-12",
            branch_id=self.branch.id,
            status="NO_GROUP",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["total_clusters"], 5)
        self.assertEqual(len(response.data["clusters"]), 3)
        self.assertTrue(
            all(row["status"] == "NO_GROUP" for row in response.data["clusters"])
        )

    def test_non_senior_is_forbidden(self):
        for user in (self.member, self.coordinator):
            response = self._get(
                user,
                start_date="2026-01-05",
                end_date="2026-01-12",
            )
            self.assertEqual(response.status_code, 403, user.username)
            self.assertIn("compliance", response.data["error"])

    def test_cluster_senior_is_locked_to_own_branch(self):
        response = self._get(
            self.cluster_senior,
            start_date="2026-01-05",
            end_date="2026-01-12",
            branch_id=self.other_branch.id,
        )
        self.assertEqual(response.status_code, 200, response.content)
        codes = {row["cluster"]["code"] for row in response.data["clusters"]}
        self.assertIn("COMP-NONE", codes)
        self.assertNotIn("COMP-OTH", codes)

    def test_week_filter_keeps_latest_report_outside_selection(self):
        response = self._get(
            self.admin,
            year=2026,
            week_number="3",
            branch_id=self.branch.id,
        )
        self.assertEqual(response.status_code, 200, response.content)
        by_code = {row["cluster"]["code"]: row for row in response.data["clusters"]}

        partial = by_code["COMP-PART"]
        self.assertEqual(partial["reports_submitted"], 0)
        self.assertEqual(partial["reports_expected"], 1)
        self.assertEqual(partial["status"], "NON_COMPLIANT")
        self.assertEqual(partial["last_report_date"], "2026-01-05")
        self.assertEqual(
            partial["days_since_last_report"],
            (church_today() - date(2026, 1, 5)).days,
        )

        doubled = by_code["COMP-DBL"]
        self.assertEqual(doubled["reports_submitted"], 1)
        self.assertEqual(doubled["reports_expected"], 1)
        self.assertEqual(doubled["status"], "COMPLIANT")
        self.assertEqual(doubled["last_report_date"], "2026-01-12")

    def test_invalid_week_number_is_rejected(self):
        response = self._get(
            self.admin,
            year=2026,
            week_number="99",
            branch_id=self.branch.id,
        )
        self.assertEqual(response.status_code, 400, response.content)

    def test_csv_export(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            CSV_URL,
            {
                "start_date": "2026-01-05",
                "end_date": "2026-01-12",
                "branch_id": self.branch.id,
                "status": "NO_GROUP",
            },
        )
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn("Cluster Code", body)
        self.assertIn("COMP-NONE", body)
        self.assertIn("No group", body)
        self.assertNotIn("COMP-PART", body)

    def _cancel(self, group, meeting_date, year, week_number):
        return EvangelismWeeklyReport.objects.create(
            evangelism_group=group,
            year=year,
            week_number=week_number,
            meeting_date=meeting_date,
            cancelled=True,
            cancellation_reason="Storm",
            gathering_type=None,
        )

    def test_cancelled_week_does_not_lower_compliance(self):
        group = EvangelismGroup.objects.get(name="Partial BS")
        self._cancel(group, date(2026, 1, 12), 2026, 3)
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-12",
            branch_id=self.branch.id,
        )
        self.assertEqual(response.status_code, 200, response.data)
        partial = next(
            row
            for row in response.data["clusters"]
            if row["cluster"]["code"] == "COMP-PART"
        )
        self.assertEqual(partial["reports_expected"], 1)
        self.assertEqual(partial["reports_submitted"], 1)
        self.assertEqual(partial["missing_weeks"], [])
        self.assertEqual(
            partial["cancelled_weeks"],
            [{"week": 3, "reason": "Storm", "group": "Partial BS"}],
        )
        self.assertEqual(partial["status"], "COMPLIANT")
        self.assertEqual(partial["compliance_rate"], 100.0)

    def test_only_cancelled_weeks_stay_compliant(self):
        cluster = Cluster.objects.create(
            name="Cancel Only",
            code="COMP-CAN",
            branch=self.branch,
            is_active=True,
        )
        group = EvangelismGroup.objects.create(
            name="Cancel BS",
            cluster=cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self._cancel(group, date(2026, 1, 5), 2026, 2)
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-05",
            branch_id=self.branch.id,
        )
        row = next(
            item
            for item in response.data["clusters"]
            if item["cluster"]["code"] == "COMP-CAN"
        )
        self.assertEqual(row["reports_expected"], 0)
        self.assertEqual(row["reports_submitted"], 0)
        self.assertEqual(row["missing_weeks"], [])
        self.assertEqual(
            row["cancelled_weeks"],
            [{"week": 2, "reason": "Storm", "group": "Cancel BS"}],
        )
        self.assertEqual(row["status"], "COMPLIANT")
        self.assertEqual(row["compliance_rate"], 100.0)
        self.assertEqual(row["last_report_date"], "2026-01-05")

    def test_missing_week_beside_cancellation_stays_missing(self):
        cluster = Cluster.objects.create(
            name="Cancel Gap",
            code="COMP-GAP",
            branch=self.branch,
            is_active=True,
        )
        group = EvangelismGroup.objects.create(
            name="Gap BS",
            cluster=cluster,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
        )
        self._cancel(group, date(2026, 1, 5), 2026, 2)
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-12",
            branch_id=self.branch.id,
        )
        row = next(
            item
            for item in response.data["clusters"]
            if item["cluster"]["code"] == "COMP-GAP"
        )
        self.assertEqual(row["reports_expected"], 1)
        self.assertEqual(row["reports_submitted"], 0)
        self.assertEqual(row["missing_weeks"], [3])
        self.assertEqual(row["status"], "NON_COMPLIANT")

    def test_held_report_from_another_group_still_counts(self):
        group_a = EvangelismGroup.objects.get(name="Double A")
        self._cancel(group_a, date(2026, 1, 6), 2026, 2)
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-05",
            branch_id=self.branch.id,
        )
        doubled = next(
            row
            for row in response.data["clusters"]
            if row["cluster"]["code"] == "COMP-DBL"
        )
        self.assertEqual(doubled["reports_expected"], 1)
        self.assertEqual(doubled["reports_submitted"], 1)
        self.assertEqual(doubled["cancelled_weeks"], [])
        self.assertEqual(doubled["status"], "COMPLIANT")

    def _unclustered(self, name, frequency):
        return EvangelismGroup.objects.create(
            name=name,
            cluster=None,
            branch=self.branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
            meeting_frequency=frequency,
        )

    def _row_named(self, response, name):
        return next(
            row
            for row in response.data["clusters"]
            if row["cluster"]["name"] == name
        )

    def test_unclustered_weekly_group_is_still_expected(self):
        Frequency = EvangelismGroup.MeetingFrequency
        self._unclustered("Street Weekly", Frequency.WEEKLY)
        self._unclustered("Whenever", Frequency.IRREGULAR)
        EvangelismGroup.objects.create(
            name="Other Branch Weekly",
            cluster=None,
            branch=self.other_branch,
            is_active=True,
            approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
            meeting_frequency=Frequency.WEEKLY,
        )
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-12",
            branch_id=self.branch.id,
        )
        names = [row["cluster"]["name"] for row in response.data["clusters"]]
        self.assertIn("Street Weekly", names)
        self.assertNotIn("Whenever", names)
        self.assertNotIn("Other Branch Weekly", names)
        row = self._row_named(response, "Street Weekly")
        self.assertEqual(row["cluster"]["code"], "No cluster")
        self.assertEqual(row["groups"], [{"id": row["groups"][0]["id"], "name": "Weekly"}])
        self.assertEqual(row["reports_expected"], 2)
        self.assertEqual(row["reports_submitted"], 0)
        self.assertEqual(row["missing_weeks"], [2, 3])
        self.assertEqual(row["status"], "NON_COMPLIANT")
        self.assertEqual(response.data["summary"]["total_clusters"], 5)
        self.assertGreaterEqual(
            response.data["summary"]["non_compliant_clusters"], 1
        )

    def test_unclustered_cancellation_excuses_only_that_group(self):
        Frequency = EvangelismGroup.MeetingFrequency
        cancelled = self._unclustered("Cancelled Street", Frequency.WEEKLY)
        self._unclustered("Still Meeting", Frequency.WEEKLY)
        self._cancel(cancelled, date(2026, 1, 5), 2026, 2)
        response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-11",
            branch_id=self.branch.id,
        )
        excused = self._row_named(response, "Cancelled Street")
        self.assertEqual(excused["reports_expected"], 0)
        self.assertEqual(excused["reports_submitted"], 0)
        self.assertEqual(excused["status"], "COMPLIANT")
        self.assertEqual(excused["last_report_date"], "2026-01-05")
        self.assertEqual(
            excused["cancelled_weeks"],
            [{"week": 2, "reason": "Storm", "group": None}],
        )
        still = self._row_named(response, "Still Meeting")
        self.assertEqual(still["reports_expected"], 1)
        self.assertEqual(still["reports_submitted"], 0)
        self.assertEqual(still["missing_weeks"], [2])
        self.assertEqual(still["cancelled_weeks"], [])
        self.assertEqual(still["status"], "NON_COMPLIANT")

    def test_unclustered_biweekly_and_monthly_follow_frequency(self):
        Frequency = EvangelismGroup.MeetingFrequency
        biweekly = self._unclustered("Every Other", Frequency.BIWEEKLY)
        monthly = self._unclustered("Once a Month", Frequency.MONTHLY)
        self._report(biweekly, date(2026, 1, 5), 2026, 2)
        self._report(monthly, date(2026, 1, 20), 2026, 4)
        biweekly_response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-02-01",
            branch_id=self.branch.id,
        )
        every_other = self._row_named(biweekly_response, "Every Other")
        self.assertEqual(every_other["groups"][0]["name"], "Biweekly")
        self.assertEqual(every_other["reports_expected"], 2)
        self.assertEqual(every_other["reports_submitted"], 1)
        self.assertEqual(every_other["missing_weeks"], [4])
        self.assertEqual(every_other["status"], "PARTIAL")
        monthly_response = self._get(
            self.admin,
            start_date="2026-01-05",
            end_date="2026-01-18",
            branch_id=self.branch.id,
        )
        once = self._row_named(monthly_response, "Once a Month")
        self.assertEqual(once["groups"][0]["name"], "Monthly")
        self.assertEqual(once["reports_expected"], 1)
        self.assertEqual(once["reports_submitted"], 1)
        self.assertEqual(once["status"], "COMPLIANT")
