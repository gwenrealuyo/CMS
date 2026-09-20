from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup, EvangelismWeeklyReport
from apps.people.models import Branch, Person


class EvangelismWeeklyReportNewVisitorsTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTNEVV",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="nevadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="nevmember",
            password="pass12345",
            first_name="Mia",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="North Cluster",
            code="NEV-NORTH",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="North Bible Study",
            cluster=self.cluster,
            branch=self.branch,
            coordinator=self.member,
            is_active=True,
        )
        self.group.members.add(self.member)
        self.client.force_authenticate(self.admin)

    def test_create_report_creates_new_visitors_and_links_them(self):
        before = Person.objects.filter(role="VISITOR").count()
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 38,
                "meeting_date": "2026-09-14",
                "gathering_type": "PHYSICAL",
                "members_attended": [self.member.id],
                "visitors_attended": [],
                "new_visitors": [
                    {
                        "first_name": "Vera",
                        "last_name": "Visitor",
                        "inviter_id": self.member.id,
                        "gender": "FEMALE",
                        "note": "Met at park",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Person.objects.filter(role="VISITOR").count(), before + 1)

        report = EvangelismWeeklyReport.objects.get(pk=response.data["id"])
        visitors = list(report.visitors_attended.all())
        self.assertEqual(len(visitors), 1)
        visitor = visitors[0]
        self.assertEqual(visitor.first_name, "Vera")
        self.assertEqual(visitor.last_name, "Visitor")
        self.assertEqual(visitor.role, "VISITOR")
        self.assertEqual(visitor.status, "ONGOING")
        self.assertEqual(visitor.inviter_id, self.member.id)
        self.assertEqual(visitor.branch_id, self.branch.id)
        self.assertEqual(visitor.date_first_attended, date(2026, 9, 14))
        self.assertEqual(
            [v["id"] for v in response.data["visitors_attended_details"]],
            [visitor.id],
        )

    def test_update_report_appends_new_visitors(self):
        existing = Person.objects.create_user(
            username="existvisitor",
            password="pass12345",
            first_name="Eve",
            last_name="Existing",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=2026,
            week_number=38,
            meeting_date=date(2026, 9, 14),
            gathering_type="PHYSICAL",
            submitted_by=self.admin,
        )
        report.visitors_attended.add(existing)

        response = self.client.patch(
            f"/api/evangelism/weekly-reports/{report.id}/",
            {
                "visitors_attended": [existing.id],
                "new_visitors": [
                    {
                        "first_name": "Ned",
                        "last_name": "Newbie",
                        "inviter_id": self.member.id,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        report.refresh_from_db()
        visitor_ids = set(report.visitors_attended.values_list("id", flat=True))
        self.assertIn(existing.id, visitor_ids)
        newbie = Person.objects.get(first_name="Ned", last_name="Newbie", role="VISITOR")
        self.assertIn(newbie.id, visitor_ids)
        self.assertEqual(len(visitor_ids), 2)
