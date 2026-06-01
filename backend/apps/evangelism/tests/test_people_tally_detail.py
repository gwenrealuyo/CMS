from datetime import datetime

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.people.models import Person


class PeopleTallyDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin_tally",
            password="password123",
            first_name="Admin",
            last_name="Tally",
            role="ADMIN",
            status="ACTIVE",
        )
        self.client.force_authenticate(user=self.admin)

    def test_invited_drilldown_coerces_date_joined_datetime(self):
        joined = timezone.make_aware(datetime(2026, 3, 15, 14, 30, 0))
        Person.objects.create_user(
            username="invited_visitor",
            password="password123",
            first_name="Invited",
            last_name="Visitor",
            role="VISITOR",
            status="INVITED",
            date_joined=joined,
        )

        response = self.client.get(
            "/api/evangelism/weekly-reports/people_tally_detail/",
            {"year": 2026, "month": 3, "metric": "invited"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["event_date"], "2026-03-15")
