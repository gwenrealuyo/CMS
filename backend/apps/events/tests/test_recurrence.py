from datetime import datetime, timedelta
from types import SimpleNamespace

from django.test import SimpleTestCase
from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import Event, EventType
from apps.events.services.recurrence import (
    RecurrencePatternError,
    clean_recurrence_pattern,
    generate_occurrences,
)
from apps.people.models import ModuleCoordinator, Person
from core.datetime_utils import church_calendar_date


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


def _event(start, hours=2):
    return SimpleNamespace(
        id=1,
        start_date=start,
        end_date=start + timedelta(hours=hours),
        is_recurring=True,
    )


def occurrence_dates(event, pattern):
    return [
        church_calendar_date(occ.start).isoformat()
        for occ in generate_occurrences(event, pattern)
    ]


class RecurrencePatternCleaningTests(SimpleTestCase):
    def test_legacy_weekly_json_gets_interval_one(self):
        start = make_aware_local(2026, 9, 6)
        cleaned = clean_recurrence_pattern(
            {
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2026-10-04",
                "excluded_dates": [],
            },
            start,
        )
        self.assertEqual(cleaned["frequency"], "weekly")
        self.assertEqual(cleaned["interval"], 1)
        self.assertEqual(cleaned["weekdays"], [6])
        self.assertEqual(cleaned["through"], "2026-10-04")

    def test_missing_frequency_defaults_to_weekly(self):
        start = make_aware_local(2026, 9, 6)
        cleaned = clean_recurrence_pattern({"through": "2026-10-04"}, start)
        self.assertEqual(cleaned["frequency"], "weekly")
        self.assertEqual(cleaned["interval"], 1)
        self.assertEqual(cleaned["weekdays"], [6])

    def test_rejects_unknown_frequency(self):
        start = make_aware_local(2026, 9, 6)
        with self.assertRaises(RecurrencePatternError):
            clean_recurrence_pattern({"frequency": "yearly"}, start)


class RecurrenceGenerationTests(SimpleTestCase):
    def test_legacy_weekly_json_expands_every_week(self):
        start = make_aware_local(2026, 9, 6)
        dates = occurrence_dates(
            _event(start),
            {
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2026-10-04",
            },
        )
        self.assertEqual(
            dates,
            ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27", "2026-10-04"],
        )

    def test_every_two_weeks_is_anchored_to_start(self):
        start = make_aware_local(2026, 9, 6)
        dates = occurrence_dates(
            _event(start),
            {
                "frequency": "weekly",
                "interval": 2,
                "weekdays": [6],
                "through": "2026-10-04",
            },
        )
        self.assertEqual(dates, ["2026-09-06", "2026-09-20", "2026-10-04"])
        self.assertNotIn("2026-09-13", dates)
        self.assertNotIn("2026-09-27", dates)

    def test_monthly_by_date_clamps_missing_day(self):
        start = make_aware_local(2026, 1, 31)
        dates = occurrence_dates(
            _event(start),
            {
                "frequency": "monthly",
                "monthly_mode": "by_date",
                "month_day": 31,
                "weekdays": [5],
                "through": "2026-03-31",
            },
        )
        self.assertEqual(dates, ["2026-01-31", "2026-02-28", "2026-03-31"])

    def test_monthly_second_sunday(self):
        start = make_aware_local(2026, 9, 13)
        dates = occurrence_dates(
            _event(start),
            {
                "frequency": "monthly",
                "monthly_mode": "by_weekday",
                "week_of_month": 2,
                "weekdays": [6],
                "through": "2026-12-13",
            },
        )
        self.assertEqual(
            dates, ["2026-09-13", "2026-10-11", "2026-11-08", "2026-12-13"]
        )

    def test_monthly_last_friday(self):
        start = make_aware_local(2026, 9, 25)
        dates = occurrence_dates(
            _event(start),
            {
                "frequency": "monthly",
                "monthly_mode": "by_weekday",
                "week_of_month": -1,
                "weekdays": [4],
                "through": "2026-12-31",
            },
        )
        self.assertEqual(
            dates, ["2026-09-25", "2026-10-30", "2026-11-27", "2026-12-25"]
        )


class RecurrenceAPITests(APITestCase):
    def setUp(self):
        self.event_type, _ = EventType.objects.get_or_create(
            code="CLUSTERING",
            defaults={
                "label": "Clustering",
                "sort_order": 50,
                "color": "#0d9488",
                "is_system": True,
            },
        )
        self.coordinator = Person.objects.create_user(
            username="recurcoord",
            password="pass12345",
            first_name="Events",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.client.force_authenticate(self.coordinator)
        self.start = make_aware_local(2026, 1, 31)

    def _payload(self, **overrides):
        data = {
            "title": "Monthly Gathering",
            "description": "",
            "type": "CLUSTERING",
            "location": "HQ",
            "start_date": self.start.isoformat(),
            "end_date": (self.start + timedelta(hours=2)).isoformat(),
            "is_recurring": True,
            "recurrence_pattern": {
                "frequency": "monthly",
                "monthly_mode": "by_date",
                "month_day": 31,
                "weekdays": [5],
                "through": "2026-03-31",
                "excluded_dates": [],
            },
        }
        data.update(overrides)
        return data

    def test_create_rejects_yearly_frequency(self):
        response = self.client.post(
            "/api/events/",
            self._payload(
                recurrence_pattern={
                    "frequency": "yearly",
                    "through": "2026-12-31",
                }
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("recurrence_pattern", response.data.get("details", response.data))

    def test_create_monthly_expands_clamped_dates(self):
        response = self.client.post("/api/events/", self._payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        starts = [occ["start_date"][:10] for occ in response.data["occurrences"]]
        self.assertEqual(starts, ["2026-01-31", "2026-02-28", "2026-03-31"])
        self.assertEqual(response.data["recurrence_pattern"]["frequency"], "monthly")
        self.assertEqual(response.data["recurrence_pattern"]["monthly_mode"], "by_date")

    def test_exclude_and_end_work_on_monthly_series(self):
        created = self.client.post("/api/events/", self._payload(), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        event_id = created.data["id"]

        excluded = self.client.post(
            f"/api/events/{event_id}/exclude-occurrence/",
            {"date": "2026-02-28"},
            format="json",
        )
        self.assertEqual(excluded.status_code, 200, excluded.data)
        starts = [occ["start_date"][:10] for occ in excluded.data["occurrences"]]
        self.assertEqual(starts, ["2026-01-31", "2026-03-31"])

        ended = self.client.post(
            f"/api/events/{event_id}/end-recurrence/",
            {"date": "2026-03-31"},
            format="json",
        )
        self.assertEqual(ended.status_code, 200, ended.data)
        event = Event.objects.get(pk=event_id)
        self.assertEqual(event.recurrence_pattern["through"], "2026-03-30")
        starts = [occ["start_date"][:10] for occ in ended.data["occurrences"]]
        self.assertEqual(starts, ["2026-01-31"])

    def test_split_edit_occurrence_on_monthly_series(self):
        created = self.client.post("/api/events/", self._payload(), format="json")
        self.assertEqual(created.status_code, 201, created.data)
        event_id = created.data["id"]
        split_start = make_aware_local(2026, 2, 28)

        response = self.client.post(
            f"/api/events/{event_id}/split-edit/",
            {
                "scope": "occurrence",
                "date": "2026-02-28",
                "title": "One-off Gathering",
                "description": "",
                "type": "CLUSTERING",
                "location": "Annex",
                "start_date": split_start.isoformat(),
                "end_date": (split_start + timedelta(hours=2)).isoformat(),
                "is_recurring": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        event = Event.objects.get(pk=event_id)
        self.assertIn("2026-02-28", event.recurrence_pattern["excluded_dates"])
        created_event = Event.objects.get(pk=response.data["created_event"]["id"])
        self.assertFalse(created_event.is_recurring)
        orig_starts = [
            occ["start_date"][:10] for occ in response.data["event"]["occurrences"]
        ]
        self.assertNotIn("2026-02-28", orig_starts)
