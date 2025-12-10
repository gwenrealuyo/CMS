## Data Models (apps.people.models)

### Person (extends AbstractUser)

- Names: `first_name`, `last_name`, `middle_name?`, `suffix?`
- Demographics: `gender?` (MALE|FEMALE), `date_of_birth?`, `country?`
- Contact: `phone?`, `address?`, `facebook_name?`
- Role: `role` (MEMBER|VISITOR|COORDINATOR|PASTOR|ADMIN)
- Church-specific: `date_first_attended?`, `member_id?`, `status?` (ACTIVE|SEMIACTIVE|INACTIVE|DECEASED)
- Relations: `inviter` → Person (nullable), standard `groups` and `user_permissions` with custom related_names
- Media: `photo` (ImageField → `profiles/`)

Notes

- `__str__` returns `username`
- Custom username generation handled in `PersonSerializer.create`

### Family

- Fields: `name`, `leader` → Person (nullable), `members` → ManyToMany(Person), `address?`, `created_at`
- Meta: `verbose_name_plural = "Families"`

### Cluster

- Fields: `code` (unique, nullable), `name?`, `coordinator` → Person (nullable), `families` → ManyToMany(Family), `description?`, `created_at`

### Journey

- Fields: `user` → Person, `title?`, `date`, `type` (LESSON|BAPTISM|SPIRIT|CLUSTER|NOTE), `description?`, `verified_by` → Person (nullable), `created_at`

## Data Models (apps.ministries.models)

### Ministry

- Fields: `name`, `description?`, `category?` (worship|outreach|care|logistics|other), `activity_cadence` (weekly|monthly|seasonal|event_driven|holiday|ad_hoc), `primary_coordinator` → Person (nullable), `support_coordinators` → ManyToMany(Person), `meeting_location?`, `meeting_schedule?` (JSONField), `communication_channel?` (URLField), `is_active` (default=True), `created_at`, `updated_at`
- Meta: `verbose_name_plural = "Ministries"`, ordering by `name`
- Coordinator Sync: `primary_coordinator` and `support_coordinators` are automatically synced to `MinistryMember` entries with roles `PRIMARY_COORDINATOR` and `COORDINATOR` respectively

### MinistryMember

- Fields: `ministry` → Ministry, `member` → Person, `role` (primary_coordinator|coordinator|team_member|guest_helper), `join_date` (default=today), `is_active` (default=True), `availability?` (JSONField), `skills?`, `notes?`
- Meta: `unique_together = ("ministry", "member")` - One person can only have one membership per ministry, ordering by `ministry`, then `member`
- Coordinator Roles: Roles `primary_coordinator` and `coordinator` are automatically synced from `Ministry.primary_coordinator` and `Ministry.support_coordinators` fields. When coordinators are removed, their role is updated to `team_member` if they still have a membership record.
