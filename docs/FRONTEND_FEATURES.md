## Frontend Feature Map

### Pages (App Router)

- `src/app/page.tsx`: Landing/dashboard entry
- `src/app/dashboard/page.tsx`: Dashboard widgets (overview)
- `src/app/people/page.tsx`: People & Families management
  - Tabs: People | Families
  - People: search, filter (role, date range), table listing via `PeopleTable`
  - Create person via `PersonForm` (uses `usePeople` hook → backend)
  - **Families tab:** `FamilyManagementDashboard` with stacked mobile toolbar (search, branch, Table/Cards, Sort, Filter), filter chips in toolbar card, responsive unassigned-members grid
- `src/app/clusters/page.tsx`: Clusters hub via `ClustersPageView` — same stacked list toolbar on the Clusters tab (search, branch, Table/Cards, Select, Bulk, Sort, Filter)
- `src/app/finance/page.tsx`: Finance hub for donations, offerings, and pledges
- `src/app/members/page.tsx`: Members listing placeholder

### Hooks & Components (referenced)

- `hooks/usePeople`: Fetch, create, update, delete people via `/api/people/`
- Forms: `components/people/PersonForm`, `components/families/FamilyForm`
- Tables/Cards: `components/people/PeopleTable`, `components/families/FamilyCard`
- Layout/UI: `components/layout/DashboardLayout`, `components/ui/*`, `SearchBar`, `FilterOptions`
- **List toolbars** (Families, Clusters, Evangelism Groups, Each 1 Reach 1): shared `ToolbarSearch`, `ViewModeToggle`, and classes in `lib/toolbarStyles.ts`. Mobile layout stacks rows — full-width search, branch + Table/Cards, then wrapping action buttons (Select, Sort, Filter, etc.) and filter chips; toolbar card uses `p-4 md:p-6`. On viewports below `md`, Table list mode falls back to cards (`lib/listViewMode.ts`).

### Styling & Libraries

- Tailwind CSS, Radix UI, Heroicons, React Hook Form, Zod
- Charts/tables libraries are available (Recharts, FullCalendar) for future pages

### Navbar notifications

- `components/layout/NotificationBell.tsx`: Bell dropdown in the top navbar (alerts + recent activity)
- `hooks/useNotifications.ts`: Fetches `/api/notifications/`, polls every 60s, dismiss / dismiss-all
- Hidden for `VISITOR` role; badge count reflects **alerts** only
- See [NOTIFICATIONS.md](./NOTIFICATIONS.md) for types, deep links, and coordinator report reminders

### Navbar quick actions (+ menu)

- `components/layout/NavbarQuickActions.tsx`: Circular **+** button before the notification bell; dropdown of role- and module-gated shortcuts
- `lib/quickActionsConfig.ts`: Shared action definitions and `getAvailableQuickActions()` (also used by dashboard `QuickActions` card)
- `hooks/useModuleSettings.ts`: Loads module on/off flags for gating (EVANGELISM, CLUSTER, etc.)
- Hidden for `VISITOR`; hidden entirely when no actions apply to the user
- Actions navigate via `?action=` query params on target pages (same pattern as dashboard quick actions)

| Action | Deep link |
|--------|-----------|
| Add Person / Add Visitor | `/people?action=create` or `add-visitor` |
| Create Event | `/events?action=create` |
| Submit Cluster Report | `/clusters?action=submit-report` |
| Submit Evangelism Report | `/evangelism?action=submit-report` |
| Log Lesson Session | `/lessons?action=log-session` |

Record Donation is intentionally not included (finance `?action=add-donation` can be wired later).

### Evangelism page (`/evangelism`)

- Main hub: `src/app/evangelism/page.tsx` with tabs **Groups | Each 1 Reach 1 | Tally | Reports | Bible Sharers**.
- **Groups tab** (shared list toolbar pattern):
  - Row 1: full-width search; row 2: branch + Table/Cards; row 3: Select, Bulk Actions, Sort, Filter; row 4: filter chips
  - Table: `EvangelismGroupTable`; cards: `EvangelismGroupCard` (Table coerced to cards below `md`)
  - Client-side filter/sort via `evangelismGroupListUtils.ts`; server-side search/branch via `useEvangelismGroups`
  - Bulk actions: export (Excel/PDF/CSV), mark inactive, delete — all destructive/inactive flows use `ConfirmationModal`
  - Default group list shows active groups only (`is_active: true`)
- **Each 1 Reach 1:** `Each1Reach1Dashboard` uses the same toolbar pattern as Groups (search, branch, Table/Cards, year/status filters, Create Goal); defaults to cards; Table coerced to cards below `md`
- **Add Visitor (`ProspectForm`)** and **weekly report modals** stack Cancel/Submit full-width on mobile (`flex-col-reverse sm:flex-row`, 44px touch targets)
- **Tally / Reports:** monthly people tally and weekly unified tally; gathering type badges use filled tonal styling in evangelism components
- Deep link `?action=submit-report` opens weekly report submission flow
- See [EVANGELISM_MODULE.md](./EVANGELISM_MODULE.md) for API, models, and full component map

### Lessons page (`/lessons`)

- Container/view split: `LessonsPageContainer` (data, branch filter, API) + `LessonsPageView` (layout).
- **Tabs:** Lesson Content (catalog) | Student Progress | Session Reports | Commitment Forms.
- **Branch filter** (right of tab row): scopes progress, enrollments, session reports, and summary stats; lesson catalog and commitment PDF stay global. See [LESSONS_MODULE.md](./LESSONS_MODULE.md#branch-scoping).
- **Session Reports:** all lessons and pre-lessons by default; filters for lesson, teacher, student, month/year (defaults to current month/year).
- **Assign Lessons:** dropdown on Student Progress; only visitors/members without finished lessons and without existing progress.
- Deep link `?action=log-session` opens Session Reports and the log-session modal.

### Notes

- Families page uses local state; wiring to backend families endpoints can be added later.
- People list filters out the `admin` user and entries without a name on the frontend only (API remains unchanged).
