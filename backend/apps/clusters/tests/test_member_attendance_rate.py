from datetime import date

from django.test import TestCase
from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.people.models import Branch, Person


ANALYTICS_URL = "/api/clusters/cluster-weekly-reports/analytics/"


class MemberAttendanceRateTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTRATE",
            is_active=True,
        )
        self.cluster = Cluster.objects.create(
            name="East Cluster",
            code="RATE-EAST",
            branch=self.branch,
            is_active=True,
        )

    def _person(self, username, status="ACTIVE", role="MEMBER"):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=username.title(),
            last_name="Test",
            role=role,
            status=status,
            branch=self.branch,
        )

    def _report(self, *, week_number=1, meeting_date=None):
        return ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=week_number,
            meeting_date=meeting_date or date(2026, 1, 7),
            gathering_type="PHYSICAL",
        )

    def test_counts_only_active_semiactive_inactive(self):
        active = self._person("rateactive", "ACTIVE")
        semi = self._person("ratesemi", "SEMIACTIVE")
        inactive = self._person("rateinactive", "INACTIVE")
        dormant = self._person("ratedormant", "DORMANT")
        fallaway = self._person("ratefallaway", "FALLAWAY")
        deceased = self._person("ratedeceased", "DECEASED")
        blank = self._person("rateblank", "")
        self.cluster.members.add(
            active, semi, inactive, dormant, fallaway, deceased, blank
        )

        report = self._report()
        report.members_attended.set([active, dormant, fallaway, deceased, blank])

        # Roster counted: active, semi, inactive (3). Attended counted: active (1).
        self.assertEqual(report.member_attendance_rate, 33.33)

    def test_excludes_admin_even_when_status_is_active(self):
        member = self._person("ratemember", "ACTIVE")
        admin = self._person("rateadmin", "ACTIVE", role="ADMIN")
        self.cluster.members.add(member, admin)

        report = self._report()
        report.members_attended.set([member, admin])

        self.assertEqual(report.member_attendance_rate, 100.0)

    def test_zero_when_no_counted_roster(self):
        dormant = self._person("rateonlydormant", "DORMANT")
        self.cluster.members.add(dormant)

        report = self._report()
        report.members_attended.set([dormant])

        self.assertEqual(report.member_attendance_rate, 0.0)

    def test_caps_at_100_when_attended_exceeds_roster(self):
        on_roster = self._person("rateonroster", "ACTIVE")
        left_cluster = self._person("rateleft", "ACTIVE")
        self.cluster.members.add(on_roster)

        report = self._report()
        report.members_attended.set([on_roster, left_cluster])

        self.assertEqual(report.member_attendance_rate, 100.0)


class MemberAttendanceRateAnalyticsAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTANALRATE",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="analrateadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="East Cluster",
            code="ANAL-EAST",
            branch=self.branch,
            is_active=True,
        )
        self.client.force_authenticate(self.admin)

    def _person(self, username, status="ACTIVE"):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=username.title(),
            last_name="Test",
            role="MEMBER",
            status=status,
            branch=self.branch,
        )

    def test_analytics_average_excludes_non_counted_statuses(self):
        active = self._person("analactive", "ACTIVE")
        semi = self._person("analsemi", "SEMIACTIVE")
        dormant = self._person("analdormant", "DORMANT")
        self.cluster.members.add(active, semi, dormant)

        report = ClusterWeeklyReport.objects.create(
            cluster=self.cluster,
            year=2026,
            week_number=2,
            meeting_date=date(2026, 1, 14),
            gathering_type="PHYSICAL",
        )
        report.members_attended.set([active, dormant])

        response = self.client.get(
            ANALYTICS_URL,
            {"branch_id": self.branch.id, "year": 2026},
        )
        self.assertEqual(response.status_code, 200, response.data)
        # Counted roster: active + semi (2). Counted attended: active (1) → 50%.
        self.assertEqual(response.data["average_member_attendance_rate"], 50.0)
        comparison = response.data["chart_series"]["cluster_comparison"]
        self.assertEqual(len(comparison), 1)
        self.assertEqual(comparison[0]["attendance_rate"], 50.0)
        self.assertEqual(comparison[0]["member_count"], 2)
