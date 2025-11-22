import json
from datetime import datetime

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord
from apps.events.models import Event
from apps.people.models import Journey, Person


def make_aware(year, month, day, hour=0, minute=0):
    naive = datetime(year, month, day, hour, minute)
    return timezone.make_aware(naive, timezone.get_current_timezone())


class AttendanceIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.event = Event.objects.create(
            title="Sunday Service",
            description="Weekly gathering",
            start_date=make_aware(2025, 1, 5, 9),
            end_date=make_aware(2025, 1, 5, 11),
            type="SUNDAY_SERVICE",
            location="Main Hall",
        )
        self.person = Person.objects.create_user(
            username="jdoe",
            password="password",
            first_name="John",
            last_name="Doe",
            role="MEMBER",
            status="ACTIVE",
        )
        self.occurrence_date = self.event.start_date.date().isoformat()

    def test_add_attendance_creates_record_and_journey(self):
        url = reverse("events:event-attendance", kwargs={"pk": self.event.pk})
        payload = {
            "person_id": str(self.person.pk),
            "occurrence_date": self.occurrence_date,
            "status": "PRESENT",
        }

        response = self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertIn(response.status_code, (200, 201))

        record = AttendanceRecord.objects.get(
            event=self.event,
            person=self.person,
            occurrence_date=self.occurrence_date,
        )
        self.assertIsNotNone(record.journey_id)
        self.assertEqual(record.status, "PRESENT")

        journey = record.journey
        self.assertIsNotNone(journey)
        self.assertEqual(journey.type, "EVENT_ATTENDANCE")
        self.assertEqual(journey.user, self.person)
        self.assertEqual(journey.date.isoformat(), self.occurrence_date)

        # Serializer response should include updated attendance count
        data = response.json()
        self.assertEqual(data["event"]["attendance_count"], 1)

        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)
        self.assertEqual(
            list_response.json()[0]["person"]["id"], self.person.pk
        )

    def test_remove_attendance_deletes_record_and_journey(self):
        record = AttendanceRecord.objects.create(
            event=self.event,
            person=self.person,
            occurrence_date=self.event.start_date.date(),
            status="PRESENT",
        )
        record.refresh_from_db()
        journey_id = record.journey_id

        url = reverse(
            "events:event-remove-attendance",
            kwargs={"pk": self.event.pk, "attendance_id": record.pk},
        )

        response = self.client.delete(url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            AttendanceRecord.objects.filter(pk=record.pk).exists()
        )
        self.assertFalse(Journey.objects.filter(pk=journey_id).exists())

    def test_event_serializer_includes_attendance_summary(self):
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.person,
            occurrence_date=self.event.start_date.date(),
            status="PRESENT",
        )

        detail_url = reverse("events:event-detail", kwargs={"pk": self.event.pk})
        response = self.client.get(
            detail_url,
            {
                "include_attendance": "1",
                "attendance_date": self.occurrence_date,
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["attendance_count"], 1)
        self.assertEqual(len(data["attendance_records"]), 1)
        record = data["attendance_records"][0]
        self.assertEqual(record["person"]["id"], self.person.pk)
        self.assertEqual(record["status"], "PRESENT")


