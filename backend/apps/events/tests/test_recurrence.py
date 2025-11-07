import json
from datetime import datetime, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.events.models import Event
from apps.events.services.recurrence import clean_weekly_pattern, generate_occurrences


def make_aware(year, month, day, hour=0, minute=0):
    naive = datetime(year, month, day, hour, minute)
    return timezone.make_aware(naive, timezone.get_current_timezone())


class RecurrenceServiceTests(TestCase):
    def test_clean_weekly_pattern_normalises_values(self):
        start = make_aware(2025, 1, 6, 9)  # Monday
        pattern = {
            "frequency": "monthly",
            "weekdays": ["1", "4", 4, 10, -1],
            "through": "2026-02-01",
            "excluded_dates": ["2025-02-03", "2027-01-01", "not-a-date"],
        }

        cleaned = clean_weekly_pattern(pattern, start)

        self.assertEqual(cleaned["frequency"], "weekly")
        # Weekdays should be unique, sorted, converted to ints within 0..6
        self.assertEqual(cleaned["weekdays"], [1, 4])

        # Through date clamped to within MAX_OCCURRENCE_DAYS (~one year)
        self.assertEqual(cleaned["through"], "2026-01-07")

        # Only valid excluded dates within range retained
        self.assertEqual(cleaned["excluded_dates"], ["2025-02-03"])

    def test_generate_occurrences_respects_exclusions_and_filters(self):
        start = make_aware(2025, 1, 5, 9)
        end = make_aware(2025, 1, 5, 11)

        event = Event.objects.create(
            title="Sunday Service",
            start_date=start,
            end_date=end,
            type="SUNDAY_SERVICE",
            location="HQ",
            is_recurring=True,
            recurrence_pattern={
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2025-02-02",
                "excluded_dates": ["2025-01-19"],
            },
        )

        cleaned_pattern = clean_weekly_pattern(event.recurrence_pattern, event.start_date)

        end_filter = start + timedelta(days=25)

        occurrences = generate_occurrences(event, cleaned_pattern, end=end_filter)

        self.assertEqual(
            [occ.start.date().isoformat() for occ in occurrences],
            [
                "2025-01-05",
                "2025-01-12",
                "2025-01-26",
            ],
        )

        base_occurrence = occurrences[0]
        self.assertEqual(base_occurrence.start, start)
        self.assertTrue(base_occurrence.is_base_occurrence)

        excluded_dates = {occ.start.date().isoformat() for occ in occurrences}
        self.assertNotIn("2025-01-19", excluded_dates)


class RecurrenceViewSetTests(TestCase):
    def test_exclude_occurrence_action_marks_date_and_updates_occurrences(self):
        client = APIClient()

        start = make_aware(2025, 1, 5, 9)
        end = make_aware(2025, 1, 5, 11)

        event = Event.objects.create(
            title="Sunday Service",
            start_date=start,
            end_date=end,
            type="SUNDAY_SERVICE",
            location="HQ",
            is_recurring=True,
            recurrence_pattern={
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2025-02-02",
                "excluded_dates": [],
            },
        )

        url = reverse("events:event-exclude-occurrence", kwargs={"pk": event.pk})
        payload = {"date": "2025-01-12"}

        response = client.post(url, data=json.dumps(payload), content_type="application/json")

        self.assertEqual(response.status_code, 200)

        data = response.json()
        excluded_dates = data["recurrence_pattern"]["excluded_dates"]
        self.assertIn("2025-01-12", excluded_dates)

        occurrence_dates = {
            occ["start_date"][:10]
            for occ in data.get("occurrences", [])
        }
        self.assertNotIn("2025-01-12", occurrence_dates)
