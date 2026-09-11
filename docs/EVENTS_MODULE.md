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

## Event Types and Colors

- Event types are stored in `EventType` (`code`, `label`, `color`, `sort_order`, `is_system`).
- `GET /api/event-types/` and legacy `GET /api/events/types/` return type metadata including hex colors.
- Coordinators with Events write access can manage types from the Events page (**Manage Types**): add custom types, edit labels/colors/sort order, and delete unused non-system types.
- Calendar dots, agenda chips, cards, and the event detail view use each type's `color` from the API (not hardcoded frontend maps).
- Seeded system types (`is_system=true`) cannot be deleted; types referenced by events are protected.

## Frontend Behavior

- `EventForm` (React) defaults new events to Sunday 9–11 AM Manila time, converts local picks to UTC before posting, and manages weekly recurrence options.
- `EventCard`, `EventView`, and `EventCalendar` render dates in the viewer’s locale via `toLocaleDateString` / `toLocaleTimeString`.
- The Events page filters support search, type, year, and month. Month defaults to the calendar’s current view and includes an “All Months” option; “All Months” requires a specific year (Year cannot be “All”).
- Deleting or editing a recurring event from the detail view asks what to apply:
  - **This occurrence** — delete uses `POST /api/events/{id}/exclude-occurrence/`; edit uses `POST /api/events/{id}/split-edit/` with `scope=occurrence` (that week becomes its own event; the date is excluded from the original series).
  - **This and following occurrences** — delete uses `POST /api/events/{id}/end-recurrence/`; edit uses `split-edit` with `scope=following` (original series ends the day before; a new event continues from the selected date).
  - **Entire series** — edit is a normal `PUT /api/events/{id}/`. Delete is admin-only `DELETE /api/events/{id}/`.
- Coordinators with Events write can remove or edit a single week or this-and-following; only admins can delete the whole event. One-off events still use admin-only delete.
- Excluding a week or ending/splitting the series keeps existing attendance (moved onto the new event when splitting). Deleting the entire series cascades those records.

## Attendance Tracking

- `EventSerializer` exposes `attendance_count` (total records across the event) and an `attendance_records` array filtered via `attendance_date=YYYY-MM-DD` when `include_attendance=true`.
- It also derives an `attendee_badges` payload from the same records, so the frontend can render per-person badges (cluster code, family name, etc.) without the model carrying its own `ManyToMany`.
- `POST /api/events/{id}/attendance/` accepts `person_id`, `occurrence_date`, optional `status`, and upserts an attendance record. Each successful write syncs the matching `EVENT_ATTENDANCE` journey.
- `DELETE /api/events/{id}/attendance/{attendance_id}/` removes the attendance record and its journey.
- The generic `/api/attendance/` endpoints provide CRUD access plus `/api/attendance/by-event/{event_id}/` for reporting scenarios.
- On the frontend, `EventView` includes an Attendance panel that:
  - shows attendees for the selected occurrence, with the derived badges for quick context;
  - lets coordinators add/remove attendees; status defaults to “Present” and edits sync journeys automatically;
  - surfaces the total recorded attendees and highlights whether journeys are logged;
  - provides an **Open Check-In** action that opens `/events/check-in?event={id}&occurrence=YYYY-MM-DD` in a new tab for a focused check-in station UI.

### Check-In Page

- Route: `/events/check-in?event={id}&occurrence=YYYY-MM-DD` (requires auth via `ProtectedRoute`).
- Layout: full-width, centered column without the dashboard sidebar — intended for tablets or a dedicated check-in tab.
- Stats (branch-aware when `event.branch` is set):
  - **Total** — eligible members (`isSelectablePerson`) in the event branch, or all eligible members when the event is church-wide;
  - **Checked In** — unique people with attendance records for the occurrence;
  - **Remaining** — `Total − Checked In`.
- **Manual Entry** tab accepts name or LAMP ID; Enter key submits.
- **Camera Scan** tab uses the device camera (`@zxing/browser`) to read a QR code whose payload is the LAMP ID (`member_id`), for example `LAMP00001`. A match auto-checks the person in; unknown IDs and already-checked-in people show an error. Camera access requires HTTPS or localhost.
- Reuses `POST /api/events/{id}/attendance/` with `status: PRESENT` and refreshes the recent check-ins list after each success.

## Testing

Recurring delete options (`exclude-occurrence`, `end-recurrence`, and series `DELETE`) are covered by `apps.events.tests.test_recurrence_delete`.

Run them (uses SQLite to avoid Postgres permissions):

```bash
cd backend
source venv/bin/activate
python manage.py test apps.events.tests --settings=core.settings_test
```

Ensure the virtual environment is activated so Django picks up the bundled dependencies (DRF, pytest, etc.).