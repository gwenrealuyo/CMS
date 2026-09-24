from datetime import date

from rest_framework.test import APITestCase

from apps.people.models import Branch, ModuleCoordinator, Person


class PersonRoleAssignmentAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTROLE",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="roleadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.pastor = Person.objects.create_user(
            username="rolepastor",
            password="pass12345",
            first_name="Pat",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.branch,
        )
        self.other_pastor = Person.objects.create_user(
            username="rolepastor2",
            password="pass12345",
            first_name="Paula",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="rolemember",
            password="pass12345",
            first_name="Mel",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        self.coord = Person.objects.create_user(
            username="rolecoord",
            password="pass12345",
            first_name="Cora",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )
        ModuleCoordinator.objects.create(
            person=self.coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
        )

    def _error_details(self, response):
        if isinstance(response.data, dict) and "details" in response.data:
            return response.data["details"]
        return response.data

    def _create_payload(self, **overrides):
        payload = {
            "first_name": "New",
            "last_name": "Person",
            "role": "MEMBER",
            "status": "ACTIVE",
            "branch": self.branch.id,
        }
        payload.update(overrides)
        return payload

    def test_admin_can_create_pastor(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/people/people/",
            self._create_payload(role="PASTOR", first_name="Nora"),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["role"], "PASTOR")

    def test_admin_can_promote_member_to_pastor(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"role": "PASTOR"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, "PASTOR")

    def test_pastor_cannot_create_pastor(self):
        self.client.force_authenticate(self.pastor)
        response = self.client.post(
            "/api/people/people/",
            self._create_payload(role="PASTOR"),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("role", self._error_details(response))

    def test_pastor_cannot_promote_member_to_pastor(self):
        self.client.force_authenticate(self.pastor)
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"role": "PASTOR"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("role", self._error_details(response))
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, "MEMBER")

    def test_pastor_can_update_another_pastor_without_changing_role(self):
        self.client.force_authenticate(self.pastor)
        response = self.client.patch(
            f"/api/people/people/{self.other_pastor.id}/",
            {"role": "PASTOR", "nickname": "Pau"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.other_pastor.refresh_from_db()
        self.assertEqual(self.other_pastor.role, "PASTOR")
        self.assertEqual(self.other_pastor.nickname, "Pau")

    def test_cluster_coordinator_cannot_assign_pastor(self):
        self.client.force_authenticate(self.coord)
        create_response = self.client.post(
            "/api/people/people/",
            self._create_payload(role="PASTOR"),
            format="json",
        )
        self.assertEqual(create_response.status_code, 400, create_response.data)
        self.assertIn("role", self._error_details(create_response))

        patch_response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"role": "PASTOR"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 400, patch_response.data)
        self.assertIn("role", self._error_details(patch_response))
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, "MEMBER")
