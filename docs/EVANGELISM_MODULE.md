# Evangelism Module Guide

## Overview

The Evangelism module manages Bible Study/Evangelism groups, tracks visitor progress through a conversion pipeline, implements the "Each 1 Reach 1" program (where each member should convert one person per year), and provides comprehensive reporting on conversions, drop-offs, and follow-up workflows. The module integrates closely with the Clusters module for cluster-based tracking and goal management.

Key features include:

- **Group Management**: Create/manage Bible Study groups with leaders, members, and optional cluster affiliation
- **Session Scheduling**: Schedule one-time or recurring Bible study sessions with automatic event creation
- **Weekly Reports**: Submit weekly reports similar to cluster reports with attendance, activities, and conversions
- **Visitor Pipeline**: Track visitors through stages: INVITED → ATTENDED → BAPTIZED → RECEIVED_HG → CONVERTED
- **Prospect Tracking**: Track people being evangelized with pipeline stage progression, last activity tracking, and cluster association
- **Follow-up Workflow**: Create and assign follow-up tasks, track completion, auto-generate tasks for inactive visitors
- **Drop-off Detection & Tracking**: Automatic detection based on inactivity period, track drop-off stage and reason, recovery tracking
- **Conversion Recording**: Record water baptism and Holy Ghost reception with dates, validate lesson completion
- **Each 1 Reach 1 Goals**: Cluster-based goal tracking with automatic progress updates
- **Monthly Conversion Tracking**: Track unique persons per month at each stage (INVITED, ATTENDED, BAPTIZED, RECEIVED_HG, CONVERTED)
- **Reporting**: Individual and group-level reporting with monthly statistics, conversion analytics, and drop-off analysis

## Data Model & Storage

### EvangelismGroup Model

- `apps.evangelism.models.EvangelismGroup` represents a Bible Study/Evangelism group with:
  - `name` (string, max 200 chars) – group name (e.g., "North Bible Study")
  - `description` (text field, blank) – group description
  - `leader` (ForeignKey to `people.Person`, nullable) – group leader/coordinator
  - `cluster` (ForeignKey to `clusters.Cluster`, nullable) – associated cluster (if any)
  - `location` (string, max 200 chars, blank) – meeting location
  - `meeting_time` (TimeField, nullable) – regular meeting time
  - `meeting_day` (CharField, choices: MONDAY-SUNDAY, blank) – day of week
  - `is_active` (BooleanField, default True) – whether the group is active
  - `is_bible_sharers_group` (BooleanField, default False) – marks this as a "Bible Sharers" group. Bible Sharers are capable of facilitating bible studies and can step in when a cluster doesn't have someone to facilitate. Ideally, each cluster should have at least one Bible Sharer.
  - `created_at`, `updated_at` (DateTimeFields)
- Default ordering: by `name`
- **Event Type Logic**: When sessions are created, event type is:
  - `CLUSTER_BS_EVANGELISM` if `cluster` is not null
  - `BIBLE_STUDY` if `cluster` is null
- **Bible Sharers**: The "Bible Sharers" group is a special group that is monitored closely. These are people who are capable of doing bible studies and can step in when a cluster doesn't have someone to facilitate. The system provides coverage monitoring to track which clusters have Bible Sharers and which don't.

### EvangelismGroupMember Model

- `apps.evangelism.models.EvangelismGroupMember` links a Person to a Group with:
  - `evangelism_group` (ForeignKey to EvangelismGroup, CASCADE delete) – the group
  - `person` (ForeignKey to `people.Person`, CASCADE delete) – the enrolled person
  - `role` (CharField, choices: LEADER, MEMBER, ASSISTANT_LEADER) – person's role in the group
  - `joined_date` (DateField, default timezone.now) – when the person joined
  - `is_active` (BooleanField, default True) – whether the membership is active
  - `notes` (text field, blank) – additional notes
- Unique constraint: `unique_together = ("evangelism_group", "person")` – prevents duplicate memberships
- Default ordering: by `evangelism_group`, `role`, `person__last_name`, `person__first_name`

### EvangelismSession Model

- `apps.evangelism.models.EvangelismSession` represents a group session with:
  - `evangelism_group` (ForeignKey to EvangelismGroup, CASCADE delete) – the group this session is for
  - `event` (OneToOneField to `events.Event`, SET_NULL, nullable) – linked calendar event for attendance tracking
  - `session_date` (DateField) – date of the session
  - `session_time` (TimeField, nullable) – time of the session
  - `topic` (string, max 200 chars, blank) – Bible study topic
  - `notes` (text field, blank) – additional session notes
  - `is_recurring_instance` (BooleanField, default False) – whether this session was created as part of a recurring series
  - `recurring_group_id` (string, max 100 chars, blank) – identifier for grouping recurring sessions
  - `created_at`, `updated_at` (DateTimeFields)
- Default ordering: by `-session_date`, then `-session_time`
- **Event Integration**: When a session is created, it automatically creates a corresponding `Event`:
  - Type: `CLUSTER_BS_EVANGELISM` if `evangelism_group.cluster` exists
  - Type: `BIBLE_STUDY` if `evangelism_group.cluster` is null

### EvangelismWeeklyReport Model

- `apps.evangelism.models.EvangelismWeeklyReport` tracks weekly group meeting reports with:
  - `evangelism_group` (ForeignKey to EvangelismGroup, CASCADE delete) – the group this report is for
  - `year` (IntegerField) – year of the report (e.g., 2025)
  - `week_number` (IntegerField) – ISO week number (1-53)
  - `meeting_date` (DateField) – actual date the meeting was held
  - `members_attended` (ManyToMany to `people.Person`, filtered to role="MEMBER") – members who attended
  - `visitors_attended` (ManyToMany to `people.Person`, filtered to role="VISITOR") – visitors who attended
  - `gathering_type` (CharField, choices: PHYSICAL, ONLINE, HYBRID) – how the meeting was conducted
  - `topic` (string, max 200 chars, blank) – Bible study topic
  - `activities_held` (TextField, blank) – activities/events during the meeting
  - `prayer_requests` (TextField, blank) – prayer requests shared
  - `testimonies` (TextField, blank) – testimonies shared
  - `new_prospects` (IntegerField, default 0) – new prospects this week
  - `conversions_this_week` (IntegerField, default 0) – conversions this week
  - `notes` (TextField, blank) – additional notes
  - `submitted_by` (ForeignKey to `people.Person`, nullable) – person who submitted the report
  - `submitted_at` (DateTimeField, auto_now_add) – when the report was submitted
  - `updated_at` (DateTimeField, auto_now) – when the report was last updated
- Default ordering: by `-year`, then `-week_number`
- Unique constraint: `unique_together = ["evangelism_group", "year", "week_number"]` – prevents duplicate reports

### Prospect Model

- `apps.evangelism.models.Prospect` represents a visitor/prospect being evangelized with:
  - `name` (string, max 200 chars) – prospect's name (can be just a name until they attend)
  - `contact_info` (string, max 200 chars, blank) – phone/email
  - `invited_by` (ForeignKey to `people.Person`) – member who invited them
  - `inviter_cluster` (ForeignKey to `clusters.Cluster`, nullable) – cluster of the inviter (for tracking)
  - `evangelism_group` (ForeignKey to EvangelismGroup, nullable) – associated bible study group
  - `endorsed_cluster` (ForeignKey to `clusters.Cluster`, nullable) – cluster this visitor is endorsed to (if different from inviter's cluster)
  - `person` (ForeignKey to `people.Person`, nullable) – linked Person record (created when they first attend, or linked if already exists as VISITOR)
  - `pipeline_stage` (CharField, choices: INVITED, ATTENDED, BAPTIZED, RECEIVED_HG, CONVERTED) – current stage in pipeline
  - `first_contact_date` (DateField, nullable) – first contact date
  - `last_activity_date` (DateField, nullable) – last date of any activity (attendance, contact, etc.)
  - `is_attending_cluster` (BooleanField, default False) – whether visitor is attending a cluster
  - `is_dropped_off` (BooleanField, default False) – whether visitor has dropped off
  - `drop_off_date` (DateField, nullable) – when they dropped off
  - `drop_off_stage` (CharField, choices: same as pipeline_stage, nullable) – stage where they dropped off
  - `drop_off_reason` (TextField, blank) – reason for drop-off if known
  - `has_finished_lessons` (BooleanField, default False) – whether they completed required lessons
  - `commitment_form_signed` (BooleanField, default False) – whether commitment form was signed
  - `fast_track_reason` (CharField, choices: NONE, GOING_ABROAD, HEALTH_ISSUES, OTHER, default NONE) – reason for fast-tracking (bypassing lessons)
  - `notes` (TextField, blank) – additional notes
  - `created_at`, `updated_at` (DateTimeFields)
- Default ordering: by `-last_activity_date`, then `name`
- **Person Creation Logic**:
  - Prospect can be just a name until they attend
  - When prospect first attends: auto-create Person record (or link if Person with VISITOR role exists)
  - Set `Person.inviter = prospect.invited_by` when Person is created
  - Auto-update `last_activity_date` on attendance or status change
  - Auto-set `inviter_cluster` based on inviter's cluster membership

### FollowUpTask Model

- `apps.evangelism.models.FollowUpTask` represents a follow-up task for a prospect with:
  - `prospect` (ForeignKey to Prospect, CASCADE delete) – visitor to follow up with
  - `assigned_to` (ForeignKey to `people.Person`) – person responsible for follow-up
  - `task_type` (CharField, choices: PHONE_CALL, TEXT_MESSAGE, VISIT, EMAIL, PRAYER, OTHER) – type of follow-up
  - `due_date` (DateField) – when follow-up should be completed
  - `completed_date` (DateField, nullable) – when follow-up was completed
  - `status` (CharField, choices: PENDING, IN_PROGRESS, COMPLETED, CANCELLED) – task status
  - `notes` (TextField, blank) – additional notes
  - `priority` (CharField, choices: LOW, MEDIUM, HIGH, URGENT, default MEDIUM) – task priority
  - `created_by` (ForeignKey to `people.Person`, nullable) – person who created the task
  - `created_at`, `updated_at` (DateTimeFields)
- Default ordering: by `due_date`, then `priority`
- Auto-create tasks when visitor becomes inactive (configurable threshold)

### DropOff Model

- `apps.evangelism.models.DropOff` represents a dropped off visitor with:
  - `prospect` (OneToOneField to Prospect) – the visitor who dropped off
  - `drop_off_date` (DateField) – when they dropped off
  - `drop_off_stage` (CharField, choices: INVITED, ATTENDED, BAPTIZED, RECEIVED_HG) – stage where they dropped off
  - `days_inactive` (IntegerField) – days inactive before drop-off
  - `reason` (CharField, choices: NO_CONTACT, NO_SHOW, LOST_INTEREST, MOVED, OTHER, blank=True) – reason for drop-off
  - `reason_details` (TextField, blank) – additional details
  - `recovery_attempted` (BooleanField, default False) – whether recovery was attempted
  - `recovery_date` (DateField, nullable) – date of recovery attempt
  - `recovered` (BooleanField, default False) – whether visitor was recovered
  - `recovered_date` (DateField, nullable) – when they were recovered
  - `created_at`, `updated_at` (DateTimeFields)
- Default ordering: by `-drop_off_date`
- **Drop-off Detection**: Automatic detection based on inactivity period (default 30 days, configurable - note in docs for future admin configuration)

### Conversion Model

- `apps.evangelism.models.Conversion` represents a conversion (baptism and/or Holy Ghost reception) with:
  - `person` (ForeignKey to `people.Person`) – the converted person
  - `prospect` (ForeignKey to Prospect, nullable) – linked prospect (if applicable)
  - `converted_by` (ForeignKey to `people.Person`) – member who led the conversion
  - `evangelism_group` (ForeignKey to EvangelismGroup, nullable) – associated group
  - `cluster` (ForeignKey to `clusters.Cluster`, nullable) – cluster for tracking (from inviter or endorsed cluster)
  - `conversion_date` (DateField) – date of conversion journey
  - `water_baptism_date` (DateField, nullable) – date of water baptism
  - `spirit_baptism_date` (DateField, nullable) – date of Holy Ghost reception
  - `is_complete` (BooleanField) – True if both baptisms completed
  - `notes` (TextField, blank) – additional notes
  - `verified_by` (ForeignKey to `people.Person`, nullable) – who verified the conversion
  - `created_at`, `updated_at` (DateTimeFields)
- Default ordering: by `-conversion_date`
- **Validation**: Check if lessons are completed before baptism (unless fast-tracked)
- **Validation**: Check if commitment form is signed (unless fast-tracked)
- **Auto-updates**:
  - Update Person's `water_baptism_date` and `spirit_baptism_date` when conversion is created/updated
  - Update prospect `pipeline_stage` (BAPTIZED, RECEIVED_HG, CONVERTED)
  - Update monthly tracking when conversion journeys are recorded
  - Update Each1Reach1Goal when conversion is completed (cluster-based)

### MonthlyConversionTracking Model

- `apps.evangelism.models.MonthlyConversionTracking` tracks monthly conversion statistics per person per stage:
  - `cluster` (ForeignKey to `clusters.Cluster`) – cluster this tracking belongs to
  - `prospect` (ForeignKey to Prospect) – the visitor being tracked
  - `person` (ForeignKey to `people.Person`, nullable) – linked Person (if prospect has been converted to Person)
  - `year` (IntegerField) – year (e.g., 2025)
  - `month` (IntegerField) – month (1-12)
  - `stage` (CharField, choices: INVITED, ATTENDED, BAPTIZED, RECEIVED_HG) – stage reached in this month
  - `count` (IntegerField, default 1) – always 1 (for aggregation purposes)
  - `first_date_in_stage` (DateField) – first date this person reached this stage in this month
  - `created_at`, `updated_at` (DateTimeFields)
- Unique constraint: `(cluster, prospect, year, month, stage)` – allows multiple stages per person per month (e.g., BAPTIZED and RECEIVED_HG in same month)
- Index on `(cluster, year, month, stage)` for efficient queries
- **Monthly Counting Logic**:
  - **INVITED**: Count unique persons invited that month (only if they haven't attended yet)
  - **ATTENDED**: Count unique persons who attended that month (replaces INVITED count if in same month)
  - **BAPTIZED**: Count baptism events that month (journey count, can be separate from RECEIVED_HG)
  - **RECEIVED_HG**: Count Holy Ghost reception events that month (journey count, can be separate from BAPTIZED)
  - **CONVERTED**: Count unique persons who completed both BAPTIZED and RECEIVED_HG by end of month (within same year). Counted in the month they first complete both. Only counted once per person per year.

### Each1Reach1Goal Model

- `apps.evangelism.models.Each1Reach1Goal` tracks cluster-based conversion goals with:
  - `cluster` (ForeignKey to `clusters.Cluster`) – cluster with the goal (cluster-level tracking)
  - `year` (IntegerField) – year for the goal
  - `target_conversions` (IntegerField) – target conversions for the cluster (sum of member targets)
  - `achieved_conversions` (IntegerField, default 0) – actual conversions this year for cluster members
  - `status` (CharField, choices: IN_PROGRESS, COMPLETED, NOT_STARTED) – goal status
  - `created_at`, `updated_at` (DateTimeFields)
- Unique constraint: `(cluster, year)` – one goal per cluster per year
- Default ordering: by `-year`, then `cluster__name`
- Auto-update `achieved_conversions` when conversions are completed by cluster members

### Cross-App References

All ForeignKey relationships use string references to avoid circular imports:

- `leader = models.ForeignKey('people.Person', ...)`
- `cluster = models.ForeignKey('clusters.Cluster', ...)`
- `person = models.ForeignKey(settings.AUTH_USER_MODEL, ...)`
- `event = models.OneToOneField("events.Event", ...)`

### Migrations

- `apps.evangelism.migrations.0001_initial` – Creates all Evangelism tables with relationships

## API Surface

All routes live under `/api/evangelism/` (namespaced in `core.urls`):

### Groups

- `/api/evangelism/groups/` – EvangelismGroupViewSet CRUD
  - `GET` – List all groups
    - Query params: `?cluster={cluster_id}` – filter by cluster
    - Query params: `?is_active=true` – filter by active status
    - Query params: `?search={term}` – search by name or description
  - `POST` – Create a new group (requires `name`, optional `leader_id`, `cluster_id`, `location`, `meeting_time`, `meeting_day`)
  - `GET /{id}/` – Retrieve a specific group with nested members and cluster
  - `PUT /{id}/` – Update a group (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a group (cascades to members, sessions, prospects)
  - `POST /{id}/enroll/` – Bulk enroll members
    - Payload: `{ "person_ids": [1, 2, 3], "role": "MEMBER" }`
  - `GET /{id}/sessions/` – List sessions for a group
    - Query params: `?start_date={date}`, `?end_date={date}` – filter by date range
  - `GET /{id}/conversions/` – List conversions for a group
  - `GET /{id}/visitors/` – List visitors associated with this group's cluster
  - `GET /{id}/summary/` – Group statistics
  - `GET /bible_sharers_coverage/` – Get Bible Sharers coverage across clusters
    - Returns which clusters have Bible Sharers and which don't
    - Response includes:
      - `coverage`: Array of cluster coverage items with Bible Sharers groups and counts
      - `summary`: Overall statistics (total clusters, clusters with/without Bible Sharers, etc.)

### Members

- `/api/evangelism/members/` – EvangelismGroupMemberViewSet CRUD
  - `GET` – List all group members
    - Query params: `?group={group_id}` – filter by group
    - Query params: `?person={person_id}` – filter by person
    - Query params: `?role={role}` – filter by role
    - Query params: `?is_active=true` – filter by active status
  - `POST` – Create a new membership (requires `evangelism_group_id`, `person_id`, `role`)
  - `GET /{id}/` – Retrieve a specific membership
  - `PUT /{id}/` – Update a membership (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a membership

### Sessions

- `/api/evangelism/sessions/` – EvangelismSessionViewSet CRUD
  - `GET` – List all sessions
    - Query params: `?group={group_id}` – filter by group
    - Query params: `?start_date={date}`, `?end_date={date}` – filter by date range
  - `POST` – Create a new session (requires `evangelism_group_id`, `session_date`, optional `session_time`, `topic`, `notes`)
    - **Automatic Event Creation**: When a session is created, it automatically creates a corresponding `Event`:
      - Type: `CLUSTER_BS_EVANGELISM` if `evangelism_group.cluster` exists
      - Type: `BIBLE_STUDY` if `evangelism_group.cluster` is null
  - `GET /{id}/` – Retrieve a specific session with nested group and event information
  - `PUT /{id}/` – Update a session (full update)
    - **Event Synchronization**: When a session is updated, the linked event is also updated if it exists
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a session (sets event to NULL, doesn't delete the event)
  - `GET /{id}/attendance_report/` – Attendance report for a session
  - `POST /create_recurring/` – Create recurring sessions
    - Payload: `{ "evangelism_group_id": 1, "start_date": "2024-01-07", "end_date": "2024-11-03", "session_time": "09:00:00", "topic": "Weekly Study" }`

### Weekly Reports

- `/api/evangelism/weekly-reports/` – EvangelismWeeklyReportViewSet CRUD
  - `GET` – List reports with filtering:
    - Query params: `?group={group_id}` – filter by group
    - Query params: `?year={year}` – filter by year
    - Query params: `?week_number={week}` – filter by week number
    - Query params: `?gathering_type={type}` – filter by gathering type
  - `POST` – Create a new report (requires `evangelism_group`, `year`, `week_number`, `meeting_date`, `gathering_type`)
  - `GET /{id}/` – Retrieve a specific report
  - `PUT /{id}/` – Update a report (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a report

### Prospects

- `/api/evangelism/prospects/` – ProspectViewSet CRUD
  - `GET` – List all prospects
    - Query params: `?invited_by={person_id}` – filter by inviter
    - Query params: `?inviter_cluster={cluster_id}` – filter by inviter's cluster
    - Query params: `?group={group_id}` – filter by group
    - Query params: `?pipeline_stage={stage}` – filter by pipeline stage
    - Query params: `?endorsed_cluster={cluster_id}` – filter by endorsed cluster
    - Query params: `?is_dropped_off=true` – filter by drop-off status
  - `POST` – Create a new prospect (requires `name`, `invited_by_id`, optional `contact_info`, `evangelism_group_id`)
    - Auto-set `inviter_cluster` based on inviter's cluster membership
  - `GET /{id}/` – Retrieve a specific prospect
  - `PUT /{id}/` – Update a prospect (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a prospect
  - `POST /{id}/endorse_to_cluster/` – Endorse visitor to a different cluster
    - Payload: `{ "cluster_id": 1 }`
  - `POST /{id}/update_progress/` – Update visitor's pipeline stage and last activity
    - Payload: `{ "pipeline_stage": "ATTENDED", "last_activity_date": "2024-03-15" }`
  - `POST /{id}/mark_attended/` – Mark prospect as attended (auto-creates/links Person, updates monthly tracking)
  - `POST /{id}/create_person/` – Manual action to create Person record from prospect
    - Payload: `{ "first_name": "John", "last_name": "Doe", ... }` (similar to cluster report attendance form)
  - `POST /{id}/mark_dropped_off/` – Manually mark visitor as dropped off
  - `POST /{id}/recover/` – Recover a dropped off visitor

### Follow-up Tasks

- `/api/evangelism/follow-up-tasks/` – FollowUpTaskViewSet CRUD
  - `GET` – List all tasks
    - Query params: `?prospect={prospect_id}` – filter by prospect
    - Query params: `?assigned_to={person_id}` – filter by assignee
    - Query params: `?status={status}` – filter by status
    - Query params: `?due_date={date}` – filter by due date
    - Query params: `?priority={priority}` – filter by priority
  - `POST` – Create a new task (requires `prospect_id`, `assigned_to_id`, `task_type`, `due_date`)
  - `GET /{id}/` – Retrieve a specific task
  - `PUT /{id}/` – Update a task (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a task
  - `POST /{id}/complete/` – Mark task as completed
  - `GET /overdue/` – List overdue tasks

### Drop-offs

- `/api/evangelism/drop-offs/` – DropOffViewSet CRUD
  - `GET` – List all drop-offs
    - Query params: `?drop_off_stage={stage}` – filter by drop-off stage
    - Query params: `?reason={reason}` – filter by reason
    - Query params: `?recovered={true/false}` – filter by recovery status
    - Query params: `?start_date={date}`, `?end_date={date}` – filter by date range
  - `GET /{id}/` – Retrieve a specific drop-off
  - `POST /{id}/recover/` – Attempt to recover a dropped off visitor
  - `GET /analytics/` – Drop-off analytics by stage, reason, time period

### Conversions

- `/api/evangelism/conversions/` – ConversionViewSet CRUD
  - `GET` – List all conversions
    - Query params: `?converted_by={person_id}` – filter by converter
    - Query params: `?cluster={cluster_id}` – filter by cluster
    - Query params: `?group={group_id}` – filter by group
    - Query params: `?year={year}` – filter by year
  - `POST` – Create a new conversion (requires `person_id`, `converted_by_id`, `conversion_date`, optional `water_baptism_date`, `spirit_baptism_date`)
    - **Validation**: Check if lessons are completed before baptism (unless fast-tracked)
    - **Validation**: Check if commitment form is signed (unless fast-tracked)
    - Auto-update Person's baptism dates
    - Auto-update prospect pipeline_stage
    - Auto-update monthly tracking
    - Auto-update Each1Reach1Goal
  - `GET /{id}/` – Retrieve a specific conversion
  - `PUT /{id}/` – Update a conversion (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a conversion

### Monthly Conversion Tracking

- `/api/evangelism/monthly-tracking/` – MonthlyConversionTrackingViewSet CRUD
  - `GET` – List all monthly tracking records
    - Query params: `?cluster={cluster_id}` – filter by cluster
    - Query params: `?year={year}` – filter by year
    - Query params: `?month={month}` – filter by month
    - Query params: `?stage={stage}` – filter by stage
  - `GET /statistics/` – Monthly statistics by stage
    - Query params: `?cluster={cluster_id}`, `?year={year}`, `?month={month}`
    - Returns: `invited_count`, `attended_count`, `baptized_count`, `received_hg_count`, `converted_count`

### Each 1 Reach 1 Goals

- `/api/evangelism/each1reach1-goals/` – Each1Reach1GoalViewSet CRUD
  - `GET` – List all goals
    - Query params: `?cluster={cluster_id}` – filter by cluster
    - Query params: `?year={year}` – filter by year
    - Query params: `?status={status}` – filter by status
  - `POST` – Create a new goal (requires `cluster_id`, `year`, `target_conversions`)
  - `GET /{id}/` – Retrieve a specific goal
  - `PUT /{id}/` – Update a goal (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a goal
  - `GET /{id}/progress/` – Cluster progress report
  - `GET /leaderboard/` – Top converting clusters
    - Query params: `?year={year}` – filter by year
  - `GET /{id}/member_progress/` – Individual member progress within cluster
  - `GET /summary/` – Yearly summary statistics
    - Query params: `?year={year}` – filter by year

### Serializers

Serializers (`apps.evangelism.serializers`) expose:

- `EvangelismGroupSerializer`:

  - `leader` – nested person object (read-only)
  - `leader_id` – write-only field for setting leader
  - `cluster` – nested cluster object (read-only)
  - `cluster_id` – write-only field for setting cluster
  - `members_count` – computed count of active members
  - `conversions_count` – computed count of conversions
  - All group fields

- `EvangelismGroupMemberSerializer`:

  - `person` – nested person object with full name formatting (read-only)
  - `person_id` – write-only field for setting person
  - `role_display` – human-readable role name (read-only)
  - All member fields

- `EvangelismSessionSerializer`:

  - `evangelism_group` – nested group object (read-only)
  - `evangelism_group_id` – write-only field for setting group
  - `event_id` – read-only event ID if event exists
  - All session fields

- `EvangelismWeeklyReportSerializer`:

  - `evangelism_group` – nested group object (read-only)
  - `members_attended_details` – read-only full person details for members
  - `visitors_attended_details` – read-only full person details for visitors
  - `submitted_by_details` – read-only full person details for submitter
  - All report fields

- `ProspectSerializer`:

  - `invited_by` – nested person object (read-only)
  - `invited_by_id` – write-only field for setting inviter
  - `inviter_cluster` – nested cluster object (read-only)
  - `evangelism_group` – nested group object (read-only)
  - `endorsed_cluster` – nested cluster object (read-only)
  - `person` – nested person object (read-only, if linked)
  - `pipeline_stage_display` – human-readable stage name (read-only)
  - `days_since_last_activity` – computed property (read-only)
  - All prospect fields

- `FollowUpTaskSerializer`:

  - `prospect` – nested prospect object (read-only)
  - `assigned_to` – nested person object (read-only)
  - `created_by` – nested person object (read-only)
  - `task_type_display` – human-readable task type (read-only)
  - `status_display` – human-readable status (read-only)
  - `priority_display` – human-readable priority (read-only)
  - All task fields

- `DropOffSerializer`:

  - `prospect` – nested prospect object (read-only)
  - `drop_off_stage_display` – human-readable stage (read-only)
  - `reason_display` – human-readable reason (read-only)
  - All drop-off fields

- `ConversionSerializer`:

  - `person` – nested person object (read-only)
  - `prospect` – nested prospect object (read-only)
  - `converted_by` – nested person object (read-only)
  - `evangelism_group` – nested group object (read-only)
  - `cluster` – nested cluster object (read-only)
  - `verified_by` – nested person object (read-only)
  - All conversion fields

- `MonthlyConversionTrackingSerializer`:

  - `cluster` – nested cluster object (read-only)
  - `prospect` – nested prospect object (read-only)
  - `person` – nested person object (read-only, if linked)
  - `stage_display` – human-readable stage (read-only)
  - All tracking fields

- `MonthlyStatisticsSerializer`:

  - `year` – year
  - `month` – month
  - `cluster_id` – cluster ID
  - `cluster_name` – cluster name
  - `invited_count` – unique persons invited that month
  - `attended_count` – unique persons who attended that month
  - `baptized_count` – baptism events that month
  - `received_hg_count` – Holy Ghost reception events that month
  - `converted_count` – unique persons who completed both (counted once in month they first complete both, within same year)

- `Each1Reach1GoalSerializer`:
  - `cluster` – nested cluster object (read-only)
  - `cluster_id` – write-only field for setting cluster
  - `progress_percentage` – computed progress percentage (read-only)
  - All goal fields

## Frontend Behavior

The Evangelism hub lives at `frontend/src/app/evangelism/page.tsx` and provides comprehensive management of groups, prospects, conversions, and reporting.

### Main Page Features

The main page includes tabs for different views:

- **Groups Tab**: Manage evangelism groups
- **Each 1 Reach 1 Tab**: Track conversion goals and progress
- **Reports Tab**: View monthly statistics and conversion reports
- **Bible Sharers Tab**: Monitor Bible Sharers coverage across clusters

- **Group Listing**: Table view of all groups with:
  - Group name, leader, cluster affiliation
  - Member counts
  - Active status
  - Bible Sharers indicator (if marked as Bible Sharers group)
  - Actions (View, Edit, Delete)
- **Search & Filters**:
  - Debounced search by group name or description
  - Filter by cluster
  - Filter by active status
  - Filter by Bible Sharers groups (`is_bible_sharers_group`)
- **Summary Dashboard**: Cards showing:
  - Total groups
  - Total prospects
  - Total conversions
  - Monthly statistics
- **Each 1 Reach 1 Dashboard**: Cluster-based goal tracking with progress indicators

### Components Overview

#### Group Management

- **`EvangelismGroupForm`**: Form for creating/editing groups
  - Leader selection
  - Cluster selection (optional)
  - Location, meeting time, meeting day inputs
  - "Bible Sharers Group" checkbox to mark groups as Bible Sharers groups
- **`GroupMembersSection`**: Section displaying and managing group members
  - Table of enrolled members with role, join date, status
  - Add member button
  - Bulk enroll button
  - Remove member functionality
- **`GroupSessionsSection`**: Section displaying and managing sessions
  - Table of sessions with date, time, topic, event link
  - Add Session button
  - Create Recurring button
  - View, Edit, Attendance actions per session
- **`GroupProspectsSection`**: Section displaying and managing prospects
  - Table of prospects with pipeline stage, last activity, cluster
  - Add prospect button
  - Update progress button
  - Endorse to cluster button
- **`GroupConversionsSection`**: Section displaying conversions
  - Table of conversions with dates, converter, verification status

#### Sessions

- **`SessionForm`**: Form for creating/editing sessions
  - Date picker
  - Time input with 30-minute interval dropdown
  - Topic input
  - Notes textarea
- **`RecurringSessionForm`**: Form for creating recurring sessions
  - Start date picker
  - End date picker
  - Time input
  - Topic input
- **`SessionView`**: Read-only view of session details
  - Session information (date, time, topic, notes)
  - Group name
  - Event link (if available)
  - Quick attendance summary

#### Prospects

- **`ProspectForm`**: Form for creating/editing prospects (name only until they attend)
  - Name input
  - Contact info input
  - Inviter selection
  - Group selection (optional)
- **`ProspectList`**: List prospects with pipeline stage and progress
  - Table with columns: Name, Stage, Last Activity, Cluster, Actions
  - Filter by stage, cluster, drop-off status
- **`ProspectPipelineView`**: Visual pipeline view showing prospects at each stage
  - Kanban-style board with columns for each stage
  - Drag-and-drop to move prospects between stages
- **`ProspectDetail`**: Detailed view with progress history, follow-ups, and activities
  - Prospect information
  - Pipeline stage history
  - Follow-up tasks
  - Conversion journeys
  - Drop-off information (if applicable)
- **`UpdateProgressModal`**: Modal to update visitor's pipeline stage
  - Stage selection
  - Last activity date picker
  - Notes input
- **`CreatePersonFromProspectModal`**: Modal to create Person record from prospect
  - Similar to cluster report attendance form
  - Name fields, contact info, demographics
  - Auto-fills from prospect data
- **`MarkAttendedButton`**: Quick action to mark prospect as attended (auto-creates Person)

#### Follow-up & Drop-offs

- **`FollowUpTaskList`**: List of follow-up tasks with filters
  - Table with columns: Prospect, Assigned To, Type, Due Date, Status, Priority
  - Filter by status, assignee, priority, overdue
- **`FollowUpTaskForm`**: Form for creating/editing follow-up tasks
  - Prospect selection
  - Assignee selection
  - Task type selection
  - Due date picker
  - Priority selection
  - Notes textarea
- **`FollowUpTaskCard`**: Individual task card with status
  - Task details
  - Status badge
  - Priority indicator
  - Complete button
- **`DropOffList`**: List of dropped off visitors
  - Table with columns: Name, Drop-off Stage, Date, Reason, Recovery Status
  - Filter by stage, reason, recovery status
- **`DropOffAnalytics`**: Analytics on drop-off patterns
  - Charts showing drop-offs by stage, reason, time period
  - Recovery rate statistics
- **`RecoveryModal`**: Modal to attempt recovery of dropped off visitor
  - Recovery attempt date
  - Notes input
  - Create follow-up task option

#### Each 1 Reach 1

- **`Each1Reach1Dashboard`**: Main dashboard
  - Cluster cards with progress indicators
  - Overall statistics
  - Year selector
- **`MemberProgressCard`**: Individual progress card
  - Member name
  - Conversions this year
  - Progress toward goal
- **`Leaderboard`**: Top converting clusters
  - Table with columns: Cluster, Conversions, Progress, Status
  - Sortable columns
- **`YearlySummary`**: Year statistics
  - Total conversions by cluster
  - Monthly breakdown
  - Charts and graphs

#### Reports

- **`EvangelismSummary`**: Summary statistics
  - Cards for total groups, prospects, conversions
  - Monthly statistics
  - Conversion rates
- **`GroupReport`**: Group-level report
  - Group statistics
  - Member list
  - Session history
  - Conversion history
- **`ConversionReport`**: Conversion analytics
  - Conversions by month, cluster, group
  - Conversion rate trends
  - Charts and graphs
- **`Each1Reach1Report`**: Goal progress report
  - Cluster goals and achievements
  - Member progress
  - Yearly summary
- **`VisitorProgressReport`**: Visitor progress through pipeline
  - Pipeline stage distribution
  - Stage transition rates
  - Time in each stage
- **`DropOffReport`**: Drop-off analysis report
  - Drop-offs by stage, reason, time period
  - Recovery statistics
  - Recommendations
- **`MonthlyStatisticsReport`**: Monthly statistics by stage
  - Table with columns: Month, INVITED, ATTENDED, BAPTIZED, RECEIVED_HG, CONVERTED
  - Filter by cluster, year
  - Export to Excel/CSV
- **`BibleSharersCoverage`**: Bible Sharers coverage monitoring
  - Summary cards showing total clusters, clusters with/without Bible Sharers, coverage percentage
  - Alert for clusters without Bible Sharers
  - Detailed table showing each cluster's Bible Sharers status, groups, and member counts
  - Helps identify which clusters need Bible Sharers assigned

### Group Detail Modal

When viewing a group, a modal displays:

- **Group Information**: Leader, cluster, location, meeting time, meeting day
- **Members Section**: List of enrolled members with management options
- **Sessions Section**: List of sessions with scheduling options
- **Prospects Section**: List of prospects associated with the group
- **Conversions Section**: List of conversions from the group
- **Footer Actions**:
  - Delete button (left, red icon)
  - Close button (right)
  - Edit button (right, blue)

### Data Loading & Updates

- On mount, the page fetches groups, prospects, conversions, summary, and monthly statistics in parallel
- Successful form submissions refresh relevant data
- Errors surface via error messages
- Loading states are managed per data type
- Debounced search prevents excessive API calls
- Optimistic UI updates where appropriate

## Integration with Other Modules

### Events Module

- Sessions auto-create Events:
  - Type: `CLUSTER_BS_EVANGELISM` if `evangelism_group.cluster` exists
  - Type: `BIBLE_STUDY` if `evangelism_group.cluster` is null
- Event synchronization when sessions are updated
- Attendance tracking through Events module

### Attendance Module

- Use existing AttendanceRecord for session attendance
- Auto-update prospect's `last_activity_date` when they attend a session
- Link prospects to attendance records when Person is created

### People Module

- Auto-update `water_baptism_date` and `spirit_baptism_date` when conversion is recorded
- Link `inviter` field to `converted_by` in conversions
- Track visitor role and status changes
- Auto-create Person when prospect first attends (or link if Person with VISITOR role exists)
- Set `Person.inviter = prospect.invited_by` when Person is created

### Clusters Module

- Track visitors per cluster (inviter's cluster or endorsed cluster)
- Cluster-based Each 1 Reach 1 goals
- Weekly reports similar to ClusterWeeklyReport
- Cluster statistics and analytics

### Lessons Module

- Track lesson completion for prospects
- Validate lesson completion before baptism (unless fast-tracked)
- Track commitment form signing
- Fast-track reasons: GOING_ABROAD, HEALTH_ISSUES, OTHER

### Journeys Module

- Optionally create journeys for conversions
- Create journeys for pipeline stage progress
- Link journeys to conversion records

## Django Admin

All Evangelism models are registered in Django admin (`apps.evangelism.admin`):

- **EvangelismGroupAdmin**:

  - List display: name, leader, cluster, location, meeting_time, is_active
  - Filterable by cluster, is_active
  - Searchable by name, description, leader name

- **EvangelismGroupMemberAdmin**:

  - List display: evangelism_group, person, role, joined_date, is_active
  - Filterable by role, is_active, group
  - Searchable by group name, person name

- **EvangelismSessionAdmin**:

  - List display: evangelism_group, session_date, session_time, topic, event
  - Filterable by group, session_date
  - Searchable by group name, topic

- **EvangelismWeeklyReportAdmin**:

  - List display: evangelism_group, year, week_number, meeting_date, gathering_type
  - Filterable by group, year, week_number, gathering_type
  - Searchable by group name

- **ProspectAdmin**:

  - List display: name, invited_by, pipeline_stage, last_activity_date, is_dropped_off
  - Filterable by pipeline_stage, inviter_cluster, group, is_dropped_off
  - Searchable by name, contact_info

- **FollowUpTaskAdmin**:

  - List display: prospect, assigned_to, task_type, due_date, status, priority
  - Filterable by status, priority, assigned_to
  - Searchable by prospect name, assignee name

- **DropOffAdmin**:

  - List display: prospect, drop_off_date, drop_off_stage, reason, recovered
  - Filterable by drop_off_stage, reason, recovered
  - Searchable by prospect name

- **ConversionAdmin**:

  - List display: person, converted_by, conversion_date, water_baptism_date, spirit_baptism_date, is_complete
  - Filterable by cluster, group, year, is_complete
  - Searchable by person name, converter name

- **MonthlyConversionTrackingAdmin**:

  - List display: cluster, prospect, year, month, stage, first_date_in_stage
  - Filterable by cluster, year, month, stage
  - Searchable by prospect name

- **Each1Reach1GoalAdmin**:
  - List display: cluster, year, target_conversions, achieved_conversions, status
  - Filterable by cluster, year, status
  - Searchable by cluster name

## Testing

- `apps.evangelism.tests` should include coverage for:
  - Group CRUD operations with cluster affiliation
  - Member enrollment
  - Session creation and event linking (correct type based on cluster affiliation)
  - Prospect pipeline stage transitions
  - Visitor progress tracking and last_activity_date updates
  - Person creation from prospect
  - Follow-up task creation and completion
  - Drop-off detection logic (inactivity period)
  - Drop-off recovery process
  - Conversion recording and Person model sync
  - Monthly tracking with proper unique person counting
  - CONVERTED count logic (both journeys within same year)
  - Each1Reach1Goal auto-updates (cluster-based)
  - Cluster visitor tracking (inviter cluster vs endorsed cluster)
  - Weekly report submission
  - Reporting calculations
  - Recurring session creation
  - Lesson completion validation
  - Fast-track logic

Run tests with SQLite settings to avoid Postgres permissions:

```bash
cd backend
source venv/bin/activate
python manage.py test apps.evangelism --settings=core.settings_test
```

## Future Enhancements

### 1. Drop-off Threshold Configuration

**Status**: Planned

- Make drop-off inactivity threshold configurable by admins (currently 30 days default)
- Per-cluster or per-group configuration options
- Admin interface for threshold management

### 2. Notification System

- Notify on overdue follow-up tasks
- Notify on new drop-offs
- Notify on conversion journeys
- Email/SMS integration for follow-up reminders

### 3. Advanced Analytics

- Predictive analytics for drop-off risk
- Conversion funnel analysis
- Time-to-conversion metrics
- Recovery success rate tracking

### 4. Bulk Operations

- Bulk invite prospects
- Bulk update pipeline stages
- Bulk endorse to cluster
- Bulk create follow-up tasks

### 5. Export/Reporting Enhancements

- Export monthly statistics to Excel/CSV
- Export drop-off reports
- Print-friendly reports
- Scheduled report generation

### 6. Mobile App Integration

- Mobile app for follow-up task management
- Quick prospect updates on-the-go
- Photo uploads for prospects
- Location-based features

### 7. Integration Enhancements

- Deep integration with Lessons module
- Finance module integration (track evangelism expenses)
- Enhanced calendar integration
- Social media integration for outreach

## Notes

- **Drop-off Threshold**: Currently set to 30 days default. This will be configurable by admins in the future (see Future Enhancements).
- **Lessons Integration**: Visitors must complete lessons before baptism unless fast-tracked for GOING_ABROAD, HEALTH_ISSUES, or OTHER reasons.
- **Monthly Counting**: CONVERTED counts unique persons who completed both BAPTIZED and RECEIVED_HG within the same year. Counted in the month they first complete both, only once per person per year.
- **Person Creation**: Prospects can be just names until they attend. When they first attend, a Person record is auto-created (or linked if Person with VISITOR role already exists).
