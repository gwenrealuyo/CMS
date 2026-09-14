from datetime import date, datetime

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.people.models import Branch, Person


TALLY_URL = "/api/evangelism/weekly-reports/people_tally/"
DETAIL_URL = "/api/evangelism/weekly-reports/people_tally_detail/"


class PeopleTallyAPITests(APITestCase):
    def setUp(self):
        self.year = 2026
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTTALLY",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="tallyadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.east = Cluster.objects.create(
            name="East Cluster",
            code="TALLY-EAST",
            branch=self.branch,
            is_active=True,
        )
        self.west = Cluster.objects.create(
            name="West Cluster",
            code="TALLY-WEST",
            branch=self.branch,
            is_active=True,
        )
        self.client.force_authenticate(self.admin)

    def _aware(self, year, month, day=10):
        return timezone.make_aware(datetime(year, month, day, 12, 0, 0))

    def _person(self, username, role="MEMBER", **kwargs):
        person = Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=kwargs.get("first_name", username.title()),
            last_name=kwargs.get("last_name", "Test"),
            role=role,
            status=kwargs.get("status", "ACTIVE" if role != "VISITOR" else "ONGOING"),
            branch=self.branch,
        )
        return person

    def _row_for_month(self, rows, month):
        matches = [row for row in rows if row.get("month") == month]
        self.assertEqual(len(matches), 1, rows)
        return matches[0]

    def _row_for_kind(self, rows, row_kind, cluster_id=None):
        matches = [
            row
            for row in rows
            if row.get("row_kind") == row_kind
            and (cluster_id is None or row.get("cluster_id") == cluster_id)
        ]
        self.assertEqual(len(matches), 1, rows)
        return matches[0]

    def test_default_group_by_returns_twelve_month_rows(self):
        response = self.client.get(TALLY_URL, {"year": self.year, "branch": self.branch.id})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 12)
        self.assertEqual([row["month"] for row in response.data], list(range(1, 13)))
        self.assertTrue(all(row.get("row_kind") in (None, "") for row in response.data))

    def test_cluster_mode_requires_branch(self):
        response = self.client.get(
            TALLY_URL,
            {"year": self.year, "group_by": "cluster"},
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_cluster_mode_lists_clusters_and_unions_unique_hc(self):
        anna = self._person("tallyanna", role="MEMBER", first_name="Anna")
        anna.water_baptism_date = date(self.year, 1, 12)
        anna.spirit_baptism_date = date(self.year, 2, 8)
        anna.save(update_fields=["water_baptism_date", "spirit_baptism_date"])
        self.east.members.add(anna)

        ben = self._person("tallyben", role="MEMBER", first_name="Ben")
        ben.water_baptism_date = date(self.year, 1, 20)
        ben.save(update_fields=["water_baptism_date"])
        self.west.members.add(ben)

        dual = self._person("tallydual", role="MEMBER", first_name="Dee")
        dual.water_baptism_date = date(self.year, 1, 28)
        dual.save(update_fields=["water_baptism_date"])
        self.east.members.add(dual)
        self.west.members.add(dual)

        invited = self._person("tallyinvite", role="VISITOR", first_name="Ivy")
        invited.date_joined = self._aware(self.year, 3)
        invited.date_first_attended = None
        invited.save(update_fields=["date_joined", "date_first_attended"])

        response = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "group_by": "cluster",
                "months": "1,2,3",
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        east_row = self._row_for_kind(response.data, "cluster", self.east.id)
        west_row = self._row_for_kind(response.data, "cluster", self.west.id)
        unassigned = self._row_for_kind(response.data, "unassigned")
        total = self._row_for_kind(response.data, "total")

        self.assertEqual(east_row["baptized_count"], 2)
        self.assertEqual(east_row["received_hg_count"], 1)
        self.assertEqual(east_row["unique_hc_count"], 2)
        self.assertEqual(west_row["baptized_count"], 2)
        self.assertEqual(west_row["unique_hc_count"], 2)
        self.assertEqual(unassigned["invited_count"], 1)
        self.assertEqual(unassigned["unique_hc_count"], 1)
        self.assertEqual(total["baptized_count"], 3)
        self.assertEqual(total["received_hg_count"], 1)
        self.assertEqual(total["invited_count"], 1)
        self.assertEqual(total["unique_hc_count"], 4)
        self.assertGreater(
            east_row["unique_hc_count"]
            + west_row["unique_hc_count"]
            + unassigned["unique_hc_count"],
            total["unique_hc_count"],
        )

    def test_cluster_mode_q1_unique_hc_is_not_sum_of_months(self):
        member = self._person("tallyspan", role="MEMBER", first_name="Sam")
        member.water_baptism_date = date(self.year, 1, 5)
        member.spirit_baptism_date = date(self.year, 2, 14)
        member.save(update_fields=["water_baptism_date", "spirit_baptism_date"])
        self.east.members.add(member)

        month_response = self.client.get(
            TALLY_URL,
            {"year": self.year, "branch": self.branch.id, "cluster": self.east.id},
        )
        self.assertEqual(month_response.status_code, 200, month_response.data)
        january = self._row_for_month(month_response.data, 1)
        february = self._row_for_month(month_response.data, 2)
        self.assertEqual(january["unique_hc_count"], 1)
        self.assertEqual(february["unique_hc_count"], 1)

        q1 = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "group_by": "cluster",
                "months": "1,2,3",
            },
        )
        self.assertEqual(q1.status_code, 200, q1.data)
        east_row = self._row_for_kind(q1.data, "cluster", self.east.id)
        self.assertEqual(east_row["baptized_count"], 1)
        self.assertEqual(east_row["received_hg_count"], 1)
        self.assertEqual(east_row["unique_hc_count"], 1)
        self.assertNotEqual(
            east_row["unique_hc_count"],
            january["unique_hc_count"] + february["unique_hc_count"],
        )

        january_only = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "group_by": "cluster",
                "months": "1",
            },
        )
        self.assertEqual(january_only.status_code, 200, january_only.data)
        east_jan = self._row_for_kind(january_only.data, "cluster", self.east.id)
        self.assertEqual(east_jan["baptized_count"], 1)
        self.assertEqual(east_jan["received_hg_count"], 0)
        self.assertEqual(east_jan["unique_hc_count"], 1)

    def test_detail_accepts_months_and_unassigned_cluster(self):
        invited = self._person("tallyunass", role="VISITOR", first_name="Una")
        invited.date_joined = self._aware(self.year, 4)
        invited.date_first_attended = None
        invited.save(update_fields=["date_joined", "date_first_attended"])

        clustered = self._person("tallyclus", role="MEMBER", first_name="Cal")
        clustered.water_baptism_date = date(self.year, 4, 18)
        clustered.save(update_fields=["water_baptism_date"])
        self.east.members.add(clustered)

        unassigned_detail = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "months": "4,5,6",
                "metric": "unique_hc",
                "cluster": "unassigned",
            },
        )
        self.assertEqual(unassigned_detail.status_code, 200, unassigned_detail.data)
        names = {row["first_name"] for row in unassigned_detail.data["results"]}
        self.assertIn("Una", names)
        self.assertNotIn("Cal", names)

        month_alias = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "month": 4,
                "metric": "baptized",
                "cluster": self.east.id,
            },
        )
        self.assertEqual(month_alias.status_code, 200, month_alias.data)
        self.assertEqual(month_alias.data["count"], 1)
        self.assertEqual(month_alias.data["results"][0]["first_name"], "Cal")
