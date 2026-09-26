from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from rest_framework.test import APITestCase

from apps.attendance.models import AttendanceRecord
from apps.events.models import (
    Event,
    EventRegistration,
    EventRegistrationTier,
    EventType,
)
from apps.people.models import Branch, Person


MANILA = ZoneInfo("Asia/Manila")
TODAY = date(2026, 9, 13)


def manila_dt(year, month, day, hour=9):
    return datetime(year, month, day, hour, 0, 0, tzinfo=MANILA)


class EventRegistrationAPITests(APITestCase):
    def setUp(self):
        self.event_type, _ = EventType.objects.get_or_create(
            code="SUNDAY_SERVICE",
            defaults={
                "label": "Sunday Service",
                "sort_order": 10,
                "color": "#1e40af",
                "is_system": True,
            },
        )
        self.hq = Branch.objects.create(
            name="HQ Registration",
            code="HQREG",
            is_headquarters=True,
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="regadmin",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
        )
        self.member = Person.objects.create_user(
            username="regmember",
            password="pass12345",
            first_name="Mina",
            last_name="Member",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            member_id="LAMP30001",
            water_baptism_date=date(2020, 1, 1),
        )
        self.other_member = Person.objects.create_user(
            username="regmember2",
            password="pass12345",
            first_name="Omar",
            last_name="Other",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            member_id="LAMP30002",
            water_baptism_date=date(2020, 1, 1),
        )
        self.event = Event.objects.create(
            title="Paid Conference",
            description="",
            start_date=manila_dt(2026, 9, 13, 9),
            end_date=manila_dt(2026, 9, 13, 17),
            event_type=self.event_type,
            location="Main Hall",
            branch=self.hq,
            registration_enabled=True,
            onsite_registration_required=True,
            online_registration_required=True,
            onsite_capacity=1,
            online_capacity=10,
            created_by=self.admin,
        )

    def test_admin_can_create_tier_and_registration(self):
        self.client.force_authenticate(self.admin)
        tier_resp = self.client.post(
            f"/api/events/{self.event.id}/registration-tiers/",
            {
                "code": "EARLY",
                "label": "Early bird",
                "onsite_price": "100.00",
                "online_price": "50.00",
            },
            format="json",
        )
        self.assertEqual(tier_resp.status_code, 201, tier_resp.data)
        tier_id = tier_resp.data["id"]

        reg_resp = self.client.post(
            f"/api/events/{self.event.id}/registrations/request/",
            {
                "person": self.member.id,
                "mode": "ONSITE",
                "tier": tier_id,
                "occurrence_date": TODAY.isoformat(),
            },
            format="json",
        )
        self.assertEqual(reg_resp.status_code, 201, reg_resp.data)
        self.assertEqual(reg_resp.data["status"], "pending_payment")
        self.assertEqual(Decimal(reg_resp.data["amount_due"]), Decimal("100.00"))

        listed = self.client.get(f"/api/events/{self.event.id}/registrations/")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.member)
        tier_resp = self.client.post(
            f"/api/events/{self.event.id}/registration-tiers/",
            {"code": "EARLY", "label": "Early bird"},
            format="json",
        )
        self.assertEqual(tier_resp.status_code, 403, tier_resp.data)

        reg_resp = self.client.post(
            f"/api/events/{self.event.id}/registrations/request/",
            {
                "person": self.member.id,
                "mode": "ONSITE",
            },
            format="json",
        )
        self.assertEqual(reg_resp.status_code, 403, reg_resp.data)

    def test_free_tier_confirms_immediately(self):
        self.client.force_authenticate(self.admin)
        tier = EventRegistrationTier.objects.create(
            event=self.event,
            code="FREE",
            label="Complimentary",
            onsite_price=Decimal("0.00"),
            online_price=Decimal("0.00"),
        )
        reg_resp = self.client.post(
            f"/api/events/{self.event.id}/registrations/request/",
            {
                "person": self.member.id,
                "mode": "ONSITE",
                "tier": tier.id,
                "occurrence_date": TODAY.isoformat(),
            },
            format="json",
        )
        self.assertEqual(reg_resp.status_code, 201, reg_resp.data)
        self.assertEqual(reg_resp.data["status"], "confirmed")
        self.assertEqual(Decimal(reg_resp.data["amount_due"]), Decimal("0.00"))

    def test_paid_pending_then_payment_confirms(self):
        self.client.force_authenticate(self.admin)
        tier = EventRegistrationTier.objects.create(
            event=self.event,
            code="STD",
            label="Standard",
            onsite_price=Decimal("75.00"),
            online_price=Decimal("40.00"),
        )
        reg_resp = self.client.post(
            f"/api/events/{self.event.id}/registrations/request/",
            {
                "person": self.member.id,
                "mode": "ONSITE",
                "tier": tier.id,
                "occurrence_date": TODAY.isoformat(),
            },
            format="json",
        )
        self.assertEqual(reg_resp.status_code, 201, reg_resp.data)
        self.assertEqual(reg_resp.data["status"], "pending_payment")
        reg_id = reg_resp.data["id"]

        pay_resp = self.client.post(
            f"/api/events/registrations/{reg_id}/payments/",
            {
                "amount": "75.00",
                "method": "CASH",
                "paid_at": manila_dt(2026, 9, 12, 10).isoformat(),
            },
            format="json",
        )
        self.assertEqual(pay_resp.status_code, 201, pay_resp.data)
        self.assertEqual(pay_resp.data["registration"]["status"], "confirmed")
        self.assertEqual(
            Decimal(pay_resp.data["registration"]["amount_paid"]),
            Decimal("75.00"),
        )

        registration = EventRegistration.objects.get(pk=reg_id)
        self.assertEqual(
            registration.status, EventRegistration.Status.CONFIRMED
        )

    def test_capacity_blocks_without_override(self):
        self.client.force_authenticate(self.admin)
        tier = EventRegistrationTier.objects.create(
            event=self.event,
            code="STD",
            label="Standard",
            onsite_price=Decimal("0.00"),
            online_price=Decimal("0.00"),
        )
        first = self.client.post(
            f"/api/events/{self.event.id}/registrations/request/",
            {
                "person": self.member.id,
                "mode": "ONSITE",
                "tier": tier.id,
                "occurrence_date": TODAY.isoformat(),
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)

        blocked = self.client.post(
            f"/api/events/{self.event.id}/registrations/request/",
            {
                "person": self.other_member.id,
                "mode": "ONSITE",
                "tier": tier.id,
                "occurrence_date": TODAY.isoformat(),
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)

        overridden = self.client.post(
            f"/api/events/{self.event.id}/registrations/request/",
            {
                "person": self.other_member.id,
                "mode": "ONSITE",
                "tier": tier.id,
                "occurrence_date": TODAY.isoformat(),
                "allow_capacity_override": True,
            },
            format="json",
        )
        self.assertEqual(overridden.status_code, 201, overridden.data)

    def test_checkin_blocked_without_confirmed_when_required(self):
        self.client.force_authenticate(self.admin)
        tier = EventRegistrationTier.objects.create(
            event=self.event,
            code="STD",
            label="Standard",
            onsite_price=Decimal("50.00"),
            online_price=Decimal("50.00"),
        )
        EventRegistration.objects.create(
            event=self.event,
            person=self.member,
            occurrence_date=TODAY,
            mode=EventRegistration.AttendanceMode.ONSITE,
            tier=tier,
            status=EventRegistration.Status.PENDING_PAYMENT,
            amount_due=Decimal("50.00"),
            amount_paid=Decimal("0.00"),
            created_by=self.admin,
        )

        pastor = Person.objects.create_user(
            username="regpastor",
            password="pass12345",
            first_name="Pat",
            last_name="Pastor",
            role="PASTOR",
            status="ACTIVE",
            branch=self.hq,
            water_baptism_date=date(2018, 1, 1),
        )
        self.client.force_authenticate(pastor)
        response = self.client.post(
            f"/api/events/{self.event.id}/attendance/",
            {
                "person_id": self.member.id,
                "occurrence_date": TODAY.isoformat(),
                "status": "PRESENT",
                "attendance_mode": "ONSITE",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(
            AttendanceRecord.objects.filter(
                event=self.event, person=self.member, occurrence_date=TODAY
            ).exists()
        )

    def test_admin_override_checkin_works(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/events/{self.event.id}/attendance/",
            {
                "person_id": self.member.id,
                "occurrence_date": TODAY.isoformat(),
                "status": "PRESENT",
                "attendance_mode": "ONSITE",
            },
            format="json",
        )
        self.assertIn(response.status_code, (200, 201), response.data)
        self.assertTrue(
            AttendanceRecord.objects.filter(
                event=self.event,
                person=self.member,
                occurrence_date=TODAY,
                status=AttendanceRecord.AttendanceStatus.PRESENT,
            ).exists()
        )
