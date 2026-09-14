from datetime import date

from rest_framework.test import APITestCase

from apps.evangelism.models import Conversion
from apps.lessons.services import ensure_lesson_enrollment
from apps.people.models import Branch, Person


class ConversionNccTeacherAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(
            name="Muntinlupa",
            code="MUNTCONVNCC",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="convnccadmin",
            password="pass12345",
            first_name="Ada",
            last_name="Admin",
            role="ADMIN",
            status="ACTIVE",
            branch=self.branch,
        )
        self.teacher = Person.objects.create_user(
            username="convnccteacher",
            password="pass12345",
            first_name="Tessa",
            last_name="Teacher",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
        )
        self.student = Person.objects.create_user(
            username="convnccstudent",
            password="pass12345",
            first_name="Sam",
            last_name="Student",
            role="VISITOR",
            status="ONGOING",
            branch=self.branch,
        )
        self.client.force_authenticate(self.admin)

    def test_conversion_person_includes_ncc_teacher_display_name(self):
        ensure_lesson_enrollment(
            self.student, self.teacher, assigned_by=self.admin
        )
        conversion = Conversion.objects.create(
            person=self.student,
            converted_by=self.admin,
            conversion_date=date(2026, 9, 1),
        )

        response = self.client.get(f"/api/evangelism/conversions/{conversion.id}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("Tessa", response.data["person"]["lesson_teacher_display_name"])

    def test_conversion_person_ncc_teacher_is_null_without_enrollment(self):
        conversion = Conversion.objects.create(
            person=self.student,
            converted_by=self.admin,
            conversion_date=date(2026, 9, 1),
        )

        response = self.client.get(f"/api/evangelism/conversions/{conversion.id}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["person"]["lesson_teacher_display_name"])
