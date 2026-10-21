from datetime import date, datetime

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterCord, ClusterCordMembership
from apps.people.models import Branch, ModuleCoordinator, Person, PersonStatusChange
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
        create_kwargs = {
            "username": username,
            "password": "pass12345",
            "first_name": kwargs.get("first_name", username.title()),
            "last_name": kwargs.get("last_name", "Test"),
            "role": role,
            "status": kwargs.get("status", "ACTIVE"),
            "branch": kwargs.get("branch", self.branch),
        }
        if role == "MEMBER" and "water_baptism_date" not in kwargs:
            create_kwargs["water_baptism_date"] = date(2020, 1, 1)
        elif "water_baptism_date" in kwargs:
            create_kwargs["water_baptism_date"] = kwargs["water_baptism_date"]
        return Person.objects.create_user(**create_kwargs)

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

    def test_unclustered_pastor_excluded_from_unassigned(self):
        clustered = self._person("statclusp", first_name="Clem")
        unassigned_member = self._person("statunassm", first_name="Una")
        unclustered_pastor = self._person(
            "statpastorfree", role="PASTOR", first_name="Paul"
        )
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
        # Clustered member + unassigned member only; pastor is exempt.
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
        self.assertNotIn(unclustered_pastor.first_name, names)

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

    def test_week_number_sets_as_of_to_sunday_of_latest_week(self):
        member = self._person("statweek", first_name="Willa")
        self.east.members.add(member)
        # Status flips mid-week after ISO week 36 Sunday (2025-09-07).
        self._set_status_change(
            member,
            "ACTIVE",
            "INACTIVE",
            self._aware(self.year, 9, 8),
        )

        week_snapshot = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
                "week_number": "36",
            },
        )
        self.assertEqual(week_snapshot.status_code, 200, week_snapshot.data)
        east_week = self._row_for_kind(week_snapshot.data, "cluster", self.east.id)
        self.assertEqual(east_week["as_of"], f"{self.year}-09-07")
        self.assertEqual(east_week["active_count"], 1)
        self.assertEqual(east_week["inactive_count"], 0)

        month_snapshot = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
            },
        )
        self.assertEqual(month_snapshot.status_code, 200, month_snapshot.data)
        east_month = self._row_for_kind(month_snapshot.data, "cluster", self.east.id)
        self.assertEqual(east_month["as_of"], f"{self.year}-09-30")
        self.assertEqual(east_month["active_count"], 0)
        self.assertEqual(east_month["inactive_count"], 1)

        detail = self.client.get(
            DETAIL_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
                "week_number": "36",
                "status": "ACTIVE",
                "cluster": self.east.id,
            },
        )
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["count"], 1)
        self.assertFalse(detail.data["results"][0]["in_window"])

    def _detail_params(self, **extra):
        params = {
            "year": self.year,
            "branch_id": self.branch.id,
            "months": "9",
            "status": "ACTIVE",
            "cluster": self.east.id,
        }
        params.update(extra)
        return params

    def test_plain_member_sees_counts_but_not_people(self):
        member = self._person("statplain", first_name="Plain")
        listed = self._person("statlisted", first_name="Listed")
        self.east.members.add(listed)
        self.client.force_authenticate(member)

        tally = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
            },
        )
        self.assertEqual(tally.status_code, 200, tally.data)

        detail = self.client.get(DETAIL_URL, self._detail_params())
        self.assertEqual(detail.status_code, 403, detail.data)

    def test_reporter_only_cannot_view_status_tally_people(self):
        reporter = self._person("statreporter", first_name="Rep")
        ModuleCoordinator.objects.create(
            person=reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.east.id,
            resource_type="Cluster",
        )
        self.client.force_authenticate(reporter)

        detail = self.client.get(DETAIL_URL, self._detail_params())
        self.assertEqual(detail.status_code, 403, detail.data)

    def test_cluster_coordinator_can_view_status_tally_people(self):
        coordinator = self._person("statcoord", first_name="Cord")
        listed = self._person("statcoordlisted", first_name="Listed")
        self.east.members.add(listed)
        ModuleCoordinator.objects.create(
            person=coordinator,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id=self.east.id,
            resource_type="Cluster",
        )
        self.client.force_authenticate(coordinator)

        detail = self.client.get(DETAIL_URL, self._detail_params())
        self.assertEqual(detail.status_code, 200, detail.data)
        names = [row["first_name"] for row in detail.data["results"]]
        self.assertEqual(names, ["Listed"])

    def test_fk_coordinator_can_view_status_tally_people(self):
        coordinator = self._person("statfkcoord", first_name="Faye")
        listed = self._person("statfklisted", first_name="Listed")
        self.east.members.add(listed)
        self.east.coordinator = coordinator
        self.east.save(update_fields=["coordinator"])
        self.client.force_authenticate(coordinator)

        detail = self.client.get(DETAIL_URL, self._detail_params())
        self.assertEqual(detail.status_code, 200, detail.data)
        names = [row["first_name"] for row in detail.data["results"]]
        self.assertEqual(names, ["Listed"])

    def test_years_requires_branch(self):
        response = self.client.get(YEARS_URL)
        self.assertEqual(response.status_code, 400, response.data)
        ok = self.client.get(YEARS_URL, {"branch_id": self.branch.id})
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertIn(church_today().year, ok.data["years"])
        self.assertEqual(ok.data["default_year"], church_today().year)

    def test_cord_mode_lists_cords_uncorded_and_total(self):
        corded = self._person("statcorded", first_name="Corded")
        loose = self._person("statloose", first_name="Loose")
        self.east.members.add(corded, loose)

        cord = ClusterCord.objects.create(
            cluster=self.east,
            name="Alpha 5x5",
            sub_coordinator=corded,
            is_active=True,
        )
        ClusterCordMembership.objects.create(cord=cord, person=corded)

        today = church_today()
        response = self.client.get(
            TALLY_URL,
            {
                "year": today.year,
                "branch_id": self.branch.id,
                "months": str(today.month),
                "group_by": "cord",
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        cord_row = self._row_for_kind(response.data, "cord", cord_id=cord.id)
        uncorded = self._row_for_kind(response.data, "uncorded")
        total = self._row_for_kind(response.data, "total")

        self.assertEqual(cord_row["cord_name"], "Alpha 5x5")
        self.assertEqual(cord_row["cluster_code"], "STAT-EAST")
        self.assertEqual(cord_row["active_count"], 1)
        self.assertEqual(cord_row["members_count"], 1)
        self.assertEqual(uncorded["active_count"], 1)
        self.assertEqual(uncorded["members_count"], 1)
        self.assertEqual(total["active_count"], 2)
        self.assertEqual(total["members_count"], 2)

    def test_cord_mode_detail_filters_by_cord_and_uncorded(self):
        corded = self._person("statcorddetail", first_name="InCord")
        loose = self._person("statuncorddetail", first_name="NoCord")
        self.east.members.add(corded, loose)

        cord = ClusterCord.objects.create(
            cluster=self.east,
            name="Beta 5x5",
            sub_coordinator=corded,
            is_active=True,
        )
        ClusterCordMembership.objects.create(cord=cord, person=corded)

        today = church_today()
        cord_detail = self.client.get(
            DETAIL_URL,
            {
                "year": today.year,
                "branch_id": self.branch.id,
                "months": str(today.month),
                "status": "ACTIVE",
                "cord": cord.id,
            },
        )
        self.assertEqual(cord_detail.status_code, 200, cord_detail.data)
        self.assertEqual(
            [row["first_name"] for row in cord_detail.data["results"]],
            ["InCord"],
        )

        uncorded_detail = self.client.get(
            DETAIL_URL,
            {
                "year": today.year,
                "branch_id": self.branch.id,
                "months": str(today.month),
                "status": "ACTIVE",
                "cord": "uncorded",
            },
        )
        self.assertEqual(uncorded_detail.status_code, 200, uncorded_detail.data)
        self.assertEqual(
            [row["first_name"] for row in uncorded_detail.data["results"]],
            ["NoCord"],
        )

    def test_invalid_group_by_rejected(self):
        response = self.client.get(
            TALLY_URL,
            {
                "year": self.year,
                "branch_id": self.branch.id,
                "months": "9",
                "group_by": "month",
            },
        )
        self.assertEqual(response.status_code, 400, response.data)
