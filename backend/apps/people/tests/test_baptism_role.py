from datetime import date

from rest_framework.test import APITestCase

from apps.people.models import Branch, Person, PersonStatusChange


class BaptismRoleAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTBROLE",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="baproleadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.client.force_authenticate(self.admin)

    def _create_visitor(self, **overrides):
        payload = {
            "username": "bapvisitor",
            "password": "pass12345",
            "first_name": "Viv",
            "last_name": "Visitor",
            "role": "VISITOR",
            "status": "ONGOING",
            "branch": self.branch,
        }
        payload.update(overrides)
        return Person.objects.create_user(**payload)

    def test_setting_water_baptism_date_promotes_visitor_to_member(self):
        visitor = self._create_visitor()
        baptism_date = date(2024, 6, 15)
        response = self.client.patch(
            f"/api/people/people/{visitor.id}/",
            {"water_baptism_date": baptism_date.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        visitor.refresh_from_db()
        self.assertEqual(visitor.role, "MEMBER")
        self.assertEqual(visitor.status, "ACTIVE")
        self.assertEqual(visitor.water_baptism_date, baptism_date)
        change = PersonStatusChange.objects.get(person=visitor)
        self.assertEqual(change.from_status, "ONGOING")
        self.assertEqual(change.to_status, "ACTIVE")
        self.assertEqual(change.source, PersonStatusChange.Source.SYSTEM)
        self.assertEqual(change.reason, "Status set after water baptism.")

    def test_saving_visitor_who_already_has_baptism_date_promotes(self):
        visitor = self._create_visitor()
        Person.objects.filter(pk=visitor.pk).update(
            water_baptism_date=date(2024, 1, 12)
        )
        visitor.refresh_from_db()
        self.assertEqual(visitor.role, "VISITOR")

        response = self.client.patch(
            f"/api/people/people/{visitor.id}/",
            {"nickname": "Vivi"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        visitor.refresh_from_db()
        self.assertEqual(visitor.role, "MEMBER")
        self.assertEqual(visitor.status, "ACTIVE")
        self.assertEqual(visitor.nickname, "Vivi")

    def test_patch_visitor_role_rejected_while_baptism_date_is_set(self):
        member = Person.objects.create_user(
            username="baptizedmember",
            password="pass12345",
            first_name="Mel",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2023, 4, 1),
        )
        response = self.client.patch(
            f"/api/people/people/{member.id}/",
            {"role": "VISITOR"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        member.refresh_from_db()
        self.assertEqual(member.role, "MEMBER")
        self.assertEqual(member.status, "ACTIVE")

    def test_clearing_baptism_date_demotes_member_to_visitor(self):
        member = Person.objects.create_user(
            username="clearmember",
            password="pass12345",
            first_name="Cal",
            last_name="Clear",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            date_first_attended=date(2024, 2, 1),
            water_baptism_date=date(2024, 3, 1),
        )
        response = self.client.patch(
            f"/api/people/people/{member.id}/",
            {"water_baptism_date": None},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        member.refresh_from_db()
        self.assertEqual(member.role, "VISITOR")
        self.assertEqual(member.status, "ONGOING")
        self.assertIsNone(member.water_baptism_date)
        change = PersonStatusChange.objects.filter(
            person=member,
            source=PersonStatusChange.Source.SYSTEM,
        ).first()
        self.assertIsNotNone(change)
        self.assertEqual(change.to_status, "ONGOING")
        self.assertEqual(
            change.reason,
            "Status set after water baptism date was cleared.",
        )

    def test_pastor_and_admin_keep_role_when_baptism_date_is_set(self):
        pastor = Person.objects.create_user(
            username="bappastor",
            password="pass12345",
            first_name="Pat",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.branch,
        )
        other_admin = Person.objects.create_user(
            username="bapotheradmin",
            password="pass12345",
            first_name="Other",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        baptism_date = date(2024, 8, 20)
        pastor_response = self.client.patch(
            f"/api/people/people/{pastor.id}/",
            {"water_baptism_date": baptism_date.isoformat()},
            format="json",
        )
        admin_response = self.client.patch(
            f"/api/people/people/{other_admin.id}/",
            {"water_baptism_date": baptism_date.isoformat()},
            format="json",
        )
        self.assertEqual(pastor_response.status_code, 200, pastor_response.data)
        self.assertEqual(admin_response.status_code, 200, admin_response.data)
        pastor.refresh_from_db()
        other_admin.refresh_from_db()
        self.assertEqual(pastor.role, "PASTOR")
        self.assertEqual(other_admin.role, "ADMIN")
        self.assertEqual(pastor.water_baptism_date, baptism_date)
        self.assertEqual(other_admin.water_baptism_date, baptism_date)

    def test_create_visitor_with_baptism_date_becomes_member(self):
        response = self.client.post(
            "/api/people/people/",
            {
                "first_name": "New",
                "last_name": "Baptized",
                "role": "VISITOR",
                "status": "ONGOING",
                "branch": self.branch.id,
                "water_baptism_date": date(2024, 9, 1).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["role"], "MEMBER")
        self.assertEqual(response.data["status"], "ACTIVE")
        created = Person.objects.get(pk=response.data["id"])
        self.assertEqual(created.role, "MEMBER")
        self.assertEqual(created.status, "ACTIVE")

    def test_create_member_without_baptism_coerces_to_visitor(self):
        response = self.client.post(
            "/api/people/people/",
            {
                "first_name": "No",
                "last_name": "Baptism",
                "role": "MEMBER",
                "status": "ACTIVE",
                "branch": self.branch.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["role"], "VISITOR")
        self.assertEqual(response.data["status"], "NO_RESPONSE")
        created = Person.objects.get(pk=response.data["id"])
        self.assertEqual(created.role, "VISITOR")
        self.assertEqual(created.status, "NO_RESPONSE")

    def test_create_member_without_baptism_with_attendance_uses_ongoing(self):
        response = self.client.post(
            "/api/people/people/",
            {
                "first_name": "Attended",
                "last_name": "NoBap",
                "role": "MEMBER",
                "status": "ACTIVE",
                "branch": self.branch.id,
                "date_first_attended": date(2024, 5, 1).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["role"], "VISITOR")
        self.assertEqual(response.data["status"], "ONGOING")

    def test_patch_member_role_without_baptism_coerces_to_visitor(self):
        visitor = self._create_visitor(date_first_attended=date(2024, 1, 10))
        response = self.client.patch(
            f"/api/people/people/{visitor.id}/",
            {"role": "MEMBER", "status": "ACTIVE"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        visitor.refresh_from_db()
        self.assertEqual(visitor.role, "VISITOR")
        self.assertEqual(visitor.status, "ONGOING")

    def test_orm_create_member_without_baptism_demotes_to_visitor(self):
        person = Person.objects.create_user(
            username="ormmember",
            password="pass12345",
            first_name="Orm",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        person.refresh_from_db()
        self.assertEqual(person.role, "VISITOR")
        self.assertEqual(person.status, "NO_RESPONSE")
