# Lessons Module Guide

## Data Model & Storage

- `apps.lessons.models.Lesson` holds the canonical content for each lesson. Lessons are versioned using the immutable `code` (e.g. `"new-converts-course-lesson-1"`) plus a human friendly `version_label`. Only one row per code is flagged with `is_latest=True`; superseded versions stay in the table for history.
- `LessonJourney` stores the default journey metadata (`journey_type`, `title_template`, `note_template`) that is applied when a participant finishes the lesson. The current default type is `LESSON`.
- `PersonLessonProgress` links a `Person` to a specific lesson version and tracks status (`ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `SKIPPED`) along with timestamps and notes. Completing a lesson automatically creates (or updates) a `people.models.Journey` of type `LESSON`.
- `LessonStudentEnrollment` is the canonical per-student lessons record (teacher assignment + one-time commitment signature fields: `commitment_signed`, `commitment_signed_at`, `commitment_signed_by`).
- `LessonSettings` is a singleton row (id=1) that stores the globally uploaded commitment-form PDF (`commitment_form`) and who uploaded it.
- `LessonSessionReport` captures the 1-on-1 teaching workflow:
  - `session_type`: `LESSON` (linked to a catalog lesson) or `PRE_LESSON` (introduction / other pre-course sessions; `lesson` is null).
  - `pre_lesson_kind`: `INTRODUCTION` or `OTHER` when `session_type=PRE_LESSON`.
  - Teacher, student, optional `lesson`, optional linked `PersonLessonProgress`, `session_date` (scheduled), `session_start` (actual), score, next schedule, remarks, and submitter.
  - Reports are ordered by newest session first.

Default data for the “New Converts Course” (7 lessons) is seeded via the `0002_default_lessons` migration. The app migration chain is intentionally minimal (`0001_initial` + `0002_default_lessons`); re-running `0002` after edits requires rolling back to `0001` first.

## Progress & Journey Synchronisation

- `apps.lessons.services.mark_progress_completed` generates the `LESSON` journey when a progress record transitions to `COMPLETED`. Rolling a lesson back triggers `revert_progress_completion`.
- Commitment form signatures are tracked on `LessonStudentEnrollment` and create a `NOTE`-type journey titled “Commitment Form Signed”. Clearing the signature removes that journey entry.
- **LESSON session reports** call `_sync_progress` inside `LessonSessionReportViewSet`: if a matching `PersonLessonProgress` does not exist it is created, then completion is applied via `mark_progress_completed`. **PRE_LESSON** reports do not complete catalog progress.
- **Deleting a session report** (API or Django admin) calls `reconcile_student_progress_from_reports(student, force_report_rules=True)`, which realigns progress with remaining LESSON-type reports. Students with zero LESSON reports keep legacy completion via `has_finished_lessons` / `lessons_finished_at` when applicable.

## Legacy Completion Backfill

- Some members may have completed lessons before the app was used. This is handled through people fields:
  - `people.Person.has_finished_lessons`
  - `people.Person.lessons_finished_at`
- When a person is saved with `has_finished_lessons=True` and `lessons_finished_at` present, the system creates missing `PersonLessonProgress` rows for active latest lessons and marks those new rows as `COMPLETED`.
- Backfill behavior is non-destructive: existing lesson progress records are not overwritten (create-missing-only).
- If `has_finished_lessons=True` but `lessons_finished_at` is missing, legacy backfill does not run.

## Lesson Assignment Eligibility

Bulk assign (`POST /api/lessons/progress/assign/`) and the frontend **Assign Lessons** dropdown only target students who:

- Do **not** have `has_finished_lessons=True`
- Do **not** already have any `PersonLessonProgress` row

Validation is enforced in `LessonBulkAssignSerializer` via `person_assignment_eligibility_error()` in `apps.lessons.services`. The UI also hides students who already appear in the global progress list.

## Branch Scoping

Student-linked data is filtered by church branch (`people.Person.branch`), consistent with Clusters and Evangelism.

**Backend** — `apps.lessons.branch_scope.apply_lessons_branch_filter()`:

| Who can pick branch (`branch_id` query param) | Scope |
|-----------------------------------------------|--------|
| `ADMIN`, `PASTOR`, senior Lessons coordinator | Optional `branch_id` / `branch`; omit param for all branches |
| Everyone else with `user.branch` | Forced to `user.branch` (query param ignored) |
| Users without a branch | Empty queryset |

Applied to:

- `PersonLessonProgressViewSet` (`person__branch_id`)
- `LessonSessionReportViewSet` (`student__branch_id`)
- `LessonStudentEnrollmentViewSet` (`student__branch_id`)
- Progress `summary` action (`unassigned_visitors` via `apply_branch_to_person_queryset`)

**Not branch-scoped:** lesson catalog CRUD (`LessonViewSet`) and global commitment PDF (`commitment-form` action).

**Frontend** — [`lessonsBranchFilter.ts`](../frontend/src/lib/lessonsBranchFilter.ts):

- Branch `<select>` on the right of the content tab row (`Lesson Content` | `Student Progress` | `Session Reports` | `Commitment Forms`).
- Editable for ADMIN, PASTOR, and `isSeniorCoordinator("LESSONS")`; locked with tooltip for teachers and other roles.
- Changing branch refetches summary, progress, enrollments, and session reports (when that tab is active). Assign/session people dropdowns are filtered client-side to the selected branch.

## Commitment Form Management

- Commitment form route: `/api/lessons/lessons/commitment-form/` (GET/POST on `LessonViewSet` action). Uploads replace the existing file and log `uploaded_by`.
- Frontend **Commitment Forms** tab surfaces the current PDF with download and replace actions. Uploaded files live under `backend/media/lessons/commitment_forms/` (gitignored).
- Commitment signing is a one-time student-level action from the person progress modal (after all active latest lessons are completed) via `/api/lessons/enrollments/{id}/commitment/`.

## Session Reports & Teacher Workflow

- `LessonSessionReportViewSet` at `/api/lessons/session-reports/` with full CRUD.
- **Query params:** `lesson`, `teacher`, `student`, `session_type`, `date_from`, `date_to`, `branch_id` (or `branch`).
- Teachers default to the submitting user when no `teacher_id` is provided. Role-based queryset rules still apply (teachers see only their reports; members see only their own).
- **Frontend Session Reports tab:**
  - Loads **all** reports when the tab is opened (not tied to the sidebar lesson picker).
  - Default date filters: **current month** and **current year** (`createDefaultSessionFilters` in `lessonsUtils.ts`).
  - Optional filters: lesson (catalog lesson only—pre-lessons appear when lesson filter is “All lessons”), teacher, student, month, year.
  - **Cards** and **table** views; table groups rows by student with expand/collapse; table includes a **Session** column (lesson title or pre-lesson label).
  - CSV export uses `formatSessionTopicLabel` for the lesson column (`session-reports.csv`).
- Deep link: `/lessons?action=log-session` switches to the Session Reports tab and opens the log modal (no sidebar lesson required).

## API Surface

| Endpoint | Purpose |
|----------|---------|
| `/api/lessons/lessons/` | CRUD for lesson definitions (includes journey config). Not branch-filtered. |
| `/api/lessons/progress/` | List/create/update progress; filter: `person`, `lesson`, `status`, `branch_id`. |
| `/api/lessons/progress/{id}/complete/` | Mark progress complete (optional note, timestamp, `completed_by`). |
| `/api/lessons/progress/assign/` | Bulk assign one lesson to multiple people (eligibility rules apply). |
| `/api/lessons/progress/summary/` | Person-level status buckets, lesson breakdown, `unassigned_visitors`; supports `year`, `lesson`, `include_superseded`, `branch_id`. |
| `/api/lessons/lessons/commitment-form/` | Upload/get global commitment PDF. |
| `/api/lessons/enrollments/` | Student–teacher enrollments; filter: `student`, `teacher`, `branch_id`. |
| `/api/lessons/enrollments/{id}/commitment/` | Set/clear commitment signature. |
| `/api/lessons/enrollments/{id}/transfer/` | Transfer student to another teacher. |
| `/api/lessons/session-reports/` | Session report CRUD; filters above including `branch_id`. |

## Frontend Architecture

Entry: [`frontend/src/app/lessons/page.tsx`](../frontend/src/app/lessons/page.tsx) → [`LessonsPageContainer.tsx`](../frontend/src/app/lessons/LessonsPageContainer.tsx) → [`LessonsPageView.tsx`](../frontend/src/app/lessons/LessonsPageView.tsx).

### Content tabs

| Tab | Purpose |
|-----|---------|
| **Lesson Content** | Sidebar lesson catalog + `LessonDetailPanel`; global, not branch-filtered. |
| **Student Progress** | `MemberProgressSection` + `LessonProgressTable`; branch-scoped. Person column shows **status** and **cluster** chips (not member ID). |
| **Session Reports** | `SessionReportsSection`; branch-scoped; see above. |
| **Commitment Forms** | `CommitmentFormSection`; global PDF only. |

### Key components

- `LessonList` / `LessonDetailPanel` / `LessonForm` — catalog CRUD.
- `LessonStatsCards` — dashboard-style metrics (ADMIN, PASTOR, senior coordinators, cluster coordinators); respects `branch_id` on summary API.
- `AssignLessonsDropdown` — multi-select assign; eligible students only; status/cluster under names.
- `PersonLessonProgressModal` — per-student progress, commitment toggle, teacher transfer (coordinators).
- `LessonSessionReportForm` — log/edit sessions (lesson vs pre-lesson topic picker).
- `LessonContentTabs` — tab bar plus optional `branchFilter` slot on the right.

### Permissions (UI)

- Lesson write / assign / session log: module coordinators and roles with `HasModuleAccess('LESSONS', 'write')` (see [ACCESS_CONTROL.md](./ACCESS_CONTROL.md)).
- Branch picker: ADMIN, PASTOR, senior Lessons coordinator only.

## Testing

Automated tests live under `apps.lessons.tests`:

| Module | Coverage |
|--------|----------|
| `test_session_reports.py` | PRE_LESSON vs LESSON progress, remarks validation, delete + reconcile |
| `test_enrollments.py` | Assign eligibility, commitment, transfers |
| `test_branch_scope.py` | `branch_id` filtering, teacher cannot override branch, no-branch user |

Run with SQLite test settings (required in this repo):

```bash
cd backend
python3 manage.py test apps.lessons.tests --settings=core.settings_test
```

Or a single file:

```bash
python3 manage.py test apps.lessons.tests.test_branch_scope --settings=core.settings_test
```

## Related Documentation

- [ACCESS_CONTROL.md](./ACCESS_CONTROL.md) — role and module permissions
- [FRONTEND_FEATURES.md](./FRONTEND_FEATURES.md) — app routes and deep links
- [RUNBOOK.md](./RUNBOOK.md) — migrations and local setup
