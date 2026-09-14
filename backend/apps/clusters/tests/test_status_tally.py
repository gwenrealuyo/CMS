from datetime import datetime

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.people.models import Branch, Person, PersonStatusChange
from core.datetime_utils import church_today


TALLY_URL = "/api/clusters/clusters/status_tally/"
YEARS_URL = "/api/clusters/clusters/status_tally_years/"
DETAIL_URL = "/api/clusters/clusters/status_tally_detail/"


class ClusterStatusTallyAPITests(APITestCase):
    def setUp(self):
        self.year = 2025
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTSTATALLY",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="stattallyadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.east = Cluster.objects.create(
            name="East Cluster",
            code="STAT-EAST",
            branch=self.branch,
            is_active=True,
        )
        self.west = Cluster.objects.create(
            name="West Cluster",
            code="STAT-WEST",
            branch=self.branch,
            is_active=True,
        )
        self.client.force_authenticate(self.admin)

    def _person(self, username, role="MEMBER", **kwargs):
        return Person.objects.create_user(
            username=username,
            password="pass12345",
            first_name=kwargs.get("first_name", username.title()),
            last_name=kwargs.get("last_name", "Test"),
            role=role,
            status=kwargs.get("status", "ACTIVE"),
            branch=kwargs.get("branch", self.branch),
        )

    def _set_status_change(self, person, from_status, to_status, when):
        change = PersonStatusChange.objects.create(
            person=person,
            from_status=from_status,
            to_status=to_status,
            source=PersonStatusChange.Source.MANUAL,
            changed_by=self.admin,
        )
        PersonStatusChange.objects.filter(pk=change.pk).update(created_at=when)
        Person.objects.filter(pk=person.pk).update(status=to_status)
        person.status = to_status
        return change

    def _aware(self, year, month, day=10, hour=12):
        return timezone.make_aware(datetime(year, month, day, hour, 0, 0))

    def _row_for_kind(self, rows, row_kind, cluster_id=None):
        matches = [
            row
            for row in rows
            if row.get("row_kind") == row_kind
            and (cluster_id is None or row.get("cluster_id") == cluster_id)
        ]
        self.assertEqual(len(matches), 1, rows)
        return matches[0]

    def test_requires_branch(self):
        response = self.client.get(TALLY_URL, {"year": self.year, "months": "9"})
        self.assertEqual(response.status_code, 400, response.data)

    def test_current_month_snapshot_counts_current_status(self):
        member = self._person("statactive", first_name="Ana")
        pastor = self._person("statpastor", role="PASTOR", first_name="Paul")
        visitor = self._person("statvisit", role="VISITOR", first_name="Vivi")
        self.east.members.add(member, pastor, visitor, self.admin)

        today = church_today()
        response = self.client.get(
            TALLY_URL,
            {
                "year": today.year,
                "branch_id": self.branch.id,
                "months": str(today.month),
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        east = self._row_for_kind(response.data, "cluster", self.east.id)
        west = self._row_for_kind(response.data, "cluster", self.west.id)
        total = self._row_for_kind(response.data, "total")

        self.assertEqual(east["active_count"], 2)
        self.assertEqual(east["members_count"], 2)
        self.assertEqual(west["active_count"], 0)
        self.assertEqual(total["active_count"], 2)
        self.assertEqual(east["as_of"], today.isoformat())

    def test_person_who_changed_after_as_of_keeps_old_status(self):
        member = self._person("statchange", first_name="Cara")
        self.east.members.add(member)
        self._set_status_change(
            member,
            "ACTIVE",
            "SEMIACTIVE",
            self._aware(self.year, 9, 5),
        )

        august = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "8",
            },
        )
        self.assertEqual(august.status_code, 200, august.data)
        east_aug = self._row_for_kind(august.data, "cluster", self.east.id)
        self.assertEqual(east_aug["active_count"], 1)
        self.assertEqual(east_aug["semiactive_count"], 0)
        self.assertEqual(east_aug["as_of"], f"{self.year}-08-31")

        september = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
            },
        )
        self.assertEqual(september.status_code, 200, september.data)
        east_sep = self._row_for_kind(september.data, "cluster", self.east.id)
        self.assertEqual(east_sep["active_count"], 0)
        self.assertEqual(east_sep["semiactive_count"], 1)

    def test_total_is_union_not_sum_of_cluster_cells(self):
        dual = self._person("statdual", first_name="Dee")
        self.east.members.add(dual)
        self.west.members.add(dual)

        response = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        east = self._row_for_kind(response.data, "cluster", self.east.id)
        west = self._row_for_kind(response.data, "cluster", self.west.id)
        total = self._row_for_kind(response.data, "total")
        self.assertEqual(east["active_count"], 1)
        self.assertEqual(west["active_count"], 1)
        self.assertEqual(total["active_count"], 1)
        self.assertEqual(
            east["active_count"] + west["active_count"],
            2,
        )

    def test_q1_snapshot_differs_from_january_when_status_changes_in_february(self):
        member = self._person("statq1", first_name="Quin")
        self.east.members.add(member)
        self._set_status_change(
            member,
            "ACTIVE",
            "INACTIVE",
            self._aware(self.year, 2, 15),
        )

        january = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "1",
            },
        )
        self.assertEqual(january.status_code, 200, january.data)
        east_jan = self._row_for_kind(january.data, "cluster", self.east.id)
        self.assertEqual(east_jan["active_count"], 1)
        self.assertEqual(east_jan["inactive_count"], 0)
        self.assertEqual(east_jan["as_of"], f"{self.year}-01-31")

        q1 = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "1,2,3",
            },
        )
        self.assertEqual(q1.status_code, 200, q1.data)
        east_q1 = self._row_for_kind(q1.data, "cluster", self.east.id)
        self.assertEqual(east_q1["active_count"], 0)
        self.assertEqual(east_q1["inactive_count"], 1)
        self.assertEqual(east_q1["as_of"], f"{self.year}-03-31")

    def test_unassigned_row_and_detail(self):
        clustered = self._person("statclus", first_name="Clem")
        unassigned = self._person("statunass", first_name="Una")
        self.east.members.add(clustered)

        response = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        unassigned_row = self._row_for_kind(response.data, "unassigned")
        total = self._row_for_kind(response.data, "total")
        self.assertEqual(unassigned_row["active_count"], 1)
        self.assertEqual(total["active_count"], 2)

        detail = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
                "status": "ACTIVE",
                "cluster": "unassigned",
            },
        )
        self.assertEqual(detail.status_code, 200, detail.data)
        names = [row["first_name"] for row in detail.data["results"]]
        self.assertEqual(names, ["Una"])
        self.assertEqual(detail.data["count"], 1)

    def test_detail_includes_transition_and_in_window_flag(self):
        member = self._person("statmodal", first_name="Mia")
        self.east.members.add(member)
        self._set_status_change(
            member,
            "ACTIVE",
            "SEMIACTIVE",
            self._aware(self.year, 9, 4),
        )

        detail = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
                "status": "SEMIACTIVE",
                "cluster": self.east.id,
            },
        )
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["count"], 1)
        row = detail.data["results"][0]
        self.assertEqual(row["from_status"], "ACTIVE")
        self.assertEqual(row["to_status"], "SEMIACTIVE")
        self.assertEqual(row["status"], "SEMIACTIVE")
        self.assertTrue(row["in_window"])
        self.assertIsNotNone(row["changed_at"])

    def test_years_requires_branch(self):
        response = self.client.get(YEARS_URL)
        self.assertEqual(response.status_code, 400, response.data)
        ok = self.client.get(YEARS_URL, {"branch_id": self.branch.id})
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertIn(church_today().year, ok.data["years"])
        self.assertEqual(ok.data["default_year"], church_today().year)
