from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.people.models import Branch, Person


class EvangelismReportCadenceTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTCAD",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="evrcadadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="evrcadmember",
            password="pass12345",
            first_name="Mia",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="Cadence Cluster",
            code="EVR-CAD",
            branch=self.branch,
            is_active=True,
        )
        self.client.force_authenticate(self.admin)

    def _group_payload(self, **overrides):
        payload = {
            "name": "Cadence Bible Study",
            "coordinator_id": self.member.id,
            "cluster_id": self.cluster.id,
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    def _report_payload(self, group_id, meeting_date, **overrides):
        payload = {
            "evangelism_group_id": group_id,
            "meeting_date": meeting_date,
            "gathering_type": "PHYSICAL",
        }
        payload.update(overrides)
        return payload

    def test_group_create_defaults_meeting_frequency_weekly(self):
        response = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["meeting_frequency"], "WEEKLY")
        group = EvangelismGroup.objects.get(pk=response.data["id"])
        self.assertEqual(group.meeting_frequency, EvangelismGroup.MeetingFrequency.WEEKLY)

        detail = self.client.get(f"/api/evangelism/groups/{group.id}/")
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["meeting_frequency"], "WEEKLY")

    def test_group_create_accepts_meeting_frequency(self):
        response = self.client.post(
            "/api/evangelism/groups/",
            self._group_payload(meeting_frequency="MONTHLY"),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["meeting_frequency"], "MONTHLY")

    def test_two_reports_same_week_different_dates_are_allowed(self):
        group = EvangelismGroup.objects.create(
            name="Same Week Group",
            cluster=self.cluster,
            coordinator=self.member,
            is_active=True,
        )
        first = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(group.id, "2026-09-14"),
            format="json",
        )
        second = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(group.id, "2026-09-16"),
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(first.data["year"], 2026)
        self.assertEqual(first.data["week_number"], 38)
        self.assertEqual(second.data["year"], 2026)
        self.assertEqual(second.data["week_number"], 38)
        self.assertEqual(
            EvangelismWeeklyReport.objects.filter(evangelism_group=group).count(),
            2,
        )

    def test_duplicate_meeting_date_returns_409(self):
        group = EvangelismGroup.objects.create(
            name="Duplicate Date Group",
            cluster=self.cluster,
            coordinator=self.member,
            is_active=True,
        )
        first = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(group.id, "2026-09-15"),
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(group.id, "2026-09-15"),
            format="json",
        )
        self.assertEqual(second.status_code, 409, second.data)
        self.assertEqual(second.data.get("error"), "duplicate_meeting_report")

    def test_create_overwrites_client_year_and_week_from_meeting_date(self):
        group = EvangelismGroup.objects.create(
            name="Derived Week Group",
            cluster=self.cluster,
            coordinator=self.member,
            is_active=True,
        )
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            self._report_payload(
                group.id,
                "2026-09-15",
                year=1999,
                week_number=1,
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["year"], 2026)
        self.assertEqual(response.data["week_number"], 38)
        report = EvangelismWeeklyReport.objects.get(pk=response.data["id"])
        self.assertEqual(report.year, 2026)
        self.assertEqual(report.week_number, 38)
        self.assertEqual(report.meeting_date, date(2026, 9, 15))
