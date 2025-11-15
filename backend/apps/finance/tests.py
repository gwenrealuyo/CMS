from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Pledge, PledgeContribution


class PledgeContributionModelTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="tester",
            email="tester@example.com",
            password="password123",
        )
        self.pledge = Pledge.objects.create(
            pledger=self.user,
            pledge_title="Building Fund",
            pledge_amount=Decimal("1000.00"),
            amount_received=Decimal("0.00"),
            start_date=timezone.now().date(),
        )

    def test_contribution_updates_amount_and_balance(self):
        PledgeContribution.objects.create(
            pledge=self.pledge,
            amount=Decimal("150.00"),
            contribution_date=timezone.now().date(),
        )

        self.pledge.refresh_from_db()
        self.assertEqual(
            self.pledge.effective_amount_received(), Decimal("150.00")
        )
        self.assertEqual(self.pledge.balance, Decimal("850.00"))

        self.pledge.refresh_amount_received()
        self.pledge.refresh_from_db()
        self.assertEqual(self.pledge.amount_received, Decimal("150.00"))

    def test_effective_amount_received_falls_back_to_field(self):
        self.pledge.amount_received = Decimal("200.00")
        self.pledge.save()

        self.assertEqual(
            self.pledge.effective_amount_received(), Decimal("200.00")
        )


class PledgeContributionAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="apiuser",
            email="apiuser@example.com",
            password="strongpass",
        )
        self.client.force_authenticate(user=self.user)
        self.pledge = Pledge.objects.create(
            pledger=self.user,
            pledge_title="Missions",
            pledge_amount=Decimal("500.00"),
            amount_received=Decimal("0.00"),
            start_date=timezone.now().date(),
        )

    def test_create_list_and_delete_contribution(self):
        create_response = self.client.post(
            "/api/finance/pledge-contributions/",
            {
                "pledge": self.pledge.id,
                "amount": "125.50",
                "contribution_date": timezone.now().date().isoformat(),
                "note": "Initial installment",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.pledge.refresh_from_db()
        self.assertEqual(self.pledge.amount_received, Decimal("125.50"))

        list_response = self.client.get(
            "/api/finance/pledge-contributions/",
            {"pledge": self.pledge.id},
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)
        contribution_id = list_response.data[0]["id"]

        delete_response = self.client.delete(
            f"/api/finance/pledge-contributions/{contribution_id}/"
        )
        self.assertEqual(delete_response.status_code, 204)
        self.pledge.refresh_from_db()
        self.assertEqual(self.pledge.amount_received, Decimal("0"))
