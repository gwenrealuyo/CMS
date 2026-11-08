from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone
from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import (
    EquipmentType,
    Event,
    EventRoom,
    EventType,
    Vehicle,
    VehicleDriver,
)
from apps.people.models import Branch, ModuleCoordinator, Person


def future(hours=48):
    return timezone.now() + timedelta(hours=hours)


class FacilitiesAPITests(APITestCase):
    def setUp(self):
        self.hq = Branch.objects.create(
            name="HQ Fac",
            code="HQFAC",
            is_headquarters=True,
            is_active=True,
        )
        self.admin = Person.objects.create_user(
            username="facadmin",
            password="pass12345",
            first_name="Admin",
            last_name="Fac",
            role="ADMIN",
            status="ACTIVE",
            branch=self.hq,
            water_baptism_date=datetime(2020, 1, 1).date(),
        )
        self.cluster_coord = Person.objects.create_user(
            username="faccluster",
            password="pass12345",
            first_name="Cluster",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            water_baptism_date=datetime(2020, 1, 1).date(),
        )
        ModuleCoordinator.objects.create(
            person=self.cluster_coord,
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.fan = EquipmentType.objects.create(
            branch=self.hq,
            name="Electric fan",
            quantity_available=2,
            sort_order=10,
        )
        self.projector = EquipmentType.objects.create(
            branch=self.hq,
            name="Projector",
            quantity_available=1,
            sort_order=20,
        )
        self.travis = Vehicle.objects.create(
            branch=self.hq,
            name="Isuzu Travis",
            sort_order=10,
        )
        self.driver = Person.objects.create_user(
            username="facdriver",
            password="pass12345",
            first_name="Driver",
            last_name="One",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
            water_baptism_date=datetime(2020, 1, 1).date(),
        )
        VehicleDriver.objects.create(vehicle=self.travis, person=self.driver)
        self.room = EventRoom.objects.create(
            branch=self.hq,
            name="Hall A",
            sort_order=10,
        )
        self.meeting_type, _ = EventType.objects.get_or_create(
            code="MEETING",
            defaults={
                "label": "Room hold",
                "sort_order": 160,
                "color": "#64748b",
                "is_system": True,
                "counts_as_activity": False,
            },
        )
        self.client.force_authenticate(self.admin)

    def _event_with_room(self, start, hours=2, title="Host event"):
        return Event.objects.create(
            title=title,
            event_type=self.meeting_type,
            branch=self.hq,
            room=self.room,
            location=self.room.name,
            start_date=start,
            end_date=start + timedelta(hours=hours),
            is_room_hold=True,
            booking_status=Event.BookingStatus.APPROVED,
            created_by=self.admin,
        )

    def test_equipment_requires_event_with_room(self):
        start = future(48)
        response = self.client.post(
            "/api/equipment/bookings/",
            {
                "title": "No event borrow",
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(hours=1)).isoformat(),
                "items_write": [
                    {"equipment_type": self.fan.id, "quantity": 1}
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_equipment_quantity_conflict(self):
        start = future(48)
        end = start + timedelta(hours=2)
        event = self._event_with_room(start, hours=2)
        first = self.client.post(
            "/api/equipment/bookings/",
            {
                "title": "Fan booking A",
                "event": event.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "items_write": [
                    {"equipment_type": self.fan.id, "quantity": 2}
                ],
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["event"], event.id)

        blocked = self.client.post(
            "/api/equipment/bookings/",
            {
                "title": "Fan booking B",
                "event": event.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "items_write": [
                    {"equipment_type": self.fan.id, "quantity": 1}
                ],
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)

    def test_cluster_equipment_booking_is_pending(self):
        start = future(50)
        end = start + timedelta(hours=2)
        event = self._event_with_room(start, hours=2, title="Cluster meeting")
        self.client.force_authenticate(self.cluster_coord)
        response = self.client.post(
            "/api/equipment/bookings/",
            {
                "title": "Cluster fans",
                "event": event.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "items_write": [
                    {
                        "equipment_type": self.fan.id,
                        "quantity": 1,
                        "requester_remarks": "Need one standing fan",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["booking_status"], "pending")

        self.client.force_authenticate(self.admin)
        approved = self.client.post(
            f"/api/equipment/bookings/{response.data['id']}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["booking_status"], "approved")

        item_id = approved.data["items"][0]["id"]
        handoff = self.client.post(
            f"/api/equipment/bookings/{response.data['id']}/items/{item_id}/handoff/",
            {
                "mark_received": True,
                "received_condition": "ok",
                "received_notes": "Clean",
            },
            format="json",
        )
        self.assertEqual(handoff.status_code, 200, handoff.data)
        self.assertIsNotNone(handoff.data["items"][0]["received_at"])
        self.assertEqual(handoff.data["items"][0]["received_condition"], "ok")

    def test_vehicle_overlap_blocked(self):
        start = future(60)
        end = start + timedelta(hours=3)
        first = self.client.post(
            "/api/vehicle-bookings/",
            {
                "title": "Travis A",
                "vehicle": self.travis.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "preferred_driver": self.driver.id,
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)

        blocked = self.client.post(
            "/api/vehicle-bookings/",
            {
                "title": "Travis B",
                "vehicle": self.travis.id,
                "start_date": (start + timedelta(hours=1)).isoformat(),
                "end_date": (end + timedelta(hours=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)

    def test_vehicle_assign_driver_and_trip_log(self):
        start = future(70)
        end = start + timedelta(hours=2)
        created = self.client.post(
            "/api/vehicle-bookings/",
            {
                "title": "Travis trip",
                "vehicle": self.travis.id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "preferred_driver": self.driver.id,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        booking_id = created.data["id"]
        self.assertEqual(created.data["preferred_driver"], self.driver.id)
        self.assertIsNone(created.data["assigned_driver"])

        assigned = self.client.post(
            f"/api/vehicle-bookings/{booking_id}/assign-driver/",
            {"assigned_driver": self.driver.id},
            format="json",
        )
        self.assertEqual(assigned.status_code, 200, assigned.data)
        self.assertEqual(assigned.data["assigned_driver"], self.driver.id)

        log = self.client.post(
            f"/api/vehicle-bookings/{booking_id}/trip-logs/",
            {
                "leg": "out",
                "odometer": 12000,
                "rfid_balance": "450.50",
            },
            format="json",
        )
        self.assertEqual(log.status_code, 201, log.data)
        self.travis.refresh_from_db()
        self.assertEqual(self.travis.last_odometer, 12000)
        self.assertEqual(self.travis.last_rfid_balance, Decimal("450.50"))

        updated = self.client.post(
            f"/api/vehicle-bookings/{booking_id}/trip-logs/",
            {
                "leg": "out",
                "odometer": 12050,
                "rfid_balance": "430.00",
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["odometer"], 12050)
        self.travis.refresh_from_db()
        self.assertEqual(self.travis.last_odometer, 12050)
        self.assertEqual(self.travis.last_rfid_balance, Decimal("430.00"))
