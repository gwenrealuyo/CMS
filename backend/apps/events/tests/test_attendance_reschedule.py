from datetime import date, datetime, timedelta

from django.utils.timezone import make_aware
from rest_framework.test import APITestCase

from apps.attendance.models import AttendanceRecord
from apps.attendance.services import collapse_one_off_event_attendance
from apps.events.models import Event, EventType
from apps.people.models import ModuleCoordinator, Person


def make_aware_local(year, month, day, hour=9):
    return make_aware(datetime(year, month, day, hour, 0, 0))


class OneOffAttendanceRescheduleAPITests(APITestCase):
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
        self.coordinator = Person.objects.create_user(
            username="attcoord",
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
        self.attendee = Person.objects.create_user(
            username="gwenattendee",
            password="pass12345",
            first_name="Gwen",
            last_name="Hernandez",
            role="MEMBER",
            status="ACTIVE",
        )
        self.start = make_aware_local(2026, 9, 13)
        self.event = Event.objects.create(
            title="Sunday Service",
            description="",
            start_date=self.start,
            end_date=self.start + timedelta(hours=2),
            event_type=self.event_type,
            location="Main Sanctuary",
            is_recurring=False,
            created_by=self.coordinator,
        )

    def _check_in(self, occurrence_date, event_id=None, person_id=None):
        return self.client.post(
            f"/api/events/{event_id or self.event.id}/attendance/",
            {
                "person_id": person_id or self.attendee.id,
                "occurrence_date": occurrence_date,
                "status": "PRESENT",
            },
            format="json",
        )

    def test_reschedule_moves_attendance_and_second_checkin_is_idempotent(self):
        self.client.force_authenticate(self.coordinator)
        created = self._check_in("2026-09-13")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(
            AttendanceRecord.objects.filter(event=self.event).count(), 1
        )
        record = AttendanceRecord.objects.get(event=self.event)
        self.assertEqual(record.occurrence_date, date(2026, 9, 13))

        new_start = make_aware_local(2026, 9, 6)
        updated = self.client.patch(
            f"/api/events/{self.event.id}/",
            {
                "start_date": new_start.isoformat(),
                "end_date": (new_start + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        record.refresh_from_db()
        self.assertEqual(record.occurrence_date, date(2026, 9, 6))
        self.assertEqual(updated.data["attendance_count"], 1)

        second = self._check_in("2026-09-06")
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(
            AttendanceRecord.objects.filter(
                event=self.event, person=self.attendee
            ).count(),
            1,
        )
        record.refresh_from_db()
        self.assertEqual(record.occurrence_date, date(2026, 9, 6))

    def test_duplicate_rows_collapse_on_reschedule(self):
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 13),
        )
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 6),
        )
        self.assertEqual(
            AttendanceRecord.objects.filter(event=self.event).count(), 2
        )

        self.client.force_authenticate(self.coordinator)
        new_start = make_aware_local(2026, 9, 6)
        updated = self.client.patch(
            f"/api/events/{self.event.id}/",
            {
                "start_date": new_start.isoformat(),
                "end_date": (new_start + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(
            AttendanceRecord.objects.filter(
                event=self.event, person=self.attendee
            ).count(),
            1,
        )
        self.assertEqual(
            AttendanceRecord.objects.get(event=self.event).occurrence_date,
            date(2026, 9, 6),
        )

    def test_second_checkin_collapses_existing_duplicates(self):
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 13),
        )
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 6),
        )
        self.event.start_date = make_aware_local(2026, 9, 6)
        self.event.end_date = self.event.start_date + timedelta(hours=2)
        self.event.save(update_fields=["start_date", "end_date"])

        self.client.force_authenticate(self.coordinator)
        response = self._check_in("2026-09-06")
        self.assertIn(response.status_code, (200, 201), response.data)
        self.assertEqual(
            AttendanceRecord.objects.filter(
                event=self.event, person=self.attendee
            ).count(),
            1,
        )
        self.assertEqual(
            AttendanceRecord.objects.get(event=self.event).occurrence_date,
            date(2026, 9, 6),
        )

    def test_time_only_change_does_not_rewrite_occurrence_date(self):
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 13),
        )
        self.client.force_authenticate(self.coordinator)
        later = make_aware_local(2026, 9, 13, hour=11)
        updated = self.client.patch(
            f"/api/events/{self.event.id}/",
            {
                "start_date": later.isoformat(),
                "end_date": (later + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(
            AttendanceRecord.objects.get(event=self.event).occurrence_date,
            date(2026, 9, 13),
        )

    def test_collapse_helper_prefers_row_already_on_new_date(self):
        keep = AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 6),
            notes="keep me",
        )
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 13),
            notes="drop me",
        )
        collapse_one_off_event_attendance(self.event, date(2026, 9, 6))
        remaining = AttendanceRecord.objects.get(event=self.event)
        self.assertEqual(remaining.pk, keep.pk)
        self.assertEqual(remaining.notes, "keep me")
        self.assertEqual(remaining.occurrence_date, date(2026, 9, 6))


class RecurringAttendanceRescheduleAPITests(APITestCase):
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
        self.coordinator = Person.objects.create_user(
            username="recurrcoord",
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
        self.attendee = Person.objects.create_user(
            username="recurrattendee",
            password="pass12345",
            first_name="Gwen",
            last_name="Hernandez",
            role="MEMBER",
            status="ACTIVE",
        )
        self.start = make_aware_local(2026, 9, 6)
        self.event = Event.objects.create(
            title="Weekly Service",
            description="",
            start_date=self.start,
            end_date=self.start + timedelta(hours=2),
            event_type=self.event_type,
            location="HQ",
            is_recurring=True,
            recurrence_pattern={
                "frequency": "weekly",
                "weekdays": [6],
                "through": "2026-10-04",
                "excluded_dates": [],
            },
            created_by=self.coordinator,
        )

    def test_changing_series_start_does_not_rewrite_other_weeks(self):
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 6),
        )
        AttendanceRecord.objects.create(
            event=self.event,
            person=self.attendee,
            occurrence_date=date(2026, 9, 13),
        )
        self.client.force_authenticate(self.coordinator)
        new_start = make_aware_local(2026, 9, 13)
        updated = self.client.patch(
            f"/api/events/{self.event.id}/",
            {
                "start_date": new_start.isoformat(),
                "end_date": (new_start + timedelta(hours=2)).isoformat(),
                "is_recurring": True,
                "recurrence_pattern": {
                    "frequency": "weekly",
                    "weekdays": [6],
                    "through": "2026-10-04",
                    "excluded_dates": [],
                },
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        dates = set(
            AttendanceRecord.objects.filter(event=self.event).values_list(
                "occurrence_date", flat=True
            )
        )
        self.assertEqual(dates, {date(2026, 9, 6), date(2026, 9, 13)})
