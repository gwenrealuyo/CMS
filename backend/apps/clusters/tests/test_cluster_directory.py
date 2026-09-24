from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster
from apps.people.models import Branch, Person


class ClusterDirectoryAPITests(APITestCase):
    def setUp(self):
        self.muntinlupa = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTCL",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="cludiradmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.muntinlupa,
        )
        self.coordinator = Person.objects.create_user(
            username="cludircoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.muntinlupa,
            water_baptism_date=date(2020, 1, 1),
        )

    def _person(self, username, role, **kwargs):
        create_kwargs = {
            "username": username,
            "password": "pass12345",
            "first_name": kwargs.get("first_name", username.title()),
            "last_name": kwargs.get("last_name", "Test"),
            "role": role,
            "status": "ACTIVE",
            "branch": self.muntinlupa,
        }
        if role == "MEMBER":
            create_kwargs["water_baptism_date"] = date(2020, 1, 1)
        return Person.objects.create_user(**create_kwargs)

    def _east_cluster(self):
        cluster = Cluster.objects.create(
            name="East Cluster",
            code="CLU-EAST",
            coordinator=self.coordinator,
            branch=self.muntinlupa,
        )
        pastor = self._person("cludirpastor", "PASTOR", first_name="Teresa")
        member_b = self._person("cludirmemberb", "MEMBER", first_name="Juan")
        member_c = self._person("cludirmemberc", "MEMBER", first_name="Benito")
        visitor = self._person("cludirvisit", "VISITOR", first_name="Pedro")
        cluster.members.add(
            self.coordinator,
            pastor,
            member_b,
            member_c,
            visitor,
            self.admin,
        )
        return cluster, visitor

    def _cluster_row(self, response, name):
        rows = [
            row for row in response.data.get("results", []) if row["name"] == name
        ]
        self.assertEqual(len(rows), 1, response.data)
        return rows[0]

    def test_list_counts_split_members_and_visitors(self):
        self._east_cluster()
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/clusters/clusters/")
        self.assertEqual(response.status_code, 200, response.data)
        row = self._cluster_row(response, "East Cluster")
        self.assertEqual(row["member_count"], 4)
        self.assertEqual(row["visitor_count"], 1)

        summary = self.client.get("/api/clusters/clusters/summary/")
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(summary.data["member_count"], 4)

    def test_unassigned_excludes_pastors(self):
        self._east_cluster()
        unassigned_member = self._person(
            "cludirunass", "MEMBER", first_name="Una", last_name="Member"
        )
        unclustered_pastor = self._person(
            "cludirfreepastor", "PASTOR", first_name="Free", last_name="Pastor"
        )
        self.client.force_authenticate(self.admin)

        summary = self.client.get("/api/clusters/clusters/summary/")
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(summary.data["unassigned_count"], 1)

        response = self.client.get("/api/clusters/clusters/unassigned-people/")
        self.assertEqual(response.status_code, 200, response.data)
        usernames = [row["username"] for row in response.data["results"]]
        self.assertIn(unassigned_member.username, usernames)
        self.assertNotIn(unclustered_pastor.username, usernames)
