from rest_framework.test import APITestCase

from apps.people.models import Branch, Person


class PersonLastUpdatedByAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTUPD",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="updadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.pastor = Person.objects.create_user(
            username="updpastor",
            password="pass12345",
            first_name="Pat",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="updmember",
            password="pass12345",
            first_name="Mel",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )

    def test_admin_retrieve_includes_last_editor_after_update(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"nickname": "Melly"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["updated_by"], self.admin.id)
        self.assertEqual(response.data["updated_by_name"], "Ada Admin")
        self.assertTrue(response.data["updated_at"])

        self.member.refresh_from_db()
        self.assertEqual(self.member.updated_by_id, self.admin.id)
        self.assertIsNotNone(self.member.updated_at)

    def test_non_admin_cannot_see_last_editor(self):
        self.member.updated_by = self.admin
        self.member.save(update_fields=["updated_by"])

        self.client.force_authenticate(self.pastor)
        response = self.client.get(f"/api/people/people/{self.member.id}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn("updated_by", response.data)
        self.assertNotIn("updated_by_name", response.data)
        self.assertNotIn("updated_at", response.data)

    def test_editor_is_the_authenticated_user_not_a_spoofed_id(self):
        self.client.force_authenticate(self.pastor)
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"nickname": "Melly", "updated_by": self.admin.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn("updated_by", response.data)

        self.member.refresh_from_db()
        self.assertEqual(self.member.nickname, "Melly")
        self.assertEqual(self.member.updated_by_id, self.pastor.id)

        self.client.force_authenticate(self.admin)
        admin_view = self.client.get(f"/api/people/people/{self.member.id}/")
        self.assertEqual(admin_view.status_code, 200, admin_view.data)
        self.assertEqual(admin_view.data["updated_by"], self.pastor.id)
        self.assertEqual(admin_view.data["updated_by_name"], "Pat Pastor")

    def test_create_stamps_the_creator_for_admins(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Visitor",
                "role": "VISITOR",
                "status": "ONGOING",
                "branch": self.branch.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["updated_by"], self.admin.id)
        self.assertEqual(response.data["updated_by_name"], "Ada Admin")
        created = Person.objects.get(pk=response.data["id"])
        self.assertEqual(created.updated_by_id, self.admin.id)
