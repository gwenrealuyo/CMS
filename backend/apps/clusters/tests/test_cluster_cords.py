from datetime import date

from rest_framework.test import APITestCase

from apps.clusters.models import Cluster, ClusterCord, ClusterCordMembership
from apps.people.models import Branch, MemberCareCase, ModuleCoordinator, Person


class ClusterCordAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Cord Branch",
            code="CORD",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="cordadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.coordinator = Person.objects.create_user(
            username="cordcoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
        )
        self.reporter = Person.objects.create_user(
            username="cordreporter",
            password="pass12345",
            first_name="Rita",
            last_name="Reporter",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
        )
        self.cluster = Cluster.objects.create(
            name="Cord Cluster",
            code="CORD-1",
            branch=self.branch,
            coordinator=self.coordinator,
            is_active=True,
        )
        self.cluster.members.add(self.coordinator, self.reporter)
        ModuleCoordinator.objects.create(
            person=self.reporter,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.REPORTER,
            resource_id=self.cluster.id,
            resource_type="Cluster",
        )
        self.client.force_authenticate(self.admin)

    def _member(self, username, **kwargs):
        role = kwargs.get("role", "MEMBER")
        create_kwargs = {
            "username": username,
            "password": "pass12345",
            "first_name": kwargs.get("first_name", username.title()),
            "last_name": kwargs.get("last_name", "Test"),
            "role": role,
            "status": kwargs.get("status", "ACTIVE"),
            "branch": self.branch,
        }
        if role == "MEMBER":
            create_kwargs["water_baptism_date"] = date(2020, 1, 1)
        person = Person.objects.create_user(**create_kwargs)
        if kwargs.get("add_to_cluster", True):
            self.cluster.members.add(person)
        return person

    def test_create_cord_with_sub_coordinator(self):
        a = self._member("m1")
        b = self._member("m2", status="SEMIACTIVE")
        c = self._member("m3")
        d = self._member("m4")
        e = self._member("m5")
        response = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Cord Alpha",
                "members": [a.id, b.id, c.id, d.id, e.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["name"], "Cord Alpha")
        self.assertEqual(response.data["member_count"], 5)
        self.assertIsNone(response.data["size_warning"])
        self.assertEqual(response.data["sub_coordinator"]["id"], a.id)
        self.assertEqual(response.data["care_summary"]["open_count"], 0)

    def test_rejects_visitor_and_inactive(self):
        visitor = self._member("vis", role="VISITOR")
        inactive = self._member("inact", status="INACTIVE")
        active = self._member("act")
        response = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Bad Cord",
                "members": [visitor.id, inactive.id, active.id],
                "sub_coordinator_id": active.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        details = response.data.get("details", response.data)
        self.assertIn("members", details)

    def test_one_cord_per_person_per_cluster(self):
        a = self._member("once1")
        b = self._member("once2")
        first = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Cord A",
                "members": [a.id, b.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        c = self._member("once3")
        second = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Cord B",
                "members": [a.id, c.id],
                "sub_coordinator_id": c.id,
            },
            format="json",
        )
        self.assertEqual(second.status_code, 400)
        details = second.data.get("details", second.data)
        self.assertIn("members", details)

    def test_sub_coordinator_must_be_member(self):
        a = self._member("sub1")
        b = self._member("sub2")
        outsider = self._member("outsider")
        response = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Cord Sub",
                "members": [a.id, b.id],
                "sub_coordinator_id": outsider.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        details = response.data.get("details", response.data)
        self.assertIn("sub_coordinator_id", details)

    def test_removing_cluster_member_drops_cord_membership(self):
        a = self._member("drop1")
        b = self._member("drop2")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Cord Drop",
                "members": [a.id, b.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        cord_id = create.data["id"]

        members = list(
            self.cluster.members.exclude(id=b.id).values_list("id", flat=True)
        )
        update = self.client.put(
            f"/api/clusters/clusters/{self.cluster.id}/",
            {
                "code": self.cluster.code,
                "name": self.cluster.name,
                "branch": self.branch.id,
                "members": members,
                "families": [],
                "location": "",
                "meeting_schedule": "",
                "description": "",
            },
            format="json",
        )
        self.assertEqual(update.status_code, 200, update.data)
        self.assertFalse(
            ClusterCordMembership.objects.filter(cord_id=cord_id, person=b).exists()
        )

    def test_care_summary_and_care_case_cord_field(self):
        a = self._member("care1", status="SEMIACTIVE")
        b = self._member("care2")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Cord Care",
                "members": [a.id, b.id],
                "sub_coordinator_id": b.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        cord_id = create.data["id"]

        MemberCareCase.objects.create(
            person=a,
            details="Needs follow-up",
            case_status=MemberCareCase.CaseStatus.OPEN,
        )

        cords = self.client.get(f"/api/clusters/clusters/{self.cluster.id}/cords/")
        self.assertEqual(cords.status_code, 200)
        cord_row = next(r for r in cords.data if r["id"] == cord_id)
        self.assertEqual(cord_row["care_summary"]["open_count"], 1)
        self.assertEqual(cord_row["care_summary"]["needs_attention_count"], 1)

        care = self.client.get(
            f"/api/people/care-cases/?cluster_id={self.cluster.id}"
        )
        self.assertEqual(care.status_code, 200)
        results = care.data.get("results", care.data)
        row = next(r for r in results if r["person"]["id"] == a.id)
        self.assertIsNotNone(row.get("cord"))
        self.assertEqual(row["cord"]["id"], cord_id)
        self.assertEqual(row["cord"]["name"], "Cord Care")
        self.assertEqual(row["cord"]["sub_coordinator_id"], b.id)

        filtered = self.client.get(
            f"/api/people/care-cases/?cluster_id={self.cluster.id}&cord_id={cord_id}"
        )
        self.assertEqual(filtered.status_code, 200)
        filtered_results = filtered.data.get("results", filtered.data)
        self.assertTrue(any(r["person"]["id"] == a.id for r in filtered_results))

    def test_reporter_cannot_mutate_cords(self):
        a = self._member("rep1")
        self.client.force_authenticate(self.reporter)
        response = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Blocked",
                "members": [a.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertIn(response.status_code, (403, 400))

    def test_coordinator_can_create_cord(self):
        a = self._member("cc1")
        b = self._member("cc2")
        self.client.force_authenticate(self.coordinator)
        response = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Coord Cord",
                "members": [a.id, b.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_invited_visitors_appear_on_cord(self):
        a = self._member("host1")
        b = self._member("host2")
        visitor = Person.objects.create_user(
            username="cordvisitor",
            password="pass12345",
            first_name="Vina",
            last_name="Guest",
            nickname="Vee",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            inviter=a,
        )
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Visitor Cord",
                "members": [a.id, b.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        cords = self.client.get(f"/api/clusters/clusters/{self.cluster.id}/cords/")
        self.assertEqual(cords.status_code, 200)
        cord_row = next(r for r in cords.data if r["id"] == create.data["id"])
        visitor_ids = [v["id"] for v in cord_row.get("invited_visitors", [])]
        self.assertIn(visitor.id, visitor_ids)
        row = next(v for v in cord_row["invited_visitors"] if v["id"] == visitor.id)
        self.assertEqual(row["role"], "VISITOR")
        self.assertTrue(row.get("is_visitor"))
        self.assertEqual(row["inviter_id"], a.id)
        self.assertEqual(row["nickname"], "Vee")

    def test_cluster_members_details_includes_member_cord_not_visitor_inviter(self):
        host = self._member("visithost")
        visitor = Person.objects.create_user(
            username="clustervisitor",
            password="pass12345",
            first_name="Jorge",
            last_name="Estrada",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            inviter=host,
        )
        self.cluster.members.add(visitor)
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Estrada Cord",
                "members": [host.id],
                "sub_coordinator_id": host.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        response = self.client.get(f"/api/clusters/clusters/{self.cluster.id}/")
        self.assertEqual(response.status_code, 200, response.data)
        details = response.data.get("members_details") or []
        visitor_row = next((r for r in details if r["id"] == visitor.id), None)
        host_row = next((r for r in details if r["id"] == host.id), None)
        self.assertIsNotNone(visitor_row)
        self.assertIsNotNone(host_row)
        self.assertEqual(host_row.get("cord_name"), "Estrada Cord")
        # Visitors do not inherit inviter cord on existing roster rows.
        self.assertIsNone(visitor_row.get("cord_id"))
        self.assertIsNone(visitor_row.get("cord_name"))

    def test_eligible_members_marks_assigned(self):
        a = self._member("elig1")
        b = self._member("elig2")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Elig Cord",
                "members": [a.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        response = self.client.get(
            f"/api/clusters/clusters/{self.cluster.id}/cords/eligible-members/"
        )
        self.assertEqual(response.status_code, 200)
        by_id = {row["id"]: row for row in response.data}
        self.assertEqual(by_id[a.id]["assigned_cord_id"], create.data["id"])
        self.assertIsNone(by_id[b.id]["assigned_cord_id"])

    def test_deactivate_clears_memberships(self):
        a = self._member("deact1")
        b = self._member("deact2")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "To Deactivate",
                "members": [a.id, b.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        cord_id = create.data["id"]
        delete = self.client.delete(f"/api/clusters/cords/{cord_id}/")
        self.assertEqual(delete.status_code, 204)
        cord = ClusterCord.objects.get(pk=cord_id)
        self.assertFalse(cord.is_active)
        self.assertEqual(cord.memberships.count(), 0)

    def test_people_list_includes_cord_name(self):
        member = self._member("searchcord", first_name="Brittany", last_name="Hall")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Hall Cord",
                "members": [member.id],
                "sub_coordinator_id": member.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        response = self.client.get(
            "/api/people/people/",
            {"search": "Brittany", "page_size": 5},
        )
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data.get("results", response.data)
        row = next((r for r in results if r["id"] == member.id), None)
        self.assertIsNotNone(row)
        self.assertEqual(row.get("cord_id"), create.data["id"])
        self.assertEqual(row.get("cord_name"), "Hall Cord")
        self.assertIn("CORD-1", row.get("cluster_codes") or [])

    def test_people_retrieve_includes_cord_name(self):
        member = self._member("profilecord", first_name="Pat", last_name="Cord")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Profile Cord",
                "members": [member.id],
                "sub_coordinator_id": member.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        response = self.client.get(f"/api/people/people/{member.id}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data.get("cord_id"), create.data["id"])
        self.assertEqual(response.data.get("cord_name"), "Profile Cord")
        self.assertTrue(response.data.get("cord_locked"))

    def test_visitor_create_stores_intended_cord_without_membership(self):
        host = self._member("intendedhost")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Intended Cord",
                "members": [host.id],
                "sub_coordinator_id": host.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        cord_id = create.data["id"]
        response = self.client.post(
            "/api/people/people/",
            {
                "first_name": "Vina",
                "last_name": "Guest",
                "role": "VISITOR",
                "status": "ONGOING",
                "branch": self.branch.id,
                "cluster_ids": [self.cluster.id],
                "cord_id": cord_id,
                "inviter": host.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        person = Person.objects.get(pk=response.data["id"])
        self.assertEqual(person.intended_cord_id, cord_id)
        self.assertFalse(
            ClusterCordMembership.objects.filter(person=person).exists()
        )
        self.assertEqual(response.data.get("cord_id"), cord_id)
        self.assertEqual(response.data.get("cord_name"), "Intended Cord")
        self.assertFalse(response.data.get("cord_locked"))

    def test_baptism_promotion_applies_intended_cord_membership(self):
        host = self._member("promhost")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Promote Cord",
                "members": [host.id],
                "sub_coordinator_id": host.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        cord_id = create.data["id"]
        visitor = Person.objects.create_user(
            username="promvisitor",
            password="pass12345",
            first_name="Prom",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
            inviter=host,
            intended_cord_id=cord_id,
        )
        self.cluster.members.add(visitor)
        response = self.client.patch(
            f"/api/people/people/{visitor.id}/",
            {"water_baptism_date": date(2024, 6, 15).isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        visitor.refresh_from_db()
        self.assertEqual(visitor.role, "MEMBER")
        self.assertTrue(
            ClusterCordMembership.objects.filter(
                person=visitor, cord_id=cord_id
            ).exists()
        )
        self.assertEqual(response.data.get("cord_id"), cord_id)
        self.assertTrue(response.data.get("cord_locked"))

    def test_cord_locked_ignores_cord_id_write(self):
        a = self._member("locka")
        b = self._member("lockb")
        first = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "First Lock Cord",
                "members": [a.id],
                "sub_coordinator_id": a.id,
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Second Lock Cord",
                "members": [b.id],
                "sub_coordinator_id": b.id,
            },
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)
        response = self.client.patch(
            f"/api/people/people/{a.id}/",
            {"cord_id": second.data["id"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data.get("cord_id"), first.data["id"])
        self.assertTrue(response.data.get("cord_locked"))
        self.assertTrue(
            ClusterCordMembership.objects.filter(
                person=a, cord_id=first.data["id"]
            ).exists()
        )
        self.assertFalse(
            ClusterCordMembership.objects.filter(
                person=a, cord_id=second.data["id"]
            ).exists()
        )

    def test_member_create_with_cord_id_creates_membership(self):
        host = self._member("memhost")
        create = self.client.post(
            f"/api/clusters/clusters/{self.cluster.id}/cords/",
            {
                "name": "Member Cord",
                "members": [host.id],
                "sub_coordinator_id": host.id,
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)
        cord_id = create.data["id"]
        response = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Member",
                "role": "MEMBER",
                "status": "ACTIVE",
                "water_baptism_date": date(2020, 1, 1).isoformat(),
                "branch": self.branch.id,
                "cluster_ids": [self.cluster.id],
                "cord_id": cord_id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        person = Person.objects.get(pk=response.data["id"])
        self.assertEqual(person.intended_cord_id, cord_id)
        self.assertTrue(
            ClusterCordMembership.objects.filter(
                person=person, cord_id=cord_id
            ).exists()
        )
        self.assertTrue(response.data.get("cord_locked"))
