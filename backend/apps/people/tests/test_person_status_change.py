from unittest.mock import patch

from rest_framework.test import APITestCase

from apps.people.models import (
    Branch,
    Journey,
    PeopleAutomationSetting,
    Person,
    PersonStatusChange,
)
from apps.people.utils import update_person_status


class PersonStatusChangeAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTSTAT",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="statusadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="statusmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.client.force_authenticate(self.admin)

    def _patch_member(self, **payload):
        return self.client.patch(
            f"/api/people/people/{self.member.id}/",
            payload,
            format="json",
        )

    def _error_details(self, response):
        if isinstance(response.data, dict) and "details" in response.data:
            return response.data["details"]
        return response.data

    def test_dormant_without_reason_is_rejected(self):
        response = self._patch_member(status="DORMANT")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("status_change_reason", self._error_details(response))
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, "ACTIVE")
        self.assertFalse(PersonStatusChange.objects.filter(person=self.member).exists())

    def test_blank_reason_rejected_for_inactive(self):
        response = self._patch_member(status="INACTIVE", status_change_reason="   ")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("status_change_reason", self._error_details(response))

    def test_manual_dormant_creates_change_and_journey(self):
        response = self._patch_member(
            status="DORMANT",
            status_change_reason="Moved to the province for work.",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, "DORMANT")

        change = PersonStatusChange.objects.get(person=self.member)
        self.assertEqual(change.from_status, "ACTIVE")
        self.assertEqual(change.to_status, "DORMANT")
        self.assertEqual(change.reason, "Moved to the province for work.")
        self.assertEqual(change.source, PersonStatusChange.Source.MANUAL)
        self.assertEqual(change.changed_by_id, self.admin.id)
        self.assertTrue(change.needs_follow_up)

        latest = response.data.get("latest_status_change")
        self.assertIsNotNone(latest)
        self.assertEqual(latest["reason"], "Moved to the province for work.")
        self.assertEqual(latest["source"], "MANUAL")
        self.assertTrue(latest["needs_follow_up"])

        journey = Journey.objects.get(user=self.member, type="NOTE")
        self.assertTrue(journey.title.startswith("Status Update:"))
        self.assertIn("DORMANT", journey.title)
        self.assertEqual(journey.description, "Moved to the province for work.")

    def test_semiactive_requires_reason(self):
        response = self._patch_member(status="SEMIACTIVE")
        self.assertEqual(response.status_code, 400, response.data)
        response = self._patch_member(
            status="SEMIACTIVE",
            status_change_reason="Irregular clustering this month.",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, "SEMIACTIVE")

    def test_active_reason_is_optional(self):
        self.member.status = "INACTIVE"
        self.member.save(update_fields=["status"])
        response = self._patch_member(status="ACTIVE")
        self.assertEqual(response.status_code, 200, response.data)
        change = PersonStatusChange.objects.get(person=self.member)
        self.assertEqual(change.to_status, "ACTIVE")
        self.assertEqual(change.reason, "")
        self.assertFalse(change.needs_follow_up)

    def test_unchanged_status_does_not_require_reason(self):
        response = self._patch_member(first_name="Minerva", status="ACTIVE")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(PersonStatusChange.objects.filter(person=self.member).exists())

    def test_list_omits_latest_status_change(self):
        self._patch_member(
            status="FALLAWAY",
            status_change_reason="Left fellowship.",
        )
        response = self.client.get("/api/people/people/")
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data.get("results", response.data)
        member_row = next(
            row for row in results if str(row["id"]) == str(self.member.id)
        )
        self.assertNotIn("latest_status_change", member_row)

    @patch(
        "apps.people.utils.calculate_person_attendance_status",
        return_value="INACTIVE",
    )
    def test_auto_calc_logs_attendance_source(self, _mock):
        PeopleAutomationSetting.get_solo()
        updated = update_person_status(self.member)
        self.assertTrue(updated)
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, "INACTIVE")

        change = PersonStatusChange.objects.get(person=self.member)
        self.assertEqual(change.source, PersonStatusChange.Source.AUTO_ATTENDANCE)
        self.assertIsNone(change.changed_by)
        self.assertIn("attendance patterns", change.reason)
        self.assertTrue(change.needs_follow_up)

        journey = Journey.objects.get(user=self.member, type="NOTE")
        self.assertIn("INACTIVE", journey.title)

    @patch(
        "apps.people.utils.calculate_person_attendance_status",
        return_value="ACTIVE",
    )
    def test_auto_calc_does_not_overwrite_dormant(self, _mock):
        self.member.status = "DORMANT"
        self.member.save(update_fields=["status"])
        self.assertFalse(update_person_status(self.member))
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, "DORMANT")
        self.assertFalse(PersonStatusChange.objects.filter(person=self.member).exists())

    @patch(
        "apps.people.utils.calculate_person_attendance_status",
        return_value="ACTIVE",
    )
    def test_auto_calc_does_not_overwrite_fallaway(self, _mock):
        self.member.status = "FALLAWAY"
        self.member.save(update_fields=["status"])
        self.assertFalse(update_person_status(self.member))
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, "FALLAWAY")
