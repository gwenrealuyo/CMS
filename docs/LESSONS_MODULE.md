# Lessons Module Guide

## Data Model & Storage

- `apps.lessons.models.Lesson` holds the canonical content for each lesson. Lessons are versioned using the immutable `code` (e.g. `"new-converts-course-lesson-1"`) plus a human friendly `version_label`. Only one row per code is flagged with `is_latest=True`; superseded versions stay in the table for history.
- `LessonJourney` stores the default journey metadata (`journey_type`, `title_template`, `note_template`) that is applied when a participant finishes the lesson. The current default type is `LESSON`.
- `PersonLessonProgress` links a `Person` to a specific lesson version and tracks status (`ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `SKIPPED`) along with timestamps and notes. Completing a lesson automatically creates (or updates) a `people.models.Journey` of type `LESSON`.
- `LessonStudentEnrollment` is the canonical per-student lessons record (teacher assignment + one-time commitment signature fields: `commitment_signed`, `commitment_signed_at`, `commitment_signed_by`).
- `LessonSettings` is a singleton row (id=1) that stores the globally uploaded commitment-form PDF (`commitment_form`) and the printable NCC lessons booklet (`ncc_lessons_pdf`), plus who uploaded each file.
- `LessonSessionReport` captures the 1-on-1 teaching workflow:
  - `session_type`: `LESSON` (linked to a catalog lesson) or `PRE_LESSON` (introduction / other pre-course sessions; `lesson` is null).
  - `pre_lesson_kind`: `INTRODUCTION` or `OTHER` when `session_type=PRE_LESSON`.
  - Teacher, student, optional `lesson`, optional linked `PersonLessonProgress`, `session_date` (scheduled), `session_start` (actual), score, next schedule, remarks, and submitter.
  - Reports are ordered by newest session first.

Default data for the “New Converts Course” (7 lessons) is seeded via the `0002_default_lessons` migration. The app migration chain is intentionally minimal (`0001_initial` + `0002_default_lessons`); re-running `0002` after edits requires rolling back to `0001` first.

### Schema drift (local dev)

If migrations show as applied but Session Reports or Enrollments APIs fail with `lessons_lessonstudentenrollment does not exist` or `session_type does not exist`, the database has a pre-squash lessons schema. Run:

```bash
cd backend && python manage.py sync_dev_schema
```

This drops all `lessons_*` tables and re-migrates (clears lesson progress, enrollments, and session reports; re-seeds default lessons via `0002`).

## Progress & Journey Synchronisation

- `apps.lessons.services.mark_progress_completed` generates the `LESSON` journey when a progress record transitions to `COMPLETED`. Rolling a lesson back triggers `revert_progress_completion`.
- Commitment form signatures are tracked on `LessonStudentEnrollment` and create a `NOTE`-type journey titled “Commitment Form Signed”. Clearing the signature removes that journey entry.
- **LESSON session reports** call `_sync_progress` inside `LessonSessionReportViewSet`: if a matching `PersonLessonProgress` does not exist it is created, then completion is applied via `mark_progress_completed`.
- **PRE_LESSON session reports** (Introduction and Other) do not complete catalog progress. They upsert a `LESSON` journey on the student via `sync_pre_lesson_session_journey`: title is the pre-lesson kind label (`Introduction` / `Other`), description is the session remarks, and date is `session_date`. The report stores a OneToOne link on `LessonSessionReport.journey`.
- **Deleting a session report** (API or Django admin) first clears any linked pre-lesson journey, then calls `reconcile_student_progress_from_reports(student, force_report_rules=True)`, which realigns progress with remaining LESSON-type reports. Students with zero LESSON reports keep legacy completion via `has_finished_lessons` / `lessons_finished_at` when applicable.

### Person profile sync

- When a person has `PersonLessonProgress` rows for active latest lessons, completing or reverting lessons via `mark_progress_completed` / `revert_progress_completion` updates `people.Person.has_finished_lessons` and `lessons_finished_at`.
- **All complete:** `has_finished_lessons=True` and `lessons_finished_at` is the latest `completed_at` date across those progress rows.
- **Not all complete:** both fields are cleared (same direction as commitment-form eligibility).
- Persons with no module progress rows are left unchanged (pure legacy manual flags).
- Legacy manual entry (profile → progress backfill) still works; see below.

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
- Are **not** the logged-in user (the Assign Lessons picker hides them so a teacher cannot pick themselves)

A person cannot be their own lessons teacher (`student_id != teacher_id`). A lessons teacher may still be assigned as a student of a **different** teacher. This is enforced on bulk assign, enrollment create, teacher transfer, session reports, and person-profile `lesson_teacher_id`.

Validation is enforced in `LessonBulkAssignSerializer` via `person_assignment_eligibility_error()` and `student_cannot_be_own_teacher_error()` in `apps.lessons.services`. The UI also hides students who already appear in the global progress list.

## Branch Scoping

Student-linked data is filtered by church branch (`people.Person.branch`), consistent with Clusters and Evangelism.

**Backend** — `apps.lessons.branch_scope.apply_lessons_branch_filter()`:

| Who can pick branch (`branch_id` query param) | Scope |
|-----------------------------------------------|--------|
| `ADMIN`, `PASTOR` | Optional `branch_id` / `branch`; omit param for all branches |
| Lessons senior coordinator **or NCC primary coordinator**, at HQ | Optional `branch_id`; omit param for all branches. UI defaults to the user's own branch. |
| Everyone else with `user.branch` (including Lessons coordinators, NCC support coordinators, satellite seniors/primaries, and teachers) | Forced to `user.branch` (query param ignored) |
| Users without a branch | Empty queryset |

Applied to:

- `PersonLessonProgressViewSet` (`person__branch_id`)
- `LessonSessionReportViewSet` (`student__branch_id`)
- `LessonStudentEnrollmentViewSet` (`student__branch_id`)
- Progress `summary` action (`unassigned_visitors` via `apply_branch_to_person_queryset`)

**Not branch-scoped:** lesson catalog CRUD (`LessonViewSet`) and global PDFs (`commitment-form` GET/POST and `ncc-lessons-pdf` POST).

**Frontend** — [`lessonsBranchFilter.ts`](../frontend/src/lib/lessonsBranchFilter.ts):

- Branch `<select>` on the right of the content tab row (`Lesson Content` | `Student Progress` | `Session Reports` | `Files`).
- Editable for ADMIN, PASTOR, and HQ Lessons seniors (Admin Settings **or** NCC primary coordinator). Locked with tooltip for teachers, Lessons coordinators, NCC support coordinators, and satellite seniors.
- Changing branch refetches summary, progress, enrollments, and session reports (when that tab is active). Assign/session people dropdowns are filtered client-side to the selected branch. The filter **defaults to the user's own branch** (not “All branches”).

## Commitment Form & NCC Lessons PDF

- Commitment form route: `/api/lessons/lessons/commitment-form/` (GET/POST on `LessonViewSet` action). GET returns the singleton settings, including both PDFs. POST uploads replace the commitment file and log `uploaded_by`.
- NCC lessons booklet route: `/api/lessons/lessons/ncc-lessons-pdf/` (POST). Uploads replace `ncc_lessons_pdf` and set `ncc_lessons_pdf_uploaded_by` / `ncc_lessons_pdf_updated_at` without changing the commitment form timestamp. PDF extension is required.
- Frontend **Files** tab surfaces both global PDFs (NCC booklet first, then the commitment form) with view, download, and replace actions. Uploaded files live under `backend/media/lessons/commitment_forms/` and `backend/media/lessons/ncc_lessons/` (gitignored).
- Commitment signing is a one-time student-level action from the person progress modal (after all active latest lessons are completed) via `/api/lessons/enrollments/{id}/commitment/`.

## Session Reports & Teacher Workflow

- `LessonSessionReportViewSet` at `/api/lessons/session-reports/` with full CRUD.
- **Query params:** `lesson`, `teacher`, `student`, `session_type`, `date_from`, `date_to`, `branch_id` (or `branch`).
- Teachers default to the submitting user when no `teacher_id` is provided. Role-based queryset rules still apply (teachers see only their reports; members see only their own).
- **Frontend Session Reports tab:**
  - Loads **all** reports when the tab is opened (not tied to the sidebar lesson picker).
  - Default date filters: **current month** and **current year** (`createDefaultSessionFilters` in `lessonsUtils.ts`).
  - Lessons teachers (TEACHER assignment, not Admin/Pastor/Coordinator): teacher filter **defaults to and is locked on** the logged-in user; student picker and log-session student list are limited to their assigned students.
  - Optional filters: lesson (catalog lesson only—pre-lessons appear when lesson filter is “All lessons”), teacher (coordinators/admins/pastors), student, month, year.
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
| `/api/lessons/lessons/commitment-form/` | GET/POST global commitment PDF; GET also returns the NCC booklet fields. |
| `/api/lessons/lessons/ncc-lessons-pdf/` | POST global NCC lessons booklet PDF. |
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
| **Files** | `NccLessonsPdfSection` + `CommitmentFormSection`; global PDFs (NCC booklet and commitment form). Internal tab id remains `commitment`. |

### Key components

- `LessonList` / `LessonDetailPanel` / `LessonForm` — catalog CRUD.
- `NccLessonsPdfSection` / `CommitmentFormSection` — global booklet and commitment PDFs on the Files tab (`LessonPdfResourceCard`).
- `LessonStatsCards` — dashboard-style metrics (ADMIN, PASTOR, senior coordinators including NCC primary, cluster coordinators); respects `branch_id` on summary API.
- `AssignLessonsDropdown` — multi-select assign; eligible students only; status/cluster under names.
- `PersonLessonProgressModal` — per-student progress, commitment toggle, teacher transfer (coordinators). Coordinators can **Assign teacher** from this modal when a student has progress (including finished / legacy) but no enrollment.
- `LessonSessionReportForm` — log/edit sessions (lesson vs pre-lesson topic picker).
- `LessonContentTabs` — tab bar plus optional `branchFilter` slot on the right.

### Permissions (UI)

- Lesson write / assign / session log: module coordinators, **NCC ministry primary/support coordinators**, and roles with `HasModuleAccess('LESSONS', 'write')` (see [ACCESS_CONTROL.md](./ACCESS_CONTROL.md)).
- Branch picker: ADMIN, PASTOR, and HQ Lessons seniors (including HQ NCC primary) only.

NCC ministry roles (no extra `ModuleCoordinator` row):

| NCC ministry role | Lessons access |
|-------------------|----------------|
| **Support coordinator** | Same as Lessons Coordinator (all students in their branch; assign, log sessions, manage that branch's NCC roster). Does not expand People/Families. |
| **Primary coordinator** | Same as Lessons Senior Coordinator for Lessons/NCC. Own branch unless the NCC ministry is HQ, in which case they may view other branches. People/Families stay unchanged. |

## Testing

Automated tests live under `apps.lessons.tests`:

| Module | Coverage |
|--------|----------|
| `test_session_reports.py` | PRE_LESSON vs LESSON progress, remarks validation, pre-lesson LESSON journeys, delete + reconcile |
| `test_enrollments.py` | Assign eligibility, commitment, transfers |
| `test_catalog_permissions.py` | Catalog CRUD, commitment PDF, NCC booklet upload permissions |
| `test_ncc_coordinator_access.py` | NCC primary/support Lessons access, HQ vs satellite branch picking |

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
