# Events Module Guide

## Data Model & Storage

- `apps.events.models.Event` persists event start/end times in UTC (`DateTimeField` with `USE_TZ=True`).
- Frontend forms submit local timestamps; the form converts them to ISO-8601 UTC before sending to the API, so the backend always stores aware datetimes.
- Responses (serializer) return ISO-8601 strings; the frontend renders them in the viewer’s locale (e.g., Manila) using `Date.prototype.toLocaleString`.
- `apps.attendance.models.AttendanceRecord` links an `Event` to a `Person` for a specific occurrence (`occurrence_date`) and stores the attendance `status` (`PRESENT`, `ABSENT`, `EXCUSED`). Each record automatically synchronises with a `Journey` of type `EVENT_ATTENDANCE`, ensuring the person’s timeline reflects their event participation.

## Recurrence Pattern Format

Recurring events store a JSON payload in `Event.recurrence_pattern`:

```json
{
  "frequency": "weekly",
  "weekdays": [0],
  "through": "2025-12-31",
  "excluded_dates": ["2025-04-06"]
}
```

- `frequency`: currently always `"weekly"` (validated server-side).
- `weekdays`: Python weekday integers (Monday = 0, … Sunday = 6). The frontend converts JavaScript’s Sunday=0 to this format before submit.
- `through`: ISO date string (YYYY-MM-DD) clamped to one year from the base start.
- `excluded_dates`: ISO dates for individual occurrences removed via the “Skip this week” action.

The recurrence service expands this pattern on demand in `apps.events.services.recurrence.generate_occurrences`, providing `occurrences` and `next_occurrence` fields in the serializer.

## Frontend Behavior

- `EventForm` (React) defaults new events to Sunday 9–11 AM Manila time, converts local picks to UTC before posting, and manages weekly recurrence options.
- `EventCard`, `EventView`, and `EventCalendar` render dates in the viewer’s locale via `toLocaleDateString` / `toLocaleTimeString`.
- Excluding a single week calls `POST /api/events/{id}/exclude-occurrence/` which updates the stored pattern and pushes back the refreshed occurrences.

## Attendance Tracking

- `EventSerializer` exposes `attendance_count` (total records across the event) and an `attendance_records` array filtered via `attendance_date=YYYY-MM-DD` when `include_attendance=true`.
- It also derives an `attendee_badges` payload from the same records, so the frontend can render per-person badges (cluster code, family name, etc.) without the model carrying its own `ManyToMany`.
- `POST /api/events/{id}/attendance/` accepts `person_id`, `occurrence_date`, optional `status`, and upserts an attendance record. Each successful write syncs the matching `EVENT_ATTENDANCE` journey.
- `DELETE /api/events/{id}/attendance/{attendance_id}/` removes the attendance record and its journey.
- The generic `/api/attendance/` endpoints provide CRUD access plus `/api/attendance/by-event/{event_id}/` for reporting scenarios.
- On the frontend, `EventView` includes an Attendance panel that:
  - shows attendees for the selected occurrence, with the derived badges for quick context;
  - lets coordinators add/remove attendees; status defaults to “Present” and edits sync journeys automatically;
  - surfaces the total recorded attendees and highlights whether journeys are logged.

## Testing

Backend recurrence logic and the exclude-occurrence action are covered by unit tests in `apps/events/tests/test_recurrence.py`.
Attendance and journey flows are exercised by API tests in `apps/attendance/tests/test_attendance_api.py`.

Run them (uses SQLite to avoid Postgres permissions):

```bash
cd backend
source venv/bin/activate
python manage.py test apps.events.tests --settings=core.settings_test
```

Ensure the virtual environment is activated so Django picks up the bundled dependencies (DRF, pytest, etc.).
