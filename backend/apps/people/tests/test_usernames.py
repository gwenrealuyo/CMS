from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase

from apps.people.models import Person
from apps.people.usernames import (
    generate_unique_username,
    normalize_and_validate_username,
    suggested_username,
)


class SuggestedUsernameTests(SimpleTestCase):
    def test_strips_parentheses_and_spaces(self):
        self.assertEqual(suggested_username("Dominic", "(Angono)"), "doangono")
        self.assertEqual(suggested_username("Jane", "Doe"), "jadoe")
        self.assertEqual(suggested_username("Mary Jane", "de la Cruz"), "madelacruz")

    def test_lowercases(self):
        self.assertEqual(suggested_username("JANE", "DOE"), "jadoe")


class GenerateUniqueUsernameTests(TestCase):
    def test_appends_counter_when_taken(self):
        Person.objects.create_user(
            username="jadoe",
            email="one@test.com",
            password="x",
            first_name="Jane",
            last_name="Doe",
            role="MEMBER",
            status="ACTIVE",
        )
        self.assertEqual(generate_unique_username("Jane", "Doe"), "jadoe1")

    def test_skips_reserved_admin(self):
        self.assertEqual(generate_unique_username("Ad", "min"), "admin1")


class NormalizeUsernameTests(TestCase):
    def test_rejects_blank_and_reserved(self):
        with self.assertRaises(ValidationError):
            normalize_and_validate_username("  ")
        with self.assertRaises(ValidationError):
            normalize_and_validate_username("admin")

    def test_rejects_invalid_chars(self):
        with self.assertRaises(ValidationError):
            normalize_and_validate_username("do(angono)")

    def test_normalizes_case_and_checks_unique(self):
        person = Person.objects.create_user(
            username="jadoe",
            email="one@test.com",
            password="x",
            first_name="Jane",
            last_name="Doe",
            role="MEMBER",
            status="ACTIVE",
        )
        self.assertEqual(
            normalize_and_validate_username("JaDoe", exclude_pk=person.pk),
            "jadoe",
        )
        with self.assertRaises(ValidationError):
            normalize_and_validate_username("jadoe")
