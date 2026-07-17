## Data Models (apps.people.models)

### Branch

- Fields: `name`, `code?` (unique, nullable), `address?`, `phone?`, `email?`, `is_headquarters` (default=False), `is_active` (default=True), `created_at`
- Meta: `verbose_name_plural = "Branches"`, ordering by `name`
- Indexes: `is_headquarters`, `is_active`
- Notes: Represents a church branch/location. One branch should be marked as headquarters (`is_headquarters=True`)

### Person (extends AbstractUser)

- Names: `first_name`, `last_name`, `middle_name?`, `suffix?`, `nickname?`, `maiden_name?`
  - On create/update via API (and prospect create paths), name fields are normalized on write: mixed-case input is preserved; all-lowercase / all-uppercase input is title-cased with particles (`de`, `la`, …), Mc/Mac mid-capitals, and Roman numerals (`III`).
- Demographics: `gender?` (MALE|FEMALE), `date_of_birth?`, `country?` (full country name, max 100 chars; person form offers a complete country list)
- Contact: `phone?`, `address?`, `facebook_name?`
- Role: `role` (MEMBER|VISITOR|PASTOR|ADMIN) — coordinator capability is granted via `ModuleCoordinator` assignments, not a base role
- Church-specific: `date_first_attended?`, `member_id?`, `status?` (ACTIVE|SEMIACTIVE|INACTIVE|DORMANT|FALLAWAY|DECEASED|ONGOING|NO_RESPONSE)
- Relations: `inviter` → Person (nullable), `branch` → Branch (nullable), standard `groups` and `user_permissions` with custom related_names
- Media: `photo` (ImageField → `profiles/`)
- Methods: `can_see_all_branches()` - Returns True for ADMIN users or PASTOR users from headquarters branch

Notes

- `__str__` returns `username`
- Custom username generation handled in `PersonSerializer.create`
- **Automatic Status Updates**: The `status` field is automatically updated based on attendance patterns within a rolling 4-week window **when enabled** in Admin Settings → Module Controls → People automations (`PeopleAutomationSetting.auto_status_updates_enabled`):
  - **ACTIVE**: ≥3 attendances for ALL THREE types (Sunday Service AND Clustering AND Doctrinal Class)
  - **SEMIACTIVE**: ≥1 attendance for at least ONE type (but not all three with ≥3 each). If person not in any cluster, maximum status is SEMIACTIVE.
  - **INACTIVE**: 0 attendances for ALL types
  - Status updates occur in real-time when attendance records are created/updated for Sunday Service or Doctrinal Class events, or when cluster attendance changes.
  - When status changes, a Journey entry of type `NOTE` is automatically created with title "Status Update: {OLD_STATUS} → {NEW_STATUS}".
  - Auto-calc never overwrites manual pastoral statuses: **DORMANT**, **FALLAWAY**, or **DECEASED**.
  - When automation is disabled, attendance and the `update_status` endpoint do not change status; manual edits in the person form still work.
- **Manual pastoral statuses** (set via Edit person form status field; not produced by attendance auto-calc):
  - **DORMANT**: Member who remains on the church roll but has been away from regular fellowship and activities for an extended period. Distinct from Inactive (short-term 4-week attendance drop). Return to fellowship is still expected or hoped for.
  - **FALLAWAY** (Fall Away): Member who has left fellowship or abandoned regular participation with no current expectation of return. Distinct from Dormant (membership retained, return still hoped for) and from Inactive (temporary attendance drop).
  - **DECEASED**: Marked deceased. Available for members and visitors. Set only via the Edit person form status dropdown (no profile shortcut button).
- **Visitor statuses** (UI restricts selection by role; distinct from evangelism Prospect `pipeline_stage` INVITED/ATTENDED):
  - **ONGOING**: Default on create and when marking attended / creating Person from a prospect. Also applied when demoting a member to visitor if `date_first_attended` is set.
  - **NO_RESPONSE**: Auto-set only when demoting/switching to visitor with no `date_first_attended`. May also be set manually.
  - **DECEASED**: Manual only (never auto-assigned).
  - Legacy `INVITED` / `ATTENDED` Person statuses were remapped to **ONGOING** (migration `0017_person_maiden_name_and_visitor_status`).

### Family

- Fields: `name`, `leader` → Person (nullable), `members` → ManyToMany(Person), `address?`, `created_at`
- Meta: `verbose_name_plural = "Families"`
- Notes: Branch is derived from members' branches (most common branch among family members). Family model does NOT have a direct branch field.
- Journeys: NOTE journeys are created when a family is created, when members are added, and when the family address is updated.

### Cluster

- Fields: `code` (unique, nullable), `name?`, `coordinator` → Person (nullable), `families` → ManyToMany(Family), `members` → ManyToMany(Person), `branch` → Branch (nullable), `location?`, `meeting_schedule?`, `description?`, `created_at`

### ClusterComplianceNote

- Fields: `cluster` → Cluster, `created_by` → Person (nullable), `note` (TextField), `period_start` (DateField), `period_end` (DateField), `created_at`, `updated_at`
- Meta: Ordering by `-created_at`, indexes on `cluster` and `-created_at`
- Notes: Used to track compliance notes/comments added by senior coordinators about cluster compliance issues

### Journey

- Fields: `user` → Person, `title?`, `date`, `type` (LESSON|BAPTISM|SPIRIT|CLUSTER|NOTE|EVENT_ATTENDANCE|MINISTRY|BRANCH_TRANSFER), `description?`, `verified_by` → Person (nullable), `created_at`
- Notes:
  - `BRANCH_TRANSFER` type is automatically created when a Person's branch changes
  - `CLUSTER` type journeys are automatically created when:
    - People attend cluster meetings (via ClusterWeeklyReport) - title: "Attended Cluster Meeting - {Cluster Code}"
    - People are added to or transferred between clusters - title: "Joined Cluster - {Cluster Code}" or "Transferred to Cluster - {Cluster Code}"
  - `NOTE` type journeys are automatically created when a Person's status changes (ACTIVE/SEMIACTIVE/INACTIVE) - title: "Status Update: {OLD_STATUS} → {NEW_STATUS}". Only created when status changes from one value to another (not for first assignment), and only one journey entry per day (updates existing if multiple changes occur). Manual statuses (DORMANT, FALLAWAY, DECEASED) are not overwritten by attendance auto-updates.

## Data Models (apps.ministries.models)

### Ministry

- Fields: `name`, `description?`, `category?` (worship|outreach|care|logistics|other), `activity_cadence` (weekly|monthly|seasonal|event_driven|holiday|ad_hoc), `primary_coordinator` → Person (nullable), `support_coordinators` → ManyToMany(Person), `branch` → Branch (nullable), `meeting_location?`, `meeting_schedule?` (JSONField), `communication_channel?` (URLField), `is_active` (default=True), `created_at`, `updated_at`
- Meta: `verbose_name_plural = "Ministries"`, ordering by `name`
- Coordinator Sync: `primary_coordinator` and `support_coordinators` are automatically synced to `MinistryMember` entries with roles `PRIMARY_COORDINATOR` and `COORDINATOR` respectively

### MinistryMember

- Fields: `ministry` → Ministry, `member` → Person, `role` (primary_coordinator|coordinator|team_member|guest_helper), `join_date` (default=today), `is_active` (default=True), `availability?` (JSONField), `skills?`, `notes?`
- Meta: `unique_together = ("ministry", "member")` - One person can only have one membership per ministry, ordering by `ministry`, then `member`
- Coordinator Roles: Roles `primary_coordinator` and `coordinator` are automatically synced from `Ministry.primary_coordinator` and `Ministry.support_coordinators` fields. When coordinators are removed, their role is updated to `team_member` if they still have a membership record.
