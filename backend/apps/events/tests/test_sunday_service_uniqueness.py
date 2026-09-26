from datetime import date, datetime, timedelta

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
            water_baptism_date=date(2020, 1, 1),
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

    def test_allows_same_time_one_off_on_following_thursday(self):
        """User report: non-recurring Thu + same time next Thu must both succeed."""
        # 2026-09-17 and 2026-09-24 are both Thursdays
        previous = make_aware_local(2026, 9, 17, 9)
        following = make_aware_local(2026, 9, 24, 9)

        first = self.client.post(
            "/api/events/",
            self._payload(previous, title="Thursday test (week 1)"),
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        self.assertFalse(first.data.get("is_recurring"))

        second = self.client.post(
            "/api/events/",
            self._payload(
                following,
                title="Thursday test (week 2)",
                location="HQ Uniq",
            ),
            format="json",
        )
        self.assertEqual(
            second.status_code,
            201,
            f"Expected create to succeed; got {second.status_code}: {second.data}",
        )
        self.assertEqual(
            Event.objects.filter(event_type=self.sunday, is_recurring=False).count(),
            2,
        )

    def test_weekly_sunday_series_allows_thursday_one_off(self):
        """Official weekly Sundays must not block a Thursday test service."""
        sunday_start = make_aware_local(2026, 9, 13, 9)  # Sunday
        series = self.client.post(
            "/api/events/",
            self._payload(
                sunday_start,
                title="Official Sunday Service",
                is_recurring=True,
                recurrence_pattern={
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-12-31",
                    "excluded_dates": [],
                },
            ),
            format="json",
        )
        self.assertEqual(series.status_code, 201, series.data)

        thursday = make_aware_local(2026, 9, 24, 9)
        one_off = self.client.post(
            "/api/events/",
            self._payload(thursday, title="Thursday test event"),
            format="json",
        )
        self.assertEqual(
            one_off.status_code,
            201,
            f"Expected Thursday one-off beside weekly Sundays; "
            f"got {one_off.status_code}: {one_off.data}",
        )

    def test_weekly_sunday_series_plus_prior_thursday_allows_next_thursday(self):
        """Exact user setup: weekly Sundays + prior Thu one-off + new Thu one-off."""
        sunday_start = make_aware_local(2026, 9, 13, 9)
        series = self.client.post(
            "/api/events/",
            self._payload(
                sunday_start,
                title="Official Sunday Service",
                is_recurring=True,
                recurrence_pattern={
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-12-31",
                    "excluded_dates": [],
                },
            ),
            format="json",
        )
        self.assertEqual(series.status_code, 201, series.data)

        prior_thursday = make_aware_local(2026, 9, 17, 9)
        prior = self.client.post(
            "/api/events/",
            self._payload(prior_thursday, title="Prior Thursday one-off"),
            format="json",
        )
        self.assertEqual(prior.status_code, 201, prior.data)

        next_thursday = make_aware_local(2026, 9, 24, 9)
        nxt = self.client.post(
            "/api/events/",
            self._payload(next_thursday, title="Next Thursday test"),
            format="json",
        )
        self.assertEqual(
            nxt.status_code,
            201,
            f"Expected next Thursday to succeed; got {nxt.status_code}: {nxt.data}",
        )

    def test_long_end_date_one_off_blocks_following_thursday(self):
        """Multi-day end_date (UI often hides end date) correctly conflicts.

        Matches the screenshot: calendar dots only on the start day (Sep 17),
        agenda shows empty Sep 24, but create on Sep 24 still errors.
        """
        previous = make_aware_local(2026, 9, 17, 9)
        # Looks like "9am–11am" in time-only UI if end clock is also 11:00
        long_end = make_aware_local(2026, 9, 24, 11)
        first = self.client.post(
            "/api/events/",
            self._payload(
                previous,
                title="Spanning Thursday service",
                end_date=long_end.isoformat(),
            ),
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)

        following = make_aware_local(2026, 9, 24, 9)
        blocked = self.client.post(
            "/api/events/",
            self._payload(following, title="Thursday test"),
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)
        details = blocked.data.get("details", {})
        self.assertIn("start_date", details)
        message = str(details["start_date"])
        self.assertIn("2026-09-24", message)
        self.assertIn("Spanning Thursday service", message)

    def test_screenshot_calendar_healthy_data_allows_sep_24(self):
        """Sep 13 Sundays + Sep 17 Thu one-off + Sep 20 Sunday; Sep 24 free."""
        series = self.client.post(
            "/api/events/",
            self._payload(
                make_aware_local(2026, 9, 13, 9),
                title="Official Sunday Service",
                is_recurring=True,
                recurrence_pattern={
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-12-31",
                    "excluded_dates": [],
                },
            ),
            format="json",
        )
        self.assertEqual(series.status_code, 201, series.data)

        # Second dot on Sep 13 (other type) — same as screenshot "2 events"
        clustering = self.client.post(
            "/api/events/",
            self._payload(
                make_aware_local(2026, 9, 13, 14),
                type="CLUSTERING",
                title="Clustering",
            ),
            format="json",
        )
        self.assertEqual(clustering.status_code, 201, clustering.data)

        prior = self.client.post(
            "/api/events/",
            self._payload(
                make_aware_local(2026, 9, 17, 9),
                title="Prior Thursday one-off",
            ),
            format="json",
        )
        self.assertEqual(prior.status_code, 201, prior.data)

        create_sep_24 = self.client.post(
            "/api/events/",
            self._payload(
                make_aware_local(2026, 9, 24, 9),
                title="Thursday test",
            ),
            format="json",
        )
        self.assertEqual(
            create_sep_24.status_code,
            201,
            f"Screenshot-healthy data must allow Sep 24; got {create_sep_24.data}",
        )

    def test_week_long_sunday_occurrence_blocks_thursday(self):
        """Sunday series whose duration spans a week covers mid-week Thursdays."""
        sunday_start = make_aware_local(2026, 9, 20, 9)  # Sunday before target Thu
        sunday_end = make_aware_local(2026, 9, 27, 11)  # following Sunday
        series = self.client.post(
            "/api/events/",
            self._payload(
                sunday_start,
                title="Official Sunday Service",
                end_date=sunday_end.isoformat(),
                is_recurring=True,
                recurrence_pattern={
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-12-31",
                    "excluded_dates": [],
                },
            ),
            format="json",
        )
        self.assertEqual(series.status_code, 201, series.data)

        thursday = make_aware_local(2026, 9, 24, 9)
        blocked = self.client.post(
            "/api/events/",
            self._payload(thursday, title="Thursday test"),
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)
        details = blocked.data.get("details", {})
        self.assertIn("start_date", details)
        message = str(details["start_date"])
        self.assertIn("2026-09-24", message)
        self.assertIn("Official Sunday Service", message)