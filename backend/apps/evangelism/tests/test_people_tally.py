from datetime import date, datetime

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterCord, ClusterCordMembership
from apps.people.models import Branch, Person
from core.datetime_utils import church_today


TALLY_URL = "/api/evangelism/weekly-reports/people_tally/"
DETAIL_URL = "/api/evangelism/weekly-reports/people_tally_detail/"
YEARS_URL = "/api/evangelism/weekly-reports/people_tally_years/"


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

    def _row_for_kind(self, rows, row_kind, cluster_id=None, cord_id=None):
        matches = [
            row
            for row in rows
            if row.get("row_kind") == row_kind
            and (cluster_id is None or row.get("cluster_id") == cluster_id)
            and (cord_id is None or row.get("cord_id") == cord_id)
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

    def test_cluster_mode_week_number_filters_to_iso_weeks(self):
        # 2026-01-05 is ISO week 2; 2026-01-20 is ISO week 4.
        early = self._person("tallyweekearly", role="MEMBER", first_name="Early")
        early.water_baptism_date = date(self.year, 1, 5)
        early.save(update_fields=["water_baptism_date"])
        self.east.members.add(early)

        late = self._person("tallyweeklate", role="MEMBER", first_name="Late")
        late.water_baptism_date = date(self.year, 1, 20)
        late.save(update_fields=["water_baptism_date"])
        self.east.members.add(late)

        week_two = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "group_by": "cluster",
                "months": "1",
                "week_number": "2",
            },
        )
        self.assertEqual(week_two.status_code, 200, week_two.data)
        east_week = self._row_for_kind(week_two.data, "cluster", self.east.id)
        self.assertEqual(east_week["baptized_count"], 1)
        self.assertEqual(east_week["unique_hc_count"], 1)

        january = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "group_by": "cluster",
                "months": "1",
            },
        )
        self.assertEqual(january.status_code, 200, january.data)
        east_month = self._row_for_kind(january.data, "cluster", self.east.id)
        self.assertEqual(east_month["baptized_count"], 2)

        detail = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "months": "1",
                "week_number": "2",
                "metric": "baptized",
                "cluster": self.east.id,
            },
        )
        self.assertEqual(detail.status_code, 200, detail.data)
        names = [row["first_name"] for row in detail.data["results"]]
        self.assertEqual(names, ["Early"])

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

    def test_people_tally_years_include_current_year_when_only_older_milestones_exist(self):
        member = self._person("tallyoldbaptism", role="MEMBER", first_name="Old")
        member.water_baptism_date = date(1986, 6, 1)
        member.save(update_fields=["water_baptism_date"])

        response = self.client.get(YEARS_URL, {"branch": self.branch.id})
        self.assertEqual(response.status_code, 200, response.data)
        current_year = church_today().year
        self.assertIn(1986, response.data["years"])
        self.assertIn(current_year, response.data["years"])
        self.assertEqual(response.data["years"], sorted(response.data["years"], reverse=True))
        self.assertEqual(response.data["default_year"], current_year)

    def test_detail_includes_cluster_codes_and_cord_name(self):
        member = self._person("tallycord", role="MEMBER", first_name="Cordy")
        member.water_baptism_date = date(self.year, 5, 10)
        member.role = "MEMBER"
        member.save(update_fields=["water_baptism_date", "role"])
        self.east.members.add(member)

        cord = ClusterCord.objects.create(
            cluster=self.east,
            name="Cord Alpha",
            sub_coordinator=member,
            is_active=True,
        )
        ClusterCordMembership.objects.create(cord=cord, person=member)

        response = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "month": 5,
                "metric": "baptized",
                "cluster": self.east.id,
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["first_name"], "Cordy")
        self.assertIn("TALLY-EAST", row.get("cluster_codes") or [])
        self.assertEqual(row.get("cord_name"), "Cord Alpha")
        self.assertEqual(row.get("cord_id"), cord.id)

    def test_cord_mode_requires_branch(self):
        response = self.client.get(
            TALLY_URL,
            {"year": self.year, "group_by": "cord"},
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_cord_mode_lists_cords_uncorded_and_total(self):
        corded = self._person("tally5x5", role="MEMBER", first_name="Corded")
        corded.water_baptism_date = date(self.year, 3, 8)
        corded.save(update_fields=["water_baptism_date"])
        self.east.members.add(corded)

        loose = self._person("tallyloose", role="MEMBER", first_name="Loose")
        loose.water_baptism_date = date(self.year, 3, 15)
        loose.save(update_fields=["water_baptism_date"])
        self.east.members.add(loose)

        cord = ClusterCord.objects.create(
            cluster=self.east,
            name="Gamma 5x5",
            sub_coordinator=corded,
            is_active=True,
        )
        ClusterCordMembership.objects.create(cord=cord, person=corded)

        response = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "group_by": "cord",
                "months": "3",
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        cord_row = self._row_for_kind(response.data, "cord", cord_id=cord.id)
        uncorded = self._row_for_kind(response.data, "uncorded")
        total = self._row_for_kind(response.data, "total")

        self.assertEqual(cord_row["cord_name"], "Gamma 5x5")
        self.assertEqual(cord_row["cluster_code"], "TALLY-EAST")
        self.assertEqual(cord_row["baptized_count"], 1)
        self.assertEqual(uncorded["baptized_count"], 1)
        self.assertEqual(total["baptized_count"], 2)

    def test_cord_mode_detail_filters_by_cord_and_uncorded(self):
        corded = self._person("tallycordfilt", role="MEMBER", first_name="InCord")
        corded.water_baptism_date = date(self.year, 6, 4)
        corded.save(update_fields=["water_baptism_date"])
        self.east.members.add(corded)

        loose = self._person("tallyuncordfilt", role="MEMBER", first_name="NoCord")
        loose.water_baptism_date = date(self.year, 6, 12)
        loose.save(update_fields=["water_baptism_date"])
        self.east.members.add(loose)

        cord = ClusterCord.objects.create(
            cluster=self.east,
            name="Delta 5x5",
            sub_coordinator=corded,
            is_active=True,
        )
        ClusterCordMembership.objects.create(cord=cord, person=corded)

        cord_detail = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "months": "6",
                "metric": "baptized",
                "cord": cord.id,
            },
        )
        self.assertEqual(cord_detail.status_code, 200, cord_detail.data)
        self.assertEqual(cord_detail.data["count"], 1)
        self.assertEqual(cord_detail.data["results"][0]["first_name"], "InCord")

        uncorded_detail = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch": self.branch.id,
                "months": "6",
                "metric": "baptized",
                "cord": "uncorded",
            },
        )
        self.assertEqual(uncorded_detail.status_code, 200, uncorded_detail.data)
        self.assertEqual(uncorded_detail.data["count"], 1)
        self.assertEqual(uncorded_detail.data["results"][0]["first_name"], "NoCord")
