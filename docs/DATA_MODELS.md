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



