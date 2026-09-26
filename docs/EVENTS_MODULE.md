# Events Module Guide

## Data Model & Storage

- `apps.events.models.Event` persists event start/end times in UTC (`DateTimeField` with `USE_TZ=True`).
- Frontend forms submit local timestamps; the form converts them to ISO-8601 UTC before sending to the API, so the backend always stores aware datetimes.
- Responses (serializer) return ISO-8601 strings; the frontend renders them in the viewer’s locale (e.g., Manila) using `Date.prototype.toLocaleString`.
- `apps.attendance.models.AttendanceRecord` links an `Event` to a `Person` for a specific occurrence (`occurrence_date`) and stores the attendance `status` (`PRESENT`, `ABSENT`, `EXCUSED`). Each record also stores **how** they attended: `attendance_mode` (`ONSITE` | `ONLINE`) and optional `attendance_venue` (FK to `AttendanceVenue`, required when online). Each record automatically synchronises with a `Journey` of type `EVENT_ATTENDANCE`, ensuring the person’s timeline reflects their event participation.

### Attendance mode and online venues

- **Onsite** — physical church check-in (staff QR / manual station). No venue subtype.
- **Online** — remote check-in (self-check-in or staff Online station). For **hybrid** events, requires an active `AttendanceVenue` (e.g. Home altar, Cluster house). For **online-only** events, Online with no venue is enough.
- **Attendance format** (`Event.attendance_format`): `hybrid` (default), `online_only`, or `onsite_only`. Controls which modes are allowed and whether online venues apply.
- Venues are admin-managed at `/api/attendance-venues/` (seeded system rows: `HOME_ALTAR`, `CLUSTER_HOUSE`). Admins can add/edit labels, colors, sort order, and active flag; system venues and venues in use cannot be deleted.
- **First check-in is final** for mode/venue on **POST** (QR, self-check-in, re-add): a second Present write for the same person/occurrence returns **409** and does not change mode/venue.
- Staff can **correct** mode/venue afterward via `PATCH /api/events/{id}/attendance/{attendance_id}/` with `attendance_mode` and (when Online on a hybrid event) `attendance_venue`. UI: **Edit mode** on the Event attendance list and on Check-In Recent Check-Ins. Switching to Onsite clears venue; Online on hybrid requires an active venue.
- Staff check-in station: Hybrid — **Onsite** (default, QR + manual) or **Online** (manual + venue). Online-only — Online locked, no venue. Onsite-only — Onsite locked.
- Event detail **Add attendee** also accepts Onsite/Online (+ venue when Online on hybrid).
- Self-check-in is always **Online**. Hybrid requires `attendance_venue` on every POST; online-only omits venue. Session payloads include `requires_online_venue` and `attendance_venues` (empty when not required).
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

- Event types are stored in `EventType` (`code`, `label`, `color`, `sort_order`, `is_system`, `counts_as_activity`).
- `GET /api/event-types/` and legacy `GET /api/events/types/` return type metadata including hex colors and `counts_as_activity`.
- Coordinators with Events write access can manage types from the Events page (**Manage Types**): add custom types, edit labels/colors/sort order, and delete unused non-system types. `counts_as_activity` is read-only (custom types always count as an activity).
- Calendar dots, agenda chips, cards, and the event detail view use each type's `color` from the API (not hardcoded frontend maps).
- Seeded system types (`is_system=true`) cannot be deleted; types referenced by events are protected.

### Meeting (room hold)

**Meeting** (`MEETING`) is a room reservation in the church building (any branch), not a ministry activity:

- `counts_as_activity=false` — it never appears as First Activity Attended (People, Add Visitor, Mark attended). `PersonSerializer` and other write endpoints reject that code.
- Requires a real `EventRoom` on the selected branch. Other / off-site is not allowed.
- Follows the same publish-vs-pending booking rules and room overlap checks as other events. Sunday Service uniqueness does **not** apply, so a Meeting can run at the same time as Sunday Service in a different room.
- Shown on the Events agenda/calendar (and **Manage Pending** when pending) so the room looks booked.
- Event detail hides Open Check-In, add-attendee, and the attendance report. Self-check-in already ignores non-Sunday Service types.

## Frontend Behavior

- `EventForm` (React) defaults new events to Sunday 9–11 AM Manila time, converts local picks to UTC before posting, and manages recurrence (weekly, every 2 weeks, or monthly by date / weekday).
- `EventCard`, `EventView`, and `EventCalendar` render dates in the viewer’s locale via `toLocaleDateString` / `toLocaleTimeString`.
- The Events page filters support search, type, year, and month. Approvers also get a **Manage Pending** button (count of pending bookings, `?booking=pending`). While that queue is open, month is set to All Months so requests are not hidden by the calendar. Month defaults to the calendar’s current view and includes an “All Months” option; “All Months” requires a specific year (Year cannot be “All”).
- Deleting or editing a recurring event from the detail view asks what to apply:
  - **This occurrence** — delete uses `POST /api/events/{id}/exclude-occurrence/`; edit uses `POST /api/events/{id}/split-edit/` with `scope=occurrence` (that week becomes its own event; the date is excluded from the original series).
  - **This and following occurrences** — delete uses `POST /api/events/{id}/end-recurrence/`; edit uses `split-edit` with `scope=following` (original series ends the day before; a new event continues from the selected date).
  - **Entire series** — edit is a normal `PUT /api/events/{id}/`. Delete is `DELETE /api/events/{id}/` for Admin, Pastor, and Events Coordinator / Senior Coordinator. Split-off weeks from an earlier occurrence/following edit are not included.
- Coordinators with Events write can skip a week, end from a date, or delete the whole remaining series. One-off event delete uses the same Events-write permission. Type/room hard-delete stays admin-only.
- Occurrence skip/edit/delete use the church calendar day (`occurrence_date`, Asia/Manila), not the UTC date of the ISO timestamp.
- Excluding a week or ending/splitting the series keeps existing attendance (moved onto the new event when splitting). Deleting the entire series cascades those records.

## Attendance Tracking

- `EventSerializer` exposes `attendance_count` (total records across the event) and an `attendance_records` array filtered via `attendance_date=YYYY-MM-DD` when `include_attendance=true`.
- It also derives an `attendee_badges` payload from the same records, so the frontend can render per-person badges (cluster code, family name, etc.) without the model carrying its own `ManyToMany`.
- `POST /api/events/{id}/attendance/` accepts `person_id`, `occurrence_date`, optional `status`, and upserts an attendance record. Each successful write syncs the matching `EVENT_ATTENDANCE` journey.
- `DELETE /api/events/{id}/attendance/{attendance_id}/` removes the attendance record and its journey.
- The generic `/api/attendance/` endpoints provide CRUD access plus `/api/attendance/by-event/{event_id}/` for reporting scenarios.
- On the frontend, `EventView` includes an Attendance panel that:
  - is shown only to Admin, Pastor, and Events Coordinator / Senior Coordinator (`canWriteEvents`). Members without Events write do not see Add Attendee, Open Check-In, Generate Report, or the roster;
  - still shows the occurrence attendee count on the event title card for everyone, plus a **You were present** chip (with Onsite/Online when known) when the logged-in user has a `PRESENT` record for that occurrence. The same present chip appears on agenda rows, and calendar days get a small check when the viewer attended that day;
  - shows attendees for the selected occurrence, with derived badges (cluster, family, LAMP ID without the `LAMP` prefix, **Onsite** / **Online**, and online venue when set);
  - tints attendee cards (emerald onsite, sky online) and filters the list by name/LAMP ID plus All / Onsite / Online beside the search bar;
  - lets coordinators add/remove attendees; status defaults to “Present” and edits sync journeys automatically;
  - surfaces the total recorded attendees and highlights whether journeys are logged;
  - provides an **Open Check-In** action that opens `/events/check-in?event={id}&occurrence=YYYY-MM-DD` in a new tab for a focused check-in station UI;
  - for **today or past** occurrences (occurrence date on or before today, local calendar), also shows **Generate Report**, which opens the attendance report modal (same as on the check-in page).

### Expected Attendees

Activity events can run in two attendance-tracking modes (Meeting room holds do not show these controls):

- **Who can edit on the form:** Admin, Pastor, and Events Coordinator / Senior Coordinator only (`canWriteEvents`). The Expected Attendees / Track expected attendees block is hidden on booking-request forms (other-module coordinators); those submits still use form defaults or existing values unchanged.
- **`track_expected_attendees`** (model default `false` for new API creates; existing events were backfilled to `true`)
  - **On (status-based / duty):** check-in shows Total / Remaining; the attendance report includes Expected, Remaining, Surprises, and attendance rate vs the expected pool.
  - **Off (open / headcount):** check-in shows Checked In only; the report keeps checked-in roster + Onsite / Online / Tardy / by-status / by-cluster breakdowns, but omits Expected, Remaining, Surprises, and expected-based rates.
- Form defaults on **create:** Sunday Service (`SUNDAY_SERVICE`) starts with tracking **on**; all other activity types (including AWTA) start **off**. Changing type on create resets this default; editing an existing event does not auto-reset it.
- When tracking is on, status flags further define the expected pool:
  - `expected_include_active` (default `true`)
  - `expected_include_semiactive` (default `true`)
  - `expected_include_inactive` (default `true`)
  - `expected_include_ongoing_visitors` (default `true`) — includes people with role `VISITOR` and status `ONGOING`

Manual Entry and Camera Scan still allow anyone in the broader eligible pool (branch or church-wide), whether or not expected tracking is enabled.

### Cross-branch attendance (host branch)

Branch-hosted activity events can set **`allow_cross_branch_attendance`** (default `false`):

- **On:** people from other branches may use door check-in and self-check-in (same visibility as church-wide for self-check-in matching). When expected tracking is on, **Expected / Remaining still use only the event’s branch**; other-branch check-ins count as Surprises (or plain headcount if tracking is off).
- **Off:** eligible pool stays branch-scoped (existing behavior).
- Church-wide events (`branch = null`, e.g. AWTA) ignore this flag (everyone is already eligible); the API forces it off.
- Form control is Events write–only, hidden for room holds, booking requests, and church-wide.
- Typical use: HQ anniversary Sunday at a dedicated off-site venue (hybrid), open to satellites who may attend without joining the expected pool.

### Paid registration (D1 + tiers)

Events-owned paid registration (not Finance donations/pledges; no payment gateway):

- **Event settings:** `registration_enabled`, `onsite_registration_required`, `online_registration_required`, optional `onsite_capacity` / `online_capacity`.
- **Tiers** (`EventRegistrationTier`): per-mode offered flags + fixed `onsite_price` / `online_price` (0 = free for that mode).
- **Registration:** person + mode + tier; status `pending_payment` → `confirmed` (or cancelled/refunded). Free amount confirms immediately. `pending_payment` holds a seat against capacity.
- **Payments:** staff-recorded lines (`CASH`, `CHECK`, `BANK_TRANSFER`, `CARD`, `DIGITAL_WALLET`); auto-confirm when paid ≥ due. Manual GCash = digital wallet. No unattended/gateway pay.
- **Check-in:** when registration is enabled and the mode is required, door/self-check-in need a **confirmed** registration for that mode. Admin may override on staff door check-in only.
- **Access (test phase):** Admin-only APIs and UI (Event form settings/tiers, Registration desk at `/events/registrations?event=&occurrence=`). Member-request API exists (`POST .../registrations/request/`) but **no public/member register UI**. Widen roles later.
- Distinct from Expected attendees and from AWTA curriculum/school enrollment (out of scope).

### AWTA (national / church-wide)

**AWTA** is a seeded activity type that HQ leadership can run as a national event:

- **Who can create/edit:** Admin, HQ Pastor, and Events Coordinator / Senior Coordinator whose person branch is headquarters (`can_manage_national_events` on the auth user). Satellite Events coordinators cannot select AWTA or clear the branch.
- **Church-wide:** `Event.branch = null` is allowed only for AWTA (shown as **Church-wide** on the Event form). Non-AWTA events still require a branch.
- **Dedicated venue:** Church-wide AWTA must use Other / off-site with a free-text `location` (no `EventRoom`). Branch-scoped AWTA may still use a building room.
- **Attendance:** Same hybrid / online-only / onsite-only rules as other activity events. Online hybrid still uses Home altar / Cluster house — there is no separate AWTA attendance venue. Self-check-in and expected-attendee pools already treat `branch=null` as visible to all branches.
- **Paid registration** uses the same Events registration engine when enabled; AWTA curriculum / class enrollment remains out of scope.

### Check-In Page

- Route: `/events/check-in?event={id}&occurrence=YYYY-MM-DD` (requires auth via `ProtectedRoute`, plus Events write: Admin, Pastor, Events Coordinator / Senior Coordinator). Other members see an access message and should use self-check-in when it is enabled.
- Layout: full-width, centered column without the dashboard sidebar — intended for tablets or a dedicated check-in tab.
- Stats (branch-aware when `event.branch` is set):
  - When **`track_expected_attendees`** is on:
    - **Total** — expected attendees using the expected-include flags (Active / Semi-active / Inactive / optional Ongoing visitors), scoped to the event branch (or all when church-wide). Deceased people are excluded. When Ongoing visitors are included, Total notes how many of them are in the count;
    - **Checked In** — unique people with attendance records for the occurrence (expected plus any extras);
    - **Remaining** — expected people not yet checked in (not `Total − Checked In` when extras are present).
  - When tracking is **off** (open event): **Checked In** only (headcount).
- Manual Entry and Camera Scan look up anyone in the broader check-in candidate pool (non-admin, branch-scoped, or all branches when church-wide / `allow_cross_branch_attendance`).
- **Manual Entry** tab accepts name or LAMP ID; Enter key submits.
- **Camera Scan** tab (Onsite station only) uses the device camera (`@zxing/browser`) to read a QR code whose payload is the LAMP ID (`member_id`), for example `LAMP12345`. A match auto-checks the person in. Success, already-checked-in, and unknown IDs show a large status banner on the page (green / amber / red) **and** a larger toast. Camera access requires HTTPS or localhost.
- Station toggle: **Onsite** (default) posts `attendance_mode: ONSITE`; **Online** requires a venue and posts `ONLINE` + venue. Switching the station also sets the Recent Check-Ins mode filter to Onsite or Online. Recent Check-Ins show mode/venue chips, **Edit mode** (PATCH correction), and can still filter by mode and cluster.
- Reuses `POST /api/events/{id}/attendance/` with `status: PRESENT` and refreshes the recent check-ins list after each success.
- For **today or past** occurrences, **Generate Report** opens the same client-side attendance report as Event Details.
- **New guest** opens `/events/guest?event={id}&occurrence=YYYY-MM-DD` for encoding walk-ins / new visitors with **ONSITE** attendance (Events write only).

### Guest (onsite)

Staff page at `/events/guest` (no sidebar). Events write only (same as check-in: Admin, Pastor, Events Coordinator / Senior Coordinator).

- Resolves today’s **approved activity** events that have `self_checkin_enabled` and are not onsite-only (branch-aware picker when needed), or uses `?event=` + `?occurrence=` when opened from the check-in station (any approved activity event, even if self-check-in is off).
- Search first: existing `VISITOR` people and Invited prospects in the event branch; check-in existing matches as **ONSITE** for hybrid/onsite-only events, or **ONLINE** (no venue) for online-only events.
- Encode new guest: first/last name, optional phone/email, gender, age group, **First time attending** (default on — sets `date_first_attended` and `date_first_invited` to the occurrence date; off leaves invited null), **optional inviter** (member search). Blank inviter = walk-in (`inviter=null` — do not invent a staff inviter).
- Creates `VISITOR` / `ONGOING` with first activity set to the **event’s type**, then Present with the mode above.
- Duplicate first+last in the branch returns 409 with matches.

API (Events write):

- `GET /api/events/onsite-guest/session/` — `?event=` / `?occurrence=` optional
- `GET|POST /api/events/onsite-guest/visitors/` — search / check in existing, prospect, or create (`inviter_id` optional)
- `GET /api/events/onsite-guest/inviters/?q=` — member search for optional inviter (empty query returns no results)

### Self Check-In

Mobile-first page at `/events/self-check-in` (no sidebar). **Online attendance only** — onsite members use the staff station at `/events/check-in`; onsite guests use `/events/guest` (linked from check-in). Both write the same `AttendanceRecord` + `EVENT_ATTENDANCE` journey.

There are two UIs on the same URL:

- **Not logged in (public link):** identify **one person** with LAMP ID (typed, camera scan of the member QR, or a QR **photo decoded in the browser** — the image is never uploaded). Confirm name/photo, pick an online venue, check in. No household list, no visitor search, no undo.
- **Logged in:** existing household + guest encoding for admins, Events coordinators, and members who have a CMS account.

The member QR payload stays the LAMP ID (`member_id`), for example `LAMP12345`. The shared page URL is not encoded in that QR.

**Per-event eligibility** (all required):

1. `Event.self_checkin_enabled` is on (organizer opt-in on the Event form for any activity type; Meeting room holds cannot enable it)
2. Event type has `counts_as_activity` (not Meeting)
3. `attendance_format` is not `onsite_only`
4. `booking_status` is **approved**
5. Church-local today has an occurrence of that event

New Sunday Service creates default `self_checkin_enabled=True` and `attendance_format=hybrid`; other types default self-check-in off and hybrid. Existing Sunday Service rows were migrated to self-check-in enabled.

- **Availability:** church-local today (`CHURCH_TIME_ZONE`) must have at least one eligible event above. Pending room bookings do not open check-in. If none, the page is unavailable (no last-week fallback). Public identify prefers the person’s branch (and includes church-wide events). Logged-in users still prefer their branch; admins / HQ pastors get a picker when more than one branch or time matches.
- **Who can use the public link:** **Member self-check-in** in Admin Settings → Module controls is off by default. Turn the switch on to open the public LAMP ID page for eligible events. While off, the public APIs return `available: false`, `reason: restricted`; admins and Events coordinators still use the logged-in household/guest page.
- **Public identify:** `POST` with `{ member_id }` (also accepts digits-only, e.g. `10001` for `LAMP10001`). Unknown / admin / deceased → generic 404. Duplicate LAMP IDs → 409 asking staff. Check-in re-resolves from `member_id` (does not trust a client `person_id`).
- **Logged-in members:** any allowed authenticated non-visitor attending **online** can check in themselves and household members on the same `Family` record(s). Deceased and other admin accounts are skipped. Does **not** require Events write.
- **Online guests (logged-in only):** any allowed member can search first (existing `VISITOR` records **and Invited prospects** in the event branch), then check them in or add a new guest. Inviter is always the logged-in host (not editable). Duplicate first+last name in the branch returns 409 with matches instead of creating a second person. This does **not** grant People-module visitor create rights. New-guest encode includes **First time attending** (default on): checked sets both `date_first_attended` and `date_first_invited` to the occurrence date; unchecked sets attended only.
- Checking in an Invited prospect uses the same `mark_prospect_attended` path as Evangelism / cluster reports: creates a `VISITOR` / `ONGOING` Person, sets first activity to the **event’s type**, then marks Present. Undo still only removes attendance.
- New guests: `VISITOR` / `ONGOING`, `date_first_attended` = occurrence date, optional `date_first_invited` when **First time attending** is checked (default), `first_activity_attended` = event type, event branch, age group stored as a visitor note. First and last names use the same title-case rules as Add Person.
- Dashboard and My record show a **Check in online** banner when a logged-in session is open, labelled as online-only. The unauthenticated home page shows **Online check-in** when the public session is available.
- After a successful logged-in check-in, **I made a mistake** undoes that attendance for this event (household or guests you invited). Admins and Events coordinators can also undo other visitors in the event branch. It does not delete the person record. The public page has no undo.

API:

- `GET|PATCH /api/events/settings/` — ADMIN. `member_self_checkin_enabled` opens the **public** self-check-in link (default off). Logged-in staff keep household/guest check-in either way.
- `GET|POST|PATCH|DELETE /api/attendance-venues/` — list/manage online venues (`?active=true` for pickers). Write/delete is ADMIN.
- Public (`AllowAny`, no JWT; identify/check-in throttled):
  - `GET /api/events/self-check-in/public/session/` — whether today is open, event options, `attendance_venues`. No household.
  - `POST /api/events/self-check-in/public/identify/` — `{ member_id, event_id? }` slim confirm payload (name, nickname, photo, LAMP ID, already checked in).
  - `POST /api/events/self-check-in/public/` — `{ member_id, attendance_venue?, event_id? }` Present upsert as **Online**. Hybrid requires venue; online-only omits it. Same first-check-in-is-final 409.
- Authenticated, non-visitor:
  - `GET /api/events/self-check-in/session/` — today’s session, household, `can_encode_visitors`, `requires_online_venue`, `attendance_venues`. `?event=` selects among options. Members get `available: false`, `reason: restricted` while the setting is off.
  - `POST /api/events/self-check-in/` — `{ person_ids, attendance_venue?, event_id? }` household Present upsert as **Online**.
  - `POST /api/events/self-check-in/undo/` — `{ person_ids, event_id? }` remove today’s Present records you are allowed to undo (household, guests you invited; staff may undo any visitor in the event branch).
  - `GET|POST /api/events/self-check-in/visitors/` — name search (visitors + Invited prospects) / check in existing person, check in prospect (`prospect_id`), or add a guest. POSTs require `attendance_venue` when the event is hybrid.

### Attendance Report (today and past occurrences)

Available from Event Details and the check-in page when the selected occurrence date is today or earlier (local calendar day). Future occurrences keep Open Check-In only. No new backend report API — the report is computed in the browser from people + attendance for that occurrence.

- When **`track_expected_attendees`** is on:
  - **Summary:** Expected, Checked In, **Onsite**, **Online**, Remaining, Surprises, Tardy; optional **Online by venue** breakdown; attendance rate vs expected pool.
  - **Breakdowns:** Checked-in and remaining counts by person status and cluster.
  - **Surprises list** and a searchable **checked-in roster** with mode/venue chips.
  - **Download CSV** includes Expected / Remaining / Surprises summary rows and `checked_in` / `surprise` / `remaining` person categories.
- When tracking is **off** (open):
  - **Summary:** Checked In, Onsite, Online, Tardy (no Expected / Remaining / Surprises or attendance rate).
  - Checked-in by status / by cluster and searchable roster remain; remaining and surprises sections are omitted.
  - **Download CSV** omits expected/remaining/surprises fields; all present people are `checked_in`.

Expected/Remaining/Surprises (when tracking) use the expected-include flags (same as check-in Total). Deceased people are excluded from Expected / Remaining in all cases.

## Room booking and approvals

Rooms are bookable resources. Create, update, approve, and split-edit all run two hard checks (approved **and** pending bookings occupy the slot; rejected does not):

1. **Sunday Service uniqueness** — a branch cannot have two overlapping Sunday Services, even in different rooms or offsite. Evening services that do not overlap are still allowed. Other branches can run at the same time.
2. **Room booking** — an `EventRoom` cannot be double-booked. Any overlapping event in the same room is rejected. Offsite events (`room` is null) do not occupy a room, except **Meeting**, which cannot be offsite. Back-to-back times (`11:00` end vs `11:00` start) are allowed.

Recurring series use `generate_occurrences` (including `excluded_dates`). Split-edit still ignores the parent series dates being vacated.

### Who publishes vs who requests

- **Publish immediately** (`booking_status=approved`): Admin, Pastor, Events Coordinator, Events Senior Coordinator.
- **Submit for approval** (`pending`): Coordinator or Senior Coordinator of a **non-Events** module (Cluster, Evangelism, Sunday School, Lessons, Ministries, Finance). Toast copy: booking submitted for Events Coordinator approval.
- **Approve / reject**: same people who publish immediately. `POST /api/events/{id}/approve/` re-runs conflict checks; `POST /api/events/{id}/reject/` frees the slot. Optional `review_note`.

If someone has **both** Events Coordinator/Senior **and** another module, Events leadership wins: they publish immediately and can approve.

Events does **not** use Teacher or Bible Sharer. Reporters, Teachers, Bible Sharers, and plain members cannot create events.

Pending events:

- Visible to the requester and to approvers; hidden from ordinary members on the agenda/calendar.
- Do not open self-check-in until approved.
- Requester may edit or cancel their own pending request (still conflict-checked). They cannot edit other people’s events, manage types/rooms, or split-edit someone else’s series.
- If a requester changes room or time on an event they created that is already approved, it returns to `pending`. Approvers can edit approved events without re-approval.

Existing rows migrated as `approved`. Duplicate historical Sunday Services are not auto-merged.

## Testing

Recurring frequencies, skip/end/split, and series `DELETE` are covered by `apps.events.tests.test_recurrence` and `apps.events.tests.test_recurrence_delete`. Self check-in is covered by `apps.events.tests.test_self_checkin`. Attendance mode/venues are covered by `apps.events.tests.test_attendance_mode_venues`. Sunday Service uniqueness is covered by `apps.events.tests.test_sunday_service_uniqueness`. Room booking, requester permissions, and approve/reject are covered by `apps.events.tests.test_room_booking`. Meeting room holds and First Activity exclusion are covered by `apps.events.tests.test_meeting_type`. AWTA church-wide / HQ national permissions are covered by `apps.events.tests.test_national_awta`. Paid registration (tiers, payments, check-in gate) is covered by `apps.events.tests.test_registration`.

Run them (uses SQLite to avoid Postgres permissions):

```bash
cd backend
source venv/bin/activate
python manage.py test apps.events.tests --settings=core.settings_test
```

Ensure the virtual environment is activated so Django picks up the bundled dependencies (DRF, pytest, etc.).
