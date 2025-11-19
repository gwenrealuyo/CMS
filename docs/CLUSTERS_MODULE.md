# Clusters Module Guide

## Overview

The Clusters module manages church clusters (small groups) and their weekly meeting reports. Key features include:

- **Cluster Management**: Create, edit, delete, and manage clusters with coordinators, members, and families
- **Weekly Reports**: Submit and track weekly cluster meeting reports with attendance, activities, and offerings
- **Attendance Logging**: Efficient attendance selection with bulk options and previous attendance tracking
- **Analytics Dashboard**: Visual charts and analytics showing attendance trends, cluster comparisons, and gathering type distribution
- **Smart Pre-filling**: Automatically pre-fills attendance based on previous reports and active members
- **Filter Independence**: Report forms work correctly regardless of dashboard filter settings

## Data Model & Storage

### Cluster Model

- `apps.clusters.models.Cluster` represents a church cluster (small group) with:
  - `code` (string, max 100 chars, unique, nullable) – unique cluster identifier (e.g., "CLU-001")
  - `name` (string, max 100 chars, nullable) – cluster name (e.g., "North Cluster")
  - `coordinator` (ForeignKey to `people.Person`, nullable) – person who coordinates the cluster
  - `families` (ManyToMany to `people.Family`) – families that belong to this cluster
  - `members` (ManyToMany to `people.Person`, related_name="clusters") – individual members (not necessarily in a family)
  - `location` (string, max 150 chars, blank) – physical location/address
  - `meeting_schedule` (string, max 200 chars, blank) – when the cluster meets (e.g., "Every Sunday at 7 PM")
  - `description` (text field, blank) – additional details about the cluster
  - `created_at` (DateTimeField, auto_now_add) – when the cluster was created
- Default ordering: by `created_at`
- The `person.clusters` reverse relationship works via the ManyToMany field with `related_name="clusters"`

### Family-Member Relationship

**Important**: When a family is added to a cluster, all members of that family are automatically added to the cluster's members list. This ensures consistency between family assignments and member assignments.

- **Automatic Member Addition (Backend)**: When you assign families to a cluster via the API or form submission, the backend automatically adds all family members to the cluster's members.
- **Real-Time UI Updates (Frontend)**: In the cluster form, when you add a family, all family members immediately appear in the members field before submitting. This provides instant visual feedback.
- **Family Removal**: When a family is removed from the cluster form, all its members are also automatically removed from the members list in real-time.
- **Manual Override**: Users can manually remove individual members from the cluster's members list if they don't want certain family members to be part of the cluster.
- **Union Behavior**: If you also specify individual members when creating/updating a cluster, the system combines (unions) the family members with the individually specified members, avoiding duplicates.

### ClusterWeeklyReport Model

- `apps.clusters.models.ClusterWeeklyReport` tracks weekly cluster meeting reports with:
  - `cluster` (ForeignKey to Cluster, CASCADE delete) – the cluster this report is for
  - `year` (IntegerField) – year of the report (e.g., 2025)
  - `week_number` (IntegerField) – ISO week number (1-53)
  - `meeting_date` (DateField) – actual date the cluster meeting was held
  - `members_attended` (ManyToMany to `people.Person`, filtered to role="MEMBER") – members who attended
  - `visitors_attended` (ManyToMany to `people.Person`, filtered to role="VISITOR") – visitors who attended
  - `gathering_type` (CharField, choices: PHYSICAL, ONLINE, HYBRID) – how the meeting was conducted
  - `activities_held` (TextField, blank) – activities/events during the meeting
  - `prayer_requests` (TextField, blank) – prayer requests shared
  - `testimonies` (TextField, blank) – testimonies shared
  - `offerings` (DecimalField, max 10 digits, 2 decimal places, default 0.00) – financial offerings collected
  - `highlights` (TextField, blank) – positive events or achievements
  - `lowlights` (TextField, blank) – challenges or concerns
  - `submitted_by` (ForeignKey to `people.Person`, nullable) – person who submitted the report
  - `submitted_at` (DateTimeField, auto_now_add) – when the report was submitted
  - `updated_at` (DateTimeField, auto_now) – when the report was last updated
- **Computed Properties**:
  - `members_present`: Returns count of `members_attended`
  - `visitors_present`: Returns count of `visitors_attended`
  - `member_attendance_rate`: Returns percentage of cluster members who attended (0-100)
- Default ordering: by `-year`, then `-week_number`
- Unique constraint: `unique_together = ["cluster", "year", "week_number"]` – prevents duplicate reports for the same cluster/week

### Cross-App References

All ForeignKey and ManyToMany relationships use string references to avoid circular imports:
  - `coordinator = models.ForeignKey('people.Person', ...)`
  - `families = models.ManyToManyField('people.Family', ...)`
  - `members = models.ManyToManyField('people.Person', related_name="clusters", ...)`
- `submitted_by = models.ForeignKey('people.Person', ...)`
- `members_attended` and `visitors_attended` use `'people.Person'`

### Migrations

- `apps.clusters.migrations.0001_initial` – Creates Cluster and ClusterWeeklyReport tables with all relationships
- There is no seed data in migrations; use the management command for sample data.

## API Surface

All routes live under `/api/clusters/` (namespaced in `core.urls`):

### Clusters

- `/api/clusters/clusters/` – ClusterViewSet CRUD
  - `GET` – List all clusters
  - `POST` – Create a new cluster (requires `name` or `code`, optional `coordinator_id`, `families`, `members`, etc.)
  - `GET /{id}/` – Retrieve a specific cluster
  - `PUT /{id}/` – Update a cluster (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a cluster (cascades to reports)

### Cluster Weekly Reports

- `/api/clusters/cluster-weekly-reports/` – ClusterWeeklyReportViewSet CRUD with pagination (50 per page, configurable)
  - `GET` – List reports with filtering:
    - `?cluster={cluster_id}` – filter by cluster
    - `?year={year}` – filter by year
    - `?week_number={week}` – filter by week number
    - `?gathering_type={type}` – filter by gathering type (PHYSICAL, ONLINE, HYBRID)
    - `?submitted_by={person_id}` – filter by submitter
    - `?month={1-12}` – filter by month (uses meeting_date)
    - `?page={n}` – pagination
    - `?page_size={n}` – page size (max 100)
  - `POST` – Create a new report (requires `cluster`, `year`, `week_number`, `meeting_date`, `gathering_type`)
  - `GET /{id}/` – Retrieve a specific report
  - `PUT /{id}/` – Update a report (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a report
- `/api/clusters/cluster-weekly-reports/analytics/` – `GET` action returning analytics:
    - Optional query params: `?cluster={cluster_id}`, `?year={year}`, `?month={1-12}`, `?gathering_type={type}`, `?week_number={week}`
    - All filters are applied to the analytics calculation for dynamic results
  - Returns: `total_reports`, `total_attendance` (members/visitors), `average_attendance`, `total_offerings`, `gathering_type_distribution`
- `/api/clusters/cluster-weekly-reports/overdue/` – `GET` action returning clusters with overdue reports:
  - Returns: `current_year`, `current_week`, `overdue_count`, `overdue_clusters` (list of Cluster objects)

### Serializers

Serializers (`apps.clusters.serializers`) expose:
- `ClusterSerializer`:
  - `coordinator` – nested object with id, first_name, last_name, username (read-only)
  - `coordinator_id` – write-only field for setting coordinator
  - `families` – list of family IDs (when families are assigned, all family members are automatically added to members)
  - `members` – list of person IDs (automatically includes all family members when families are assigned)
  - **Automatic Member Addition**: The serializer's `create()` and `update()` methods automatically add all members from assigned families to the cluster's members list. Users can manually remove individual members if needed.
- `ClusterWeeklyReportSerializer`:
  - `cluster_name` – read-only cluster name
  - `cluster_code` – read-only cluster code
  - `members_attended_details` – read-only full person details for members (includes `role` and `status` fields)
  - `visitors_attended_details` – read-only full person details for visitors (includes `role` and `status` fields)
  - `submitted_by_details` – read-only full person details for submitter
  - `members_present`, `visitors_present`, `member_attendance_rate` – computed properties (read-only)

## Frontend Behavior

The Clusters hub lives at `frontend/src/app/clusters/page.tsx` and provides a comprehensive view of clusters and their weekly reports.

### Tabs

The page uses tabs similar to the Lessons page:
- **Clusters Tab**: Manage clusters (list, create, edit, delete)
- **Reports Tab**: View and manage cluster weekly reports

### Components Overview

- **`ClusterContentTabs`**: Tab navigation component (similar to LessonContentTabs)
- **Clusters Tab**:
  - Grid display of cluster cards showing:
    - Cluster name/code
  - Coordinator name
    - Member count
    - Family count
    - Edit/Delete actions
  - "Add Cluster" button to create new clusters
- **`ClusterForm`**: Form component for creating/editing clusters
  - **Real-Time Family-Member Sync**: When a family is added to the form, all family members immediately appear in the members field before submitting
  - **Family Removal**: When a family is removed from the form, all its members are automatically removed from the members list
  - **Manual Member Control**: Users can manually add or remove individual members regardless of family assignments
  - **Search Functionality**: Searchable inputs for families and members with dropdown suggestions
  - **Visual Feedback**: Selected families and members are displayed as chips/cards with remove buttons
- **Reports Tab**:
  - Table display of weekly reports with:
    - Cluster name/code
    - Year, week number, meeting date
    - Members/visitors present counts
  - Gathering type
    - Edit/Delete actions
  - "Add Report" button to create new reports
  - **Week Filter**: Filter reports by ISO week number with date range display
  - **Month Filter**: Filter reports by month (defaults to current month)
  - **Analytics Dashboard**: Visual charts and analytics cards showing attendance trends, cluster comparisons, and gathering type distribution
  - **Charts Toggle**: Option to hide/show visual analytics charts
- **`ClusterWeeklyReportForm`**: Form component for creating/editing weekly reports
  - **Week/Year Independence**: When editing a report, the form uses the report's actual `week_number` and `year` from `initialData`, independent of dashboard filters
  - **Previous Attendance Fetching**: Automatically fetches all previous reports for the selected cluster to determine previously attended members/visitors
  - **Week-Based Filtering**: Previous reports are filtered to only include reports from earlier weeks/years than the current report being edited
  - **Current Report Exclusion**: When editing, the current report is excluded from the "previous reports" list
  - **Form Data Sync**: `formData` is automatically synced with `initialData` when editing to ensure correct week/year values
- **`AttendanceSelector`**: Component for selecting members/visitors who attended
  - **Bulk Selection Options**:
    - "Select All": Selects all available members/visitors
    - "Deselect All": Clears all selections
    - "Select All Active": Selects all active members (for members field only)
    - "Select All Previously Attended": Selects members/visitors from previous reports
  - **Auto-Selection Logic**:
    - **For Members**: When a cluster is selected, automatically selects all `ACTIVE` members by default
    - **For Visitors**: When a cluster is selected, automatically selects visitors from the most recent previous report (if available)
  - **Previously Attended Display**:
    - **For Members**: Shows members who attended in previous reports, separated from other members
    - **For Visitors**: Shows visitors who attended in all previous reports of that cluster, separated from other visitors
  - **Button Highlighting**: The active bulk selection button is highlighted to show which selection method is currently active
  - **Edit Mode Highlighting**: When editing a report, the button that matches the current selection is automatically highlighted
  - **List Mode**: Toggle between "Search Mode" and "List Mode" for easier multi-selection
  - **Status Display**: Shows member status (ACTIVE, SEMIACTIVE, etc.) instead of phone numbers in the dropdown
  - **Cluster-Aware Filtering**: Separates cluster members/previously attended visitors from others in the list view

### Data Loading & Updates

- On mount, the page fetches clusters and reports in parallel
- Successful form submissions prepend new records to local state
- Errors surface via error messages
- Loading states are managed per data type
- **Optimistic UI Updates**: When editing cluster names or assigning members, the UI updates immediately without a full page reload
- **Previous Attendance Fetching**: When creating/editing a weekly report, the form fetches all previous reports for the selected cluster to populate "previously attended" lists
- **Week-Based Filtering**: Previous reports are filtered client-side to only include reports from earlier weeks/years than the current report
- **Dashboard Filter Independence**: The weekly report form's logic is independent of dashboard filters, ensuring correct previous attendance data regardless of active filters

## Sample Data

A management command is available to populate the database with realistic cluster data for development and testing:

```bash
cd backend
source venv/bin/activate
python manage.py populate_clusters_data
```

Options:
- `--clusters N` – Number of clusters to create (default: 5)
- `--reports N` – Number of weekly reports per cluster (default: 12)
- `--clear` – Clear existing cluster data before populating

The command creates:
- **Clusters**: 
  - Unique codes in `CLU-001`, `CLU-002` format
  - Names from predefined list (North, South, East, West, Central, etc.)
  - Random coordinators from existing people (prefers COORDINATOR role)
  - 1-3 families per cluster (if families exist)
  - 3-8 individual members per cluster
  - Location, meeting schedule, and description
- **Weekly Reports**: 
  - Reports spread over the past N weeks (default 12)
  - Random attendance (50-100% of members, 0-3 visitors)
  - Various gathering types (PHYSICAL, ONLINE, HYBRID)
  - Random activities, prayer requests, testimonies
  - Offerings between ₱500–₱5,000
  - Highlights and lowlights

**Important Notes:**
- Ensure you have people (and optionally families) in the database first (run `populate_sample_data` if needed) as the command uses them as coordinators, members, and submitters.
- The command automatically assigns coordinators, families, and members from existing data.

## Django Admin

All cluster models are registered in Django admin (`apps.clusters.admin`):

- **ClusterAdmin**: 
  - List display: code, name, coordinator, location, created_at
  - Filterable by created_at
  - Searchable by code, name, location
  - Filter horizontal for families and members
  - Fieldsets: Basic Information, Relations, Metadata

- **ClusterWeeklyReportAdmin**: 
  - List display: cluster, year, week_number, meeting_date, gathering_type, submitted_by, submitted_at
  - Filterable by year, week_number, gathering_type, submitted_at
  - Searchable by cluster name and code
  - Filter horizontal for members_attended and visitors_attended
  - Fieldsets: Report Information, Attendance, Meeting Details, Summary, Submission

## Testing

- `apps.clusters.tests` should include coverage for:
  - Cluster CRUD operations
  - ClusterWeeklyReport CRUD operations
  - Analytics endpoint (with various filters)
  - Overdue endpoint
  - Computed properties (members_present, visitors_present, member_attendance_rate)
  - Cross-app ForeignKey relationships
  - Unique constraint on cluster/year/week_number
  - Pagination for reports
- Run clusters tests with SQLite settings to avoid Postgres permissions:

```bash
cd backend
source venv/bin/activate
python manage.py test apps.clusters --settings=core.settings_test
```

Extend the suite with fixtures covering clusters with various member/family configurations, multi-week reports, and edge cases (empty clusters, 100% attendance, etc.) so the module remains trustworthy.
