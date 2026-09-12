from datetime import datetime, timedelta

from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.events.models import Event, EventType
from apps.people.models import Branch, ModuleCoordinator, Person


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


class SundayServiceUniquenessAPITests(APITestCase):
    def setUp(self):
        self.sunday, _ = EventType.objects.get_or_create(
            code="SUNDAY_SERVICE",
            defaults={
                "label": "Sunday Service",
                "sort_order": 10,
                "color": "#1e40af",
                "is_system": True,
            },
        )
        self.other_type, _ = EventType.objects.get_or_create(
            code="CLUSTERING",
            defaults={
                "label": "Clustering",
                "sort_order": 50,
                "color": "#0d9488",
                "is_system": True,
            },
        )
        self.hq = Branch.objects.create(
            name="HQ Uniq",
            code="HQUNIQ",
            is_headquarters=True,
            is_active=True,
        )
        self.satellite = Branch.objects.create(
            name="Satellite Uniq",
            code="SATUNIQ",
            is_headquarters=False,
            is_active=True,
        )
        self.coordinator = Person.objects.create_user(
            username="uniqcoord",
            password="pass12345",
            first_name="Events",
            last_name="Coord",
            role="MEMBER",
            status="ACTIVE",
            branch=self.hq,
        )
        ModuleCoordinator.objects.create(
            person=self.coordinator,
            module=ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        self.client.force_authenticate(self.coordinator)

    def _payload(self, start, **overrides):
        data = {
            "title": "Sunday Service",
            "description": "",
            "type": "SUNDAY_SERVICE",
            "location": "HQ Uniq",
            "branch": self.hq.id,
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(hours=2)).isoformat(),
            "is_recurring": False,
        }
        data.update(overrides)
        return data

    def test_rejects_second_overlapping_service_same_branch(self):
        start = make_aware_local(2026, 9, 6, 9)
        first = self.client.post("/api/events/", self._payload(start), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        duplicate = self.client.post(
            "/api/events/",
            self._payload(start, location="Main Sanctuary"),
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        self.assertIn("start_date", duplicate.data.get("details", {}))
        self.assertEqual(Event.objects.filter(event_type=self.sunday).count(), 1)

    def test_allows_later_non_overlapping_service_same_day(self):
        morning = make_aware_local(2026, 9, 6, 9)
        evening = make_aware_local(2026, 9, 6, 17)
        first = self.client.post("/api/events/", self._payload(morning), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client.post(
            "/api/events/",
            self._payload(evening, location="Hall 2", title="Evening Service"),
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)

    def test_allows_same_time_at_another_branch(self):
        start = make_aware_local(2026, 9, 6, 9)
        first = self.client.post("/api/events/", self._payload(start), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        other = self.client.post(
            "/api/events/",
            self._payload(
                start,
                branch=self.satellite.id,
                location="Satellite Hall",
            ),
            format="json",
        )
        self.assertEqual(other.status_code, 201, other.data)

    def test_allows_other_event_type_at_same_time(self):
        start = make_aware_local(2026, 9, 6, 9)
        first = self.client.post("/api/events/", self._payload(start), format="json")
        self.assertEqual(first.status_code, 201, first.data)

        other = self.client.post(
            "/api/events/",
            self._payload(
                start,
                type="CLUSTERING",
                title="Clustering",
                location="Fellowship Hall",
            ),
            format="json",
        )
        self.assertEqual(other.status_code, 201, other.data)

    def test_weekly_series_blocks_one_off_on_later_sunday(self):
        start = make_aware_local(2026, 9, 6, 9)
        series = self.client.post(
            "/api/events/",
            self._payload(
                start,
                is_recurring=True,
                recurrence_pattern={
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-10-04",
                    "excluded_dates": [],
                },
            ),
            format="json",
        )
        self.assertEqual(series.status_code, 201, series.data)

        later = make_aware_local(2026, 9, 20, 9)
        one_off = self.client.post(
            "/api/events/",
            self._payload(later, location="Main Sanctuary"),
            format="json",
        )
        self.assertEqual(one_off.status_code, 400, one_off.data)
        self.assertIn("start_date", one_off.data.get("details", {}))

    def test_update_same_event_still_allowed(self):
        start = make_aware_local(2026, 9, 6, 9)
        created = self.client.post("/api/events/", self._payload(start), format="json")
        self.assertEqual(created.status_code, 201, created.data)

        updated = self.client.patch(
            f"/api/events/{created.data['id']}/",
            {"location": "Main Sanctuary"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["location"], "Main Sanctuary")
