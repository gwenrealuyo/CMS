from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.evangelism.models import EvangelismGroup
from apps.people.models import Branch, ModuleCoordinator, Person


class PeopleListReportScopeAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTREPSCP",
            is_active=True,
        )
        self.other_branch = Branch.objects.create(
            name="Makati",
            code="MAKAREPSCP",
            is_active=True,
        )
        self.sharer = Person.objects.create_user(
            username="repscpsharer",
            password="pass12345",
            first_name="Bea",
            last_name="Sharer",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.group_member = Person.objects.create_user(
            username="repscpmember",
            password="pass12345",
            first_name="Mia",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.plain_member = Person.objects.create_user(
            username="repscpplain",
            password="pass12345",
            first_name="Pam",
            last_name="Plain",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.same_branch_visitor = Person.objects.create_user(
            username="repscpvisitor",
            password="pass12345",
            first_name="Vic",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        self.other_branch_visitor = Person.objects.create_user(
            username="repscpothervisit",
            password="pass12345",
            first_name="Oli",
            last_name="Other",
            role="VISITOR",
            status="ONGOING",
            branch=self.other_branch,
        )
        cluster = Cluster.objects.create(
            name="Report Scope Cluster",
            code="REP-SCP",
            branch=self.branch,
            is_active=True,
        )
        self.group = EvangelismGroup.objects.create(
            name="Report Scope Group",
            cluster=cluster,
            coordinator=self.group_member,
            is_active=True,
        )
        self.group.members.add(self.sharer, self.group_member)
        ModuleCoordinator.objects.create(
            person=self.sharer,
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=self.group.id,
        )

    def _list_ids(self, **params):
        response = self.client.get("/api/people/people/", params)
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data.get("results", response.data)
        return {row["id"] for row in results}

    def test_bible_sharer_directory_is_group_members_only(self):
        self.client.force_authenticate(self.sharer)
        ids = self._list_ids()
        self.assertIn(self.sharer.id, ids)
        self.assertIn(self.group_member.id, ids)
        self.assertNotIn(self.same_branch_visitor.id, ids)
        self.assertNotIn(self.plain_member.id, ids)
        self.assertNotIn(self.other_branch_visitor.id, ids)

    def test_bible_sharer_report_list_includes_same_branch_visitors(self):
        self.client.force_authenticate(self.sharer)
        ids = self._list_ids(for_report="true")
        self.assertIn(self.same_branch_visitor.id, ids)
        self.assertIn(self.plain_member.id, ids)
        self.assertIn(self.group_member.id, ids)
        self.assertNotIn(self.other_branch_visitor.id, ids)

    def test_bible_sharer_cannot_retrieve_unrelated_visitor_profile(self):
        self.client.force_authenticate(self.sharer)
        response = self.client.get(
            f"/api/people/people/{self.same_branch_visitor.id}/"
        )
        self.assertEqual(response.status_code, 404)

    def test_member_for_report_does_not_widen_scope(self):
        self.client.force_authenticate(self.plain_member)
        ids = self._list_ids(for_report="true")
        self.assertIn(self.plain_member.id, ids)
        self.assertNotIn(self.same_branch_visitor.id, ids)
        self.assertNotIn(self.group_member.id, ids)
