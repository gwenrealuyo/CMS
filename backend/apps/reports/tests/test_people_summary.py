from datetime import date

from django.test import TestCase

from apps.clusters.models import Cluster
from apps.people.models import Branch, Person
from apps.reports.services import build_people_summary


class PeopleSummaryClusterTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTPEOPLESUM",
            is_active=True,
        )

    def _person(self, username, role="MEMBER", **kwargs):
        create_kwargs = {
            "username": username,
            "password": "pass12345",
            "first_name": kwargs.get("first_name", username.title()),
            "last_name": kwargs.get("last_name", "Test"),
            "role": role,
            "status": "ACTIVE",
            "branch": self.branch,
        }
        if role == "MEMBER":
            create_kwargs["water_baptism_date"] = date(2020, 1, 1)
        return Person.objects.create_user(**create_kwargs)

    def test_without_cluster_excludes_unclustered_pastors(self):
        clustered_member = self._person("psumclus", first_name="Clem")
        unclustered_member = self._person("psumunass", first_name="Una")
        unclustered_pastor = self._person(
            "psumpastor", role="PASTOR", first_name="Paul"
        )
        cluster = Cluster.objects.create(
            name="East",
            code="PSUM-EAST",
            branch=self.branch,
            is_active=True,
        )
        cluster.members.add(clustered_member)

        payload = build_people_summary(
            Person.objects.filter(branch=self.branch).exclude(role="ADMIN")
        )
        summary = payload["summary"]
        self.assertEqual(summary["in_cluster"], 1)
        # Only the unclustered member is flagged; pastor is exempt.
        self.assertEqual(summary["without_cluster"], 1)
        self.assertEqual(summary["total_people"], 3)
        self.assertIsNotNone(unclustered_pastor.id)
        self.assertIsNotNone(unclustered_member.id)
