from datetime import date

from rest_framework.test import APITestCase

from apps.people.models import Branch, Journey, Person
from core.datetime_utils import church_today


class BaptismVerifierAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTBAP",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="bapadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.baptizer = Person.objects.create_user(
            username="baptizer",
            password="pass12345",
            first_name="Ben",
            last_name="Baptizer",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
        )
        self.witness = Person.objects.create_user(
            username="hgwitness",
            password="pass12345",
            first_name="Willa",
            last_name="Witness",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="bapmember",
            password="pass12345",
            first_name="Mel",
            last_name="Member",
            role="MEMBER",
            water_baptism_date=date(2020, 1, 1),
            status="ACTIVE",
            branch=self.branch,
        )
        self.client.force_authenticate(self.admin)

    def _error_details(self, response):
        if isinstance(response.data, dict) and "details" in response.data:
            return response.data["details"]
        return response.data

    def test_setting_water_baptism_date_allows_unknown_baptizer(self):
        baptism_date = church_today()
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"water_baptism_date": baptism_date.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["baptized_by"])
        self.assertIsNone(response.data["baptized_by_display_name"])
        journey = Journey.objects.get(user=self.member, type="BAPTISM")
        self.assertIsNone(journey.verified_by_id)
        self.assertEqual(journey.date, baptism_date)

    def test_setting_spirit_baptism_date_allows_unknown_witness(self):
        hg_date = church_today()
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"spirit_baptism_date": hg_date.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["hg_witnessed_by"])
        self.assertIsNone(response.data["hg_witnessed_by_display_name"])
        journey = Journey.objects.get(user=self.member, type="SPIRIT")
        self.assertIsNone(journey.verified_by_id)
        self.assertEqual(journey.date, hg_date)

    def test_water_baptism_with_baptizer_creates_journey(self):
        baptism_date = date(2024, 6, 15)
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "water_baptism_date": baptism_date.isoformat(),
                "baptized_by": self.baptizer.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(str(response.data["baptized_by"]), str(self.baptizer.id))
        self.assertIn("Ben", response.data["baptized_by_display_name"] or "")
        journey = Journey.objects.get(user=self.member, type="BAPTISM")
        self.assertEqual(journey.verified_by_id, self.baptizer.id)
        self.assertEqual(journey.date, baptism_date)

    def test_visitor_cannot_be_baptizer_or_witness(self):
        visitor = Person.objects.create_user(
            username="bapvisitor",
            password="pass12345",
            first_name="Vic",
            last_name="Visitor",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        baptism_date = date(2024, 6, 15)
        baptizer_response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "water_baptism_date": baptism_date.isoformat(),
                "baptized_by": visitor.id,
            },
            format="json",
        )
        self.assertEqual(baptizer_response.status_code, 400, baptizer_response.data)
        self.assertIn("baptized_by", self._error_details(baptizer_response))

        witness_response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "spirit_baptism_date": baptism_date.isoformat(),
                "hg_witnessed_by": visitor.id,
            },
            format="json",
        )
        self.assertEqual(witness_response.status_code, 400, witness_response.data)
        self.assertIn("hg_witnessed_by", self._error_details(witness_response))

    def test_spirit_baptism_with_witness_creates_journey(self):
        hg_date = date(2024, 7, 20)
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "spirit_baptism_date": hg_date.isoformat(),
                "hg_witnessed_by": self.witness.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(str(response.data["hg_witnessed_by"]), str(self.witness.id))
        self.assertIn("Willa", response.data["hg_witnessed_by_display_name"] or "")
        journey = Journey.objects.get(user=self.member, type="SPIRIT")
        self.assertEqual(journey.verified_by_id, self.witness.id)
        self.assertEqual(journey.date, hg_date)

    def test_clearing_baptizer_marks_unknown(self):
        baptism_date = date(2024, 6, 15)
        self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "water_baptism_date": baptism_date.isoformat(),
                "baptized_by": self.baptizer.id,
            },
            format="json",
        )
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"baptized_by": None},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["baptized_by"])
        self.assertIsNone(
            Journey.objects.get(user=self.member, type="BAPTISM").verified_by_id
        )

    def test_existing_baptism_without_verifier_can_be_patched_unrelated(self):
        self.member.water_baptism_date = date(2023, 1, 1)
        self.member.save(update_fields=["water_baptism_date"])
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"nickname": "Melly"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["nickname"], "Melly")

    def test_baptism_journey_create_allows_unknown_verifier(self):
        response = self.client.post(
            "/api/people/journeys/",
            {
                "user": self.member.id,
                "date": church_today().isoformat(),
                "type": "BAPTISM",
                "title": "Baptized in Jesus' name",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["verified_by"])
        self.assertIsNone(response.data["verified_by_display_name"])

    def test_spirit_journey_create_with_verified_by(self):
        response = self.client.post(
            "/api/people/journeys/",
            {
                "user": self.member.id,
                "date": church_today().isoformat(),
                "type": "SPIRIT",
                "title": "Received the Holy Ghost",
                "verified_by": self.witness.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(str(response.data["verified_by"]), str(self.witness.id))
        self.assertIn("Willa", response.data["verified_by_display_name"] or "")

    def test_note_journey_does_not_require_verified_by(self):
        response = self.client.post(
            "/api/people/journeys/",
            {
                "user": self.member.id,
                "date": church_today().isoformat(),
                "type": "NOTE",
                "title": "A note",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_historical_baptizer_names_without_directory_person(self):
        baptism_date = date(2024, 9, 1)
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "water_baptism_date": baptism_date.isoformat(),
                "baptized_by": None,
                "baptized_by_first_name": "former",
                "baptized_by_last_name": "pastor",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["baptized_by"])
        self.assertEqual(response.data["baptized_by_first_name"], "Former")
        self.assertEqual(response.data["baptized_by_last_name"], "Pastor")
        self.assertEqual(response.data["baptized_by_display_name"], "Former Pastor")
        journey = Journey.objects.get(user=self.member, type="BAPTISM")
        self.assertIsNone(journey.verified_by_id)
        self.assertEqual(journey.historical_verified_first_name, "Former")
        self.assertEqual(journey.historical_verified_last_name, "Pastor")

    def test_historical_baptizer_requires_both_names(self):
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "water_baptism_date": church_today().isoformat(),
                "baptized_by_first_name": "Former",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("baptized_by_first_name", self._error_details(response))

    def test_live_baptizer_clears_historical_names(self):
        baptism_date = date(2024, 9, 2)
        self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {
                "water_baptism_date": baptism_date.isoformat(),
                "baptized_by_first_name": "Former",
                "baptized_by_last_name": "Pastor",
            },
            format="json",
        )
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"baptized_by": self.baptizer.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(str(response.data["baptized_by"]), str(self.baptizer.id))
        self.assertEqual(response.data["baptized_by_first_name"], "")
        self.assertEqual(response.data["baptized_by_last_name"], "")
        self.assertIn("Ben", response.data["baptized_by_display_name"] or "")
        journey = Journey.objects.get(user=self.member, type="BAPTISM")
        self.assertEqual(journey.verified_by_id, self.baptizer.id)
        self.assertEqual(journey.historical_verified_first_name, "")
        self.assertEqual(journey.historical_verified_last_name, "")

    def test_journey_create_with_historical_verifier_names(self):
        response = self.client.post(
            "/api/people/journeys/",
            {
                "user": self.member.id,
                "date": church_today().isoformat(),
                "type": "BAPTISM",
                "title": "Baptized in Jesus' name",
                "historical_verified_first_name": "Legacy",
                "historical_verified_last_name": "Minister",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data["verified_by"])
        self.assertEqual(response.data["verified_by_display_name"], "Legacy Minister")
        self.assertEqual(response.data["historical_verified_first_name"], "Legacy")
        self.assertEqual(response.data["historical_verified_last_name"], "Minister")
