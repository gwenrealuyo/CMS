from rest_framework.test import APITestCase

from apps.people.models import Branch, Person
from apps.people.name_formatting import (
    format_person_display_name,
    nickname_matches_first_name,
)


class FormatPersonDisplayNameTests(APITestCase):
    def test_nickname_replaces_first_name_without_quotes(self):
        person = Person(
            first_name="Juan",
            nickname="Jun",
            middle_name="Dela",
            last_name="Cruz",
            suffix="Jr.",
        )
        self.assertEqual(format_person_display_name(person), "Jun D. Cruz Jr.")

    def test_falls_back_to_first_name_when_nickname_blank(self):
        person = Person(
            first_name="Juan",
            nickname="",
            middle_name="Dela",
            last_name="Cruz",
        )
        self.assertEqual(format_person_display_name(person), "Juan D. Cruz")

    def test_redundant_nickname_still_shows_one_given_name(self):
        person = Person(
            first_name="Juan",
            nickname="Juan",
            last_name="Cruz",
        )
        self.assertEqual(format_person_display_name(person), "Juan Cruz")

    def test_username_fallback(self):
        person = Person(username="lonelyuser")
        self.assertEqual(format_person_display_name(person), "lonelyuser")

    def test_person_get_full_name_uses_display_formatter(self):
        person = Person(
            username="junuser",
            first_name="Juan",
            nickname="Jun",
            middle_name="Dela",
            last_name="Cruz",
        )
        self.assertEqual(person.get_full_name(), "Jun D. Cruz")


class NicknameMatchesFirstNameTests(APITestCase):
    def test_case_and_whitespace_insensitive(self):
        self.assertTrue(nickname_matches_first_name("Juan", "juan"))
        self.assertTrue(nickname_matches_first_name(" Juan ", "  JUAN "))
        self.assertFalse(nickname_matches_first_name("Christopher", "Chris"))
        self.assertFalse(nickname_matches_first_name("Juan", ""))
        self.assertFalse(nickname_matches_first_name("", "Juan"))


class NicknameValidationAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTNICK",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="nickadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.member = Person.objects.create_user(
            username="nickmember",
            password="pass12345",
            first_name="Juan",
            last_name="Cruz",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.client.force_authenticate(self.admin)

    def test_patch_nickname_equal_to_first_name_rejected(self):
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"nickname": "  juan  "},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details", response.data)
        self.assertIn("nickname", details)

    def test_patch_distinct_nickname_accepted(self):
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"nickname": "jun"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.nickname, "Jun")

    def test_patch_blank_nickname_accepted(self):
        self.member.nickname = "Jun"
        self.member.save(update_fields=["nickname"])
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"nickname": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.nickname, "")

    def test_patch_without_nickname_ok_even_if_stored_matches_first(self):
        Person.objects.filter(pk=self.member.pk).update(nickname="Juan")
        response = self.client.patch(
            f"/api/people/people/{self.member.id}/",
            {"phone": "09171234567"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_create_with_nickname_equal_to_first_name_rejected(self):
        response = self.client.post(
            "/api/people/people/",
            {
                "first_name": "Maria",
                "last_name": "Santos",
                "nickname": "Maria",
                "role": "MEMBER",
                "status": "ACTIVE",
                "branch": self.branch.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        details = response.data.get("details", response.data)
        self.assertIn("nickname", details)
