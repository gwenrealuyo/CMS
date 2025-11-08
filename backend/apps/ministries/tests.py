import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from .models import Ministry
from .serializers import MinistrySerializer


class MinistrySerializerTests(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.primary = self.User.objects.create_user(
            username="primary@example.com",
            email="primary@example.com",
            password="test1234",
            first_name="Primary",
            last_name="Coordinator",
        )
        self.support = self.User.objects.create_user(
            username="support@example.com",
            email="support@example.com",
            password="test1234",
            first_name="Support",
            last_name="Coordinator",
        )

    def test_serializer_accepts_full_payload(self):
        payload = {
            "name": "Worship Team",
            "description": "Handles music for Sunday services.",
            "category": "worship",
            "activity_cadence": "weekly",
            "primary_coordinator_id": self.primary.pk,
            "support_coordinator_ids": [self.support.pk, self.primary.pk],
            "meeting_location": "Main Sanctuary",
            "meeting_schedule": {"day": "Sunday", "time": "09:00"},
            "communication_channel": "https://example.com/chat",
            "is_active": True,
        }

        serializer = MinistrySerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ministry = serializer.save()

        self.assertEqual(Ministry.objects.count(), 1)
        self.assertEqual(ministry.name, payload["name"])
        self.assertEqual(ministry.primary_coordinator, self.primary)
        self.assertEqual(ministry.category, "worship")
        self.assertEqual(ministry.activity_cadence, "weekly")
        self.assertEqual(ministry.meeting_schedule, {"day": "Sunday", "time": "09:00"})
        self.assertEqual(ministry.support_coordinators.count(), 1)
        self.assertEqual(ministry.support_coordinators.first(), self.support)

    def test_serializer_accepts_schedule_as_json_string(self):
        payload = {
            "name": "Logistics Team",
            "activity_cadence": "event_driven",
            "meeting_schedule": json.dumps({"season": "Holy Week"}),
            "is_active": False,
        }

        serializer = MinistrySerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        ministry = serializer.save()

        self.assertEqual(ministry.meeting_schedule, {"season": "Holy Week"})

    def test_serializer_rejects_invalid_schedule(self):
        payload = {
            "name": "Invalid Schedule Team",
            "activity_cadence": "ad_hoc",
            "meeting_schedule": "not-json",
        }

        serializer = MinistrySerializer(data=payload)
        with self.assertRaises(ValidationError):
            serializer.is_valid(raise_exception=True)
