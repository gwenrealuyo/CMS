from django.test import SimpleTestCase

from apps.people.name_formatting import (
    apply_title_case_name_fields,
    title_case_name,
)


class TitleCaseNameTests(SimpleTestCase):
    def test_title_cases_words_and_hyphens(self):
        self.assertEqual(title_case_name("juan dela cruz"), "Juan dela Cruz")
        self.assertEqual(title_case_name("MARY-JANE"), "Mary-Jane")
        self.assertEqual(title_case_name("  bob  "), "Bob")

    def test_particles_and_mc_mac(self):
        self.assertEqual(title_case_name("de la cruz"), "de la Cruz")
        self.assertEqual(title_case_name("DE LA CRUZ"), "de la Cruz")
        self.assertEqual(title_case_name("mcdonald"), "McDonald")
        self.assertEqual(title_case_name("MACKENZIE"), "MacKenzie")

    def test_preserves_mixed_case(self):
        self.assertEqual(title_case_name("McDonald"), "McDonald")
        self.assertEqual(title_case_name("de la Cruz"), "de la Cruz")
        self.assertEqual(title_case_name("MacArthur"), "MacArthur")

    def test_preserves_roman_numeral_suffixes(self):
        self.assertEqual(title_case_name("iii"), "III")
        self.assertEqual(title_case_name("smith iii"), "Smith III")

    def test_blank_and_none(self):
        self.assertEqual(title_case_name(""), "")
        self.assertEqual(title_case_name(None), "")
        self.assertEqual(title_case_name("   "), "")

    def test_apply_to_attrs(self):
        attrs = {
            "first_name": "juan",
            "last_name": "SANTOS",
            "maiden_name": "dela cruz",
            "role": "MEMBER",
        }
        apply_title_case_name_fields(attrs)
        self.assertEqual(attrs["first_name"], "Juan")
        self.assertEqual(attrs["last_name"], "Santos")
        self.assertEqual(attrs["maiden_name"], "dela Cruz")
        self.assertEqual(attrs["role"], "MEMBER")
