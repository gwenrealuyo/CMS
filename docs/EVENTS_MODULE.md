# Events Module Guide

## Data Model & Storage

- `apps.events.models.Event` persists event start/end times in UTC (`DateTimeField` with `USE_TZ=True`).
- Frontend forms submit local timestamps; the form converts them to ISO-8601 UTC before sending to the API, so the backend always stores aware datetimes.
- Responses (serializer) return ISO-8601 strings; the frontend renders them in the viewer’s locale (e.g., Manila) using `Date.prototype.toLocaleString`.
- `apps.attendance.models.AttendanceRecord` links an `Event` to a `Person` for a specific occurrence (`occurrence_date`) and stores the attendance `status` (`PRESENT`, `ABSENT`, `EXCUSED`). Each record also stores **how** they attended: `attendance_mode` (`ONSITE` | `ONLINE`) and optional `attendance_venue` (FK to `AttendanceVenue`, required when online). Each record automatically synchronises with a `Journey` of type `EVENT_ATTENDANCE`, ensuring the person’s timeline reflects their event participation.

### Attendance mode and online venues

- **Onsite** — physical church check-in (staff QR / manual station). No venue subtype.
- **Online** — remote check-in (self-check-in or staff Online station). Requires an active `AttendanceVenue` (e.g. Home altar, Cluster house).
- Venues are admin-managed at `/api/attendance-venues/` (seeded system rows: `HOME_ALTAR`, `CLUSTER_HOUSE`). Admins can add/edit labels, colors, sort order, and active flag; system venues and venues in use cannot be deleted.
- **First check-in is final** for mode/venue: a second Present write for the same person/occurrence returns **409** and does not change mode/venue. Staff can delete the attendance record and check in again if a correction is needed.
- Staff check-in station: **Onsite** (default, QR + manual) or **Online** (manual only + required venue picker).
- Self-check-in is always **Online** and requires `attendance_venue` on every POST (household and visitor flows). Session payloads include `attendance_venues` for the picker.
- Manage venues in **Admin Settings → Events → Manage venues**.

## Recurrence Pattern Format

Recurring events store a JSON payload in `Event.recurrence_pattern`:

```json
{
  "frequency": "weekly",
  "interval": 2,
  "weekdays": [6],
  "monthly_mode": "by_weekday",
  "month_day": 13,
  "week_of_month": 2,
  "through": "2026-12-31",
  "excluded_dates": ["2026-04-06"]
}
```

- `frequency`: `"weekly"` or `"monthly"`. Missing values default to `"weekly"`; unknown values are rejected on write.
- `interval`: `1` (every week) or `2` (every 2 weeks). Only used for weekly series; monthly is always `1`. Older records without `interval` are treated as weekly.
- `weekdays`: Python weekday integers (Monday = 0, … Sunday = 6). The frontend converts JavaScript’s Sunday=0 to this format before submit. Used for weekly series and monthly-by-weekday.
- `monthly_mode`: `"by_date"` (same calendar day) or `"by_weekday"` (nth or last weekday). Monthly only.
- `month_day`: 1–31 for monthly by date. If that day does not exist in a month (Jan 31 → February), the last day of the month is used.
- `week_of_month`: `1`–`4` or `-1` (last that weekday in the month). Monthly by weekday only.
- `through`: ISO date string (YYYY-MM-DD) clamped to one year from the base start.
- `excluded_dates`: ISO dates for individual occurrences removed via skip-this-occurrence.

The recurrence service expands this pattern on demand in `apps.events.services.recurrence.generate_occurrences`, providing `occurrences` and `next_occurrence` fields in the serializer.

## Event Types and Colors

- Event types are stored in `EventType` (`code`, `label`, `color`, `sort_order`, `is_system`).
- `GET /api/event-types/` and legacy `GET /api/events/types/` return type metadata including hex colors.
- Coordinators with Events write access can manage types from the Events page (**Manage Types**): add custom types, edit labels/colors/sort order, and delete unused non-system types.
- Calendar dots, agenda chips, cards, and the event detail view use each type's `color` from the API (not hardcoded frontend maps).
- Seeded system types (`is_system=true`) cannot be deleted; types referenced by events are protected.

## Frontend Behavior

- `EventForm` (React) defaults new events to Sunday 9–11 AM Manila time, converts local picks to UTC before posting, and manages recurrence (weekly, every 2 weeks, or monthly by date / weekday).
- `EventCard`, `EventView`, and `EventCalendar` render dates in the viewer’s locale via `toLocaleDateString` / `toLocaleTimeString`.
- The Events page filters support search, type, year, and month. Approvers also get a **Manage Pending** button (count of pending bookings, `?booking=pending`). While that queue is open, month is set to All Months so requests are not hidden by the calendar. Month defaults to the calendar’s current view and includes an “All Months” option; “All Months” requires a specific year (Year cannot be “All”).
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
  - provides an **Open Check-In** action that opens `/events/check-in?event={id}&occurrence=YYYY-MM-DD` in a new tab for a focused check-in station UI;
  - for **today or past** occurrences (occurrence date on or before today, local calendar), also shows **Generate Report**, which opens the attendance report modal (same as on the check-in page).

### Expected Attendees (Sunday Service)

Sunday Service events store expected-attendee flags on `Event`:

- `expected_include_active` (default `true`)
- `expected_include_semiactive` (default `true`)
- `expected_include_inactive` (default `true`)
- `expected_include_ongoing_visitors` (default `true`) — includes people with role `VISITOR` and status `ONGOING`

The Event form shows these toggles only when the type is Sunday Service. Other event types keep the broader check-in pool for now (non-admin, branch-scoped). AWTA registration is planned separately.

### Check-In Page

- Route: `/events/check-in?event={id}&occurrence=YYYY-MM-DD` (requires auth via `ProtectedRoute`).
- Layout: full-width, centered column without the dashboard sidebar — intended for tablets or a dedicated check-in tab.
- Stats (branch-aware when `event.branch` is set):
  - **Total** — expected attendees for the event. For Sunday Service this uses the expected-attendee flags (Active / Semi-active / Inactive / optional Ongoing visitors). For other types, non-admin people in the event branch (or all when church-wide). Deceased people are excluded. When Ongoing visitors are included, Total notes how many of them are in the count;
  - **Checked In** — unique people with attendance records for the occurrence (expected plus any extras);
  - **Remaining** — expected people not yet checked in (not `Total − Checked In` when extras are present).
- Manual Entry and Camera Scan look up anyone in the broader check-in candidate pool (non-admin, branch-scoped), so people outside Total can still check in.
- **Manual Entry** tab accepts name or LAMP ID; Enter key submits.
- **Camera Scan** tab (Onsite station only) uses the device camera (`@zxing/browser`) to read a QR code whose payload is the LAMP ID (`member_id`), for example `LAMP00001`. A match auto-checks the person in; unknown IDs and already-checked-in people show an error. Camera access requires HTTPS or localhost.
- Station toggle: **Onsite** (default) posts `attendance_mode: ONSITE`; **Online** requires a venue and posts `ONLINE` + venue. Recent Check-Ins show mode/venue chips and can filter by mode and cluster.
- Reuses `POST /api/events/{id}/attendance/` with `status: PRESENT` and refreshes the recent check-ins list after each success.
- For **today or past** occurrences, **Generate Report** opens the same client-side attendance report as Event Details.

### Self Check-In (Sunday Service)

Mobile-first page at `/events/self-check-in` (authenticated, no sidebar). **Online attendance only** — onsite guests and members use the staff station at `/events/check-in`. Both write the same `AttendanceRecord` + `EVENT_ATTENDANCE` journey.

- **Availability:** church-local today (`CHURCH_TIME_ZONE`) must have an **approved** `SUNDAY_SERVICE` occurrence. Pending room bookings do not open check-in. If none, the page is unavailable (no last-week fallback). Prefer the user’s branch; admins / HQ pastors get a picker when more than one branch or time matches.
- **Who can use it:** **Member self-check-in** in Admin Settings → Module controls is off by default. While off, only admins and Events coordinators (coordinator / senior coordinator) see the banner and page. Turn the switch on to open **online** self-check-in to all logged-in members. Do not use this flow if they are onsite.
- **Members:** any allowed authenticated non-visitor attending **online** can check in themselves and household members on the same `Family` record(s). Deceased and other admin accounts are skipped. Does **not** require Events write.
- **Online guests:** any allowed member can search first (existing `VISITOR` records **and Invited prospects** in the event branch), then check them in or add a new guest. Inviter is always the logged-in host (not editable). Duplicate first+last name in the branch returns 409 with matches instead of creating a second person. This does **not** grant People-module visitor create rights.
- Checking in an Invited prospect uses the same `mark_prospect_attended` path as Evangelism / cluster reports: creates a `VISITOR` / `ONGOING` Person, sets first activity to Sunday Service, then marks Present. Undo still only removes attendance.
- New guests: `VISITOR` / `ONGOING`, `date_first_attended` today, `first_activity_attended=SUNDAY_SERVICE`, event branch, age group stored as a visitor note. First and last names use the same title-case rules as Add Person.
- Dashboard and My record show a Sunday-aware **Check in online** banner when a session is open, labelled as online-only.
- After a successful check-in, **I made a mistake** undoes that attendance for this service (household or guests you invited). Admins and Events coordinators can also undo other visitors in the event branch. It does not delete the person record.

API (all authenticated, non-visitor):

- `GET|PATCH /api/events/settings/` — ADMIN. `member_self_checkin_enabled` opens self-check-in to all members (default off).
- `GET|POST|PATCH|DELETE /api/attendance-venues/` — list/manage online venues (`?active=true` for pickers). Write/delete is ADMIN.
- `GET /api/events/self-check-in/session/` — today’s session, household, `can_encode_visitors`, `attendance_venues`. `?event=` selects among options. Members get `available: false`, `reason: restricted` while the setting is off.
- `POST /api/events/self-check-in/` — `{ person_ids, attendance_venue, event_id? }` household Present upsert as **Online**.
- `POST /api/events/self-check-in/undo/` — `{ person_ids, event_id? }` remove today’s Present records you are allowed to undo (household, guests you invited; staff may undo any visitor in the event branch).
- `GET|POST /api/events/self-check-in/visitors/` — name search (visitors + Invited prospects) / check in existing person, check in prospect (`prospect_id`), or add a guest. POSTs require `attendance_venue`. Inviter is the logged-in user.

### Attendance Report (today and past occurrences)

Available from Event Details and the check-in page when the selected occurrence date is today or earlier (local calendar day). Future occurrences keep Open Check-In only. No new backend report API — the report is computed in the browser from people + attendance for that occurrence.

- **Summary:** Expected, Checked In, **Onsite**, **Online**, Remaining, Surprises; optional **Online by venue** breakdown.
- **Breakdowns:** Checked-in and remaining counts by person status (Active, Semi-active, Inactive, Ongoing, No Response, etc.).
- **Surprises list** and a searchable **checked-in roster** with mode/venue chips (filters for mode, venue, and cluster).
- **Download CSV** with event title, occurrence date, summary counts (including Onsite/Online), and rows for checked-in / remaining / surprises (name, LAMP ID, role, status, cluster, attendance mode, online venue, category, check-in time when present).

Sunday Service uses expected-attendee flags for Expected/Remaining/Surprises; other types use the full eligible pool as expected (same as check-in). Deceased people are excluded from Expected / Remaining in all cases.

## Room booking and approvals

Rooms are bookable resources. Create, update, approve, and split-edit all run two hard checks (approved **and** pending bookings occupy the slot; rejected does not):

1. **Sunday Service uniqueness** — a branch cannot have two overlapping Sunday Services, even in different rooms or offsite. Evening services that do not overlap are still allowed. Other branches can run at the same time.
2. **Room booking** — an `EventRoom` cannot be double-booked. Any overlapping event in the same room is rejected. Offsite events (`room` is null) do not occupy a room. Back-to-back times (`11:00` end vs `11:00` start) are allowed.

Recurring series use `generate_occurrences` (including `excluded_dates`). Split-edit still ignores the parent series dates being vacated.

### Who publishes vs who requests

- **Publish immediately** (`booking_status=approved`): Admin, Pastor, Events Coordinator, Events Senior Coordinator.
- **Submit for approval** (`pending`): Coordinator or Senior Coordinator of a **non-Events** module (Cluster, Evangelism, Sunday School, Lessons, Ministries, Finance). Toast copy: booking submitted for Events Coordinator approval.
- **Approve / reject**: same people who publish immediately. `POST /api/events/{id}/approve/` re-runs conflict checks; `POST /api/events/{id}/reject/` frees the slot. Optional `review_note`.

If someone has **both** Events Coordinator/Senior **and** another module, Events leadership wins: they publish immediately and can approve.

Events does **not** use Teacher or Bible Sharer. Reporters, Teachers, Bible Sharers, and plain members cannot create events.

Pending events:

- Visible to the requester and to approvers; hidden from ordinary members on the agenda/calendar.
- Do not open Sunday Service self-check-in until approved.
- Requester may edit or cancel their own pending request (still conflict-checked). They cannot edit other people’s events, manage types/rooms, or split-edit someone else’s series.
- If a requester changes room or time on an event they created that is already approved, it returns to `pending`. Approvers can edit approved events without re-approval.

Existing rows migrated as `approved`. Duplicate historical Sunday Services are not auto-merged.

## Testing

Recurring frequencies, skip/end/split, and series `DELETE` are covered by `apps.events.tests.test_recurrence` and `apps.events.tests.test_recurrence_delete`. Self check-in is covered by `apps.events.tests.test_self_checkin`. Attendance mode/venues are covered by `apps.events.tests.test_attendance_mode_venues`. Sunday Service uniqueness is covered by `apps.events.tests.test_sunday_service_uniqueness`. Room booking, requester permissions, and approve/reject are covered by `apps.events.tests.test_room_booking`.

Run them (uses SQLite to avoid Postgres permissions):

```bash
cd backend
source venv/bin/activate
python manage.py test apps.events.tests --settings=core.settings_test
```

Ensure the virtual environment is activated so Django picks up the bundled dependencies (DRF, pytest, etc.).