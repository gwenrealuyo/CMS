from rest_framework.test import APITestCase

from apps.people.models import Branch, Person
from datetime import date


class MemberIdFilterAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTLAMP",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="lampadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
            member_id="LAMP100",
        )
        self.with_id = Person.objects.create_user(
            username="lampwithid",
            password="pass12345",
            first_name="With",
            last_name="LampId",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
            member_id="LAMP12345",
        )
        self.without_id = Person.objects.create_user(
            username="lampwithoutid",
            password="pass12345",
            first_name="No",
            last_name="LampId",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
            member_id="",
        )
        self.other_id = Person.objects.create_user(
            username="lampotherid",
            password="pass12345",
            first_name="Other",
            last_name="LampId",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
            member_id="LAMP99999",
        )
        self.client.force_authenticate(user=self.admin)

    def _list_ids(self, **params):
        response = self.client.get(
            "/api/people/people/",
            {**params, "has_name": "true", "page_size": 100},
        )
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data.get("results", response.data)
        return {row["id"] for row in results}

    def test_has_member_id_false_returns_people_without_lamp_id(self):
        ids = self._list_ids(has_member_id="false")
        self.assertIn(self.without_id.id, ids)
        self.assertNotIn(self.with_id.id, ids)
        self.assertNotIn(self.other_id.id, ids)

    def test_has_member_id_true_returns_people_with_lamp_id(self):
        ids = self._list_ids(has_member_id="true")
        self.assertIn(self.with_id.id, ids)
        self.assertIn(self.other_id.id, ids)
        self.assertNotIn(self.without_id.id, ids)

    def test_member_id_exact_match(self):
        ids = self._list_ids(member_id="LAMP12345")
        self.assertEqual(ids, {self.with_id.id})

    def test_member_id_icontains(self):
        ids = self._list_ids(member_id__icontains="123")
        self.assertIn(self.with_id.id, ids)
        self.assertNotIn(self.other_id.id, ids)
        self.assertNotIn(self.without_id.id, ids)
