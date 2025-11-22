# Lessons Module Guide

## Data Model & Storage

- `apps.lessons.models.Lesson` holds the canonical content for each lesson. Lessons are versioned using the immutable `code` (e.g. `"new-converts-course-lesson-1"`) plus a human friendly `version_label`. Only one row per code is flagged with `is_latest=True`; superseded versions stay in the table for history.
- `LessonJourney` stores the default journey metadata (`journey_type`, `title_template`, `note_template`) that is applied when a participant finishes the lesson. The current default type is `LESSON`.
- `PersonLessonProgress` links a `Person` to a specific lesson version and tracks status (`ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `SKIPPED`) along with timestamps, notes, and commitment-form flags (`commitment_signed`, `commitment_signed_at`, `commitment_signed_by`). Completing a lesson automatically creates (or updates) a `people.models.Journey` of type `LESSON`.
- `LessonSettings` is a singleton row (id=1) that stores the globally uploaded commitment-form PDF (`commitment_form`) and who uploaded it.
- `LessonSessionReport` captures the 1-on-1 teaching workflow: teacher, student, lesson version, optional linked `PersonLessonProgress`, session date/time, qualitative score, next schedule, remarks, and the submitting user. Reports are ordered by newest session first. Saving a report auto-links (or creates) the relevant `PersonLessonProgress` row so progress dashboards stay in sync.

Default data for the “New Converts Course” (7 lessons) is seeded via the `0002_default_lessons` migration. Re-running that migration after edits requires rolling back to `0001` first.

## Progress & Journey Synchronisation

- `apps.lessons.services.mark_progress_completed` generates the `LESSON` journey when a progress record transitions to `COMPLETED`. Rolling a lesson back triggers `revert_progress_completion`.
- Commitment form signatures call `mark_commitment_signed`, which writes a `NOTE`-type journey titled “Commitment Form Signed” and timestamps the signer. Reverting the checkbox removes the journey through `revert_commitment_signed`.
- Session reports call `_sync_progress` inside `LessonSessionReportViewSet`: if a matching `PersonLessonProgress` doesn’t exist it is created and moved to `IN_PROGRESS`, ensuring the participant’s timeline reflects the tutoring activity.

## Commitment Form Management

- `LessonSettingsViewSet` (route: `/api/lessons/lessons/commitment-form/`) allows GET/POST of the PDF. Uploads replace the existing file and log the `uploaded_by`.
- Frontend surfaces the current PDF with download & replace actions, plus a modal uploader. Uploaded files are stored under `backend/media/lessons/commitment_forms/` which is ignored via `.gitignore`.
- Participants’ progress rows expose a “Signed” toggle that opens a confirmation modal; confirming patches the `commitment_signed` flag and triggers journey bookkeeping server-side.

## Session Reports & Teacher Workflow

- `LessonSessionReportViewSet` is mounted at `/api/lessons/session-reports/` with full CRUD. Query params `lesson`, `teacher`, `student`, `date_from`, `date_to` filter the list view.
- Teachers default to the submitting user when no `teacher_id` is provided (any role except `VISITOR` is accepted). When historical data is imported, an explicit `teacher_id` can be supplied.
- Creating or updating a report either associates the latest matching `PersonLessonProgress` or creates one in `IN_PROGRESS` state if none exists.
- Deleting a report does **not** roll back progress automatically; use the progress API if the completion status needs to change.

## API Surface

- `/api/lessons/lessons/` – CRUD for lesson definitions (includes nested journey config).
- `/api/lessons/progress/` – list/create/update participant progress; supports filtering by `person`, `lesson`, `status`.
- `/api/lessons/progress/{id}/complete/` – marks a progress record complete; accepts optional note, timestamp, and `completed_by`.
- `/api/lessons/progress/assign/` – bulk assignment of a lesson to multiple people.
- `/api/lessons/progress/summary/` – aggregates status counts per lesson plus `unassigned_visitors` (visitors without any lesson progress).
- `/api/lessons/lessons/commitment-form/` – upload/get the global commitment PDF.
- `/api/lessons/session-reports/` – CRUD endpoint for 1-on-1 monitoring reports with filtering.

## Frontend Behavior

- `app/lessons/page.tsx` orchestrates the module: loads lessons (including superseded versions), renders stats cards, handles lesson CRUD modal, assignment modal with search, and the commitment-form upload flow.
- `LessonDetailPanel` defaults the “Journey Settings” and “Metadata” cards to collapsed, with toggles to reveal details, keeping the UI focused on actionable info.
- `LessonProgressTable` shows participant status, member IDs, commitment checkbox, and exposes a “Log Session” button that opens the session-report modal prefilled with the participant.
- `LessonSessionReportForm` powers both new and edit flows, pre-filling the teacher with the “current user” (cached in `localStorage`), and validates date/time inputs before submit.
- A dedicated “Session Reports” card lists reports with teacher/student badges, supports teacher/student/date filters, and can export the current view to CSV.
- `LessonStatsCards` (also used on the dashboard) highlights quick metrics: visitors with no lessons, assigned/in-progress/completed counts, and aligns badge colours with the progress table legend.

## Testing

- There are currently no automated tests in `apps.lessons.tests`. When adding coverage, focus first on:
  - Progress completion + journey creation/reversion.
  - Commitment signature flow (including journey toggling).
  - Session report synchronisation of progress records and filtering logic.
- Run the existing suite (placeholder) with:

```bash
cd backend
source venv/bin/activate
python manage.py test apps.lessons
```

Add `--settings=core.settings_test` if you introduce tests that rely on the lightweight SQLite configuration already used elsewhere.
