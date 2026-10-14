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
            water_baptism_date=date(2020, 1, 1),
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

    def test_update_keeps_members_who_later_left_the_group(self):
        self.member.water_baptism_date = date(2020, 1, 1)
        self.member.role = "MEMBER"
        self.member.status = "ACTIVE"
        self.member.save()
        former = Person.objects.create_user(
            username="former-member",
            password="pass12345",
            first_name="Fran",
            last_name="Former",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
            branch=self.branch,
        )
        outsider = Person.objects.create_user(
            username="outsider-member",
            password="pass12345",
            first_name="Otto",
            last_name="Outsider",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
            branch=self.branch,
        )
        self.group.members.add(self.member, former)
        report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=2026,
            week_number=41,
            meeting_date=date(2026, 10, 10),
            gathering_type="PHYSICAL",
            submitted_by=self.admin,
        )
        report.members_attended.set([self.member, former])
        self.group.members.remove(former)

        kept = self.client.patch(
            f"/api/evangelism/weekly-reports/{report.id}/",
            {
                "topic": "The Word of God is our Guide",
                "members_attended": [self.member.id, former.id],
            },
            format="json",
        )
        self.assertEqual(kept.status_code, 200, kept.data)
        self.assertEqual(
            set(kept.data["members_attended"]),
            {self.member.id, former.id},
        )

        sat_in = self.client.patch(
            f"/api/evangelism/weekly-reports/{report.id}/",
            {"members_attended": [self.member.id, former.id, outsider.id]},
            format="json",
        )
        self.assertEqual(sat_in.status_code, 200, sat_in.data)
        self.assertEqual(
            set(sat_in.data["members_attended"]),
            {self.member.id, former.id, outsider.id},
        )
        self.group.refresh_from_db()
        self.assertNotIn(
            outsider.id,
            set(self.group.members.values_list("id", flat=True)),
        )
        self.assertNotIn(
            outsider.id,
            set(self.cluster.members.values_list("id", flat=True)),
        )

    def test_same_branch_member_can_sit_in_without_joining_the_group(self):
        other_cluster = Cluster.objects.create(
            name="South Cluster",
            code="NEV-SOUTH",
            branch=self.branch,
            is_active=True,
        )
        sitter = Person.objects.create_user(
            username="sit-in-member",
            password="pass12345",
            first_name="Sam",
            last_name="Sitter",
            role="MEMBER",
            status="INACTIVE",
            water_baptism_date=date(2019, 6, 1),
            branch=self.branch,
        )
        other_cluster.members.add(sitter)

        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 42,
                "meeting_date": "2026-10-12",
                "gathering_type": "PHYSICAL",
                "members_attended": [self.member.id, sitter.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            set(response.data["members_attended"]),
            {self.member.id, sitter.id},
        )
        self.assertNotIn(
            sitter.id,
            set(self.group.members.values_list("id", flat=True)),
        )
        self.assertNotIn(
            sitter.id,
            set(self.cluster.members.values_list("id", flat=True)),
        )
        self.assertIn(sitter.id, set(other_cluster.members.values_list("id", flat=True)))

    def test_other_branch_member_cannot_sit_in(self):
        other_branch = Branch.objects.create(
            name="Laguna",
            code="NEV-LAG",
            is_active=True,
        )
        outsider = Person.objects.create_user(
            username="other-branch-member",
            password="pass12345",
            first_name="Bea",
            last_name="Branch",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(2018, 3, 1),
            branch=other_branch,
        )
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 42,
                "meeting_date": "2026-10-13",
                "gathering_type": "PHYSICAL",
                "members_attended": [self.member.id, outsider.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("members_attended", response.data.get("details", response.data))
        self.assertNotIn(
            outsider.id,
            set(self.group.members.values_list("id", flat=True)),
        )

    def test_visitor_cannot_be_recorded_as_a_member_attendee(self):
        visitor = Person.objects.create_user(
            username="not-a-sit-in",
            password="pass12345",
            first_name="Vic",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        response = self.client.post(
            "/api/evangelism/weekly-reports/",
            {
                "evangelism_group_id": self.group.id,
                "year": 2026,
                "week_number": 42,
                "meeting_date": "2026-10-14",
                "gathering_type": "PHYSICAL",
                "members_attended": [self.member.id, visitor.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_update_keeps_visitors_who_later_became_members(self):
        attended = Person.objects.create_user(
            username="then-visitor",
            password="pass12345",
            first_name="Vera",
            last_name="Then",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        never_attended = Person.objects.create_user(
            username="never-visitor",
            password="pass12345",
            first_name="Ned",
            last_name="Never",
            role="MEMBER",
            status="ACTIVE",
            water_baptism_date=date(2020, 1, 1),
            branch=self.branch,
        )
        report = EvangelismWeeklyReport.objects.create(
            evangelism_group=self.group,
            year=2026,
            week_number=21,
            meeting_date=date(2026, 5, 23),
            gathering_type="HYBRID",
            submitted_by=self.admin,
        )
        report.visitors_attended.add(attended)
        attended.water_baptism_date = date(2020, 6, 1)
        attended.save()
        attended.refresh_from_db()
        self.assertEqual(attended.role, "MEMBER")

        kept = self.client.patch(
            f"/api/evangelism/weekly-reports/{report.id}/",
            {"topic": "Baptism", "visitors_attended": [attended.id]},
            format="json",
        )
        self.assertEqual(kept.status_code, 200, kept.data)
        self.assertEqual(kept.data["visitors_attended"], [attended.id])

        rejected = self.client.patch(
            f"/api/evangelism/weekly-reports/{report.id}/",
            {"visitors_attended": [attended.id, never_attended.id]},
            format="json",
        )
        self.assertEqual(rejected.status_code, 400, rejected.data)
        self.assertIn("visitors_attended", rejected.data.get("details", rejected.data))
