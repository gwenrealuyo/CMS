from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Branch, Person


class PersonInviterDisplayNameAPITests(TestCase):
    """Person retrieve includes a read-only inviter display name for profiles."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name="Inviter Branch",
            code="INV_BR",
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="inv_admin",
            email="inv_admin@test.com",
            password="testpass123",
            first_name="Inv",
            last_name="Admin",
            role="ADMIN",
            branch=self.branch,
            status="ACTIVE",
        )
        self.inviter = Person.objects.create_user(
            username="inviter_member",
            email="inviter_member@test.com",
            password="testpass123",
            first_name="Jane",
            middle_name="Marie",
            nickname="Jay",
            last_name="Inviter",
            role="MEMBER",
            branch=self.branch,
            status="ACTIVE",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_retrieve_includes_inviter_display_name(self):
        visitor = Person.objects.create_user(
            username="invited_visitor",
            email="invited_visitor@test.com",
            password="testpass123",
            first_name="Invited",
            last_name="Visitor",
            role="VISITOR",
            branch=self.branch,
            status="ONGOING",
            inviter=self.inviter,
        )

        response = self.client.get(f"/api/people/people/{visitor.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["inviter"], self.inviter.id)
        self.assertEqual(
            response.data["inviter_display_name"], 'Jane "Jay" M. Inviter'
        )

    def test_retrieve_without_inviter_returns_null_display_name(self):
        visitor = Person.objects.create_user(
            username="no_inviter_visitor",
            email="no_inviter_visitor@test.com",
            password="testpass123",
            first_name="Solo",
            last_name="Visitor",
            role="VISITOR",
            branch=self.branch,
            status="ONGOING",
        )

        response = self.client.get(f"/api/people/people/{visitor.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsNone(response.data["inviter"])
        self.assertIsNone(response.data["inviter_display_name"])
