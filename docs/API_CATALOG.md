## API Catalog (Active Routes)

Base URL: `/api/people/`

### Authentication

- **JWT Token Authentication**: All endpoints require authentication except login
- **Base URL**: `/api/auth/`
- **Endpoints**:
  - `POST /api/auth/login/` - Login (returns access + refresh tokens)
  - `POST /api/auth/logout/` - Logout (clears tokens)
  - `POST /api/auth/token/refresh/` - Refresh access token
  - `GET /api/auth/me/` - Get current authenticated user
- **Role-Based Access**: Different modules have different permission requirements
- **VISITOR Exclusion**: VISITOR role cannot log in
- See `docs/AUTHENTICATION_MODULE.md` for detailed documentation

### Branch

- List: `GET /api/people/branches/`
  - Query: `is_headquarters`, `is_active`, `search` (name, code)
  - Access: All authenticated non-visitor users
  - Returns: Array of branch objects
- Retrieve: `GET /api/people/branches/{id}/`
  - Access: All authenticated non-visitor users
- Create: `POST /api/people/branches/`
  - Required: `name`
  - Optional: `code`, `address`, `phone`, `email`, `is_headquarters` (default=False), `is_active` (default=True)
  - Access: ADMIN only
- Update: `PUT /api/people/branches/{id}/`
  - Access: ADMIN only
- Partial Update: `PATCH /api/people/branches/{id}/`
  - Access: ADMIN only
- Delete: `DELETE /api/people/branches/{id}/`
  - Access: ADMIN only

Branch fields (serializer)

```
id, name, code?, address?, phone?, email?, is_headquarters, is_active, created_at (read-only)
```

### Person

- List: `GET /api/people/`
  - Query: `search` (username, email, first_name, last_name), `role`
  - Access: Based on role and module coordinator assignments. See `docs/ACCESS_CONTROL.md` for details.
- Retrieve: `GET /api/people/{id}/`
  - Access: Based on role and module coordinator assignments. See `docs/ACCESS_CONTROL.md` for details.
- Create: `POST /api/people/`
  - Required: `first_name`, `last_name`, `role`
  - Auto: `username` generated from first two letters of first name + last name; uniqueness enforced by suffixing a counter
  - Access: ADMIN, PASTOR, or Senior Coordinator
- Update: `PUT /api/people/{id}/`
  - Access: ADMIN, PASTOR, or Senior Coordinator
- Partial Update: `PATCH /api/people/{id}/`
  - Access: ADMIN, PASTOR, or Senior Coordinator
- Delete: `DELETE /api/people/{id}/`
  - Access: ADMIN, PASTOR

Person fields (serializer)

```
id, username (read-only), first_name, last_name, middle_name?, suffix?, gender?,
facebook_name?, photo?, role, phone?, address?, country?, date_of_birth?,
date_first_attended?, inviter (Person id)?, branch (Branch id)?, member_id?, status?
```

Note: When `branch` field is updated, a Journey entry with type `BRANCH_TRANSFER` is automatically created.

### Family

- List: `GET /api/people/families/`
  - Access: Based on role and module coordinator assignments. Cluster coordinators see families in their clusters + families of cluster members. See `docs/ACCESS_CONTROL.md` for details.
- Retrieve: `GET /api/people/families/{id}/`
  - Access: Based on role and module coordinator assignments. See `docs/ACCESS_CONTROL.md` for details.
- Create: `POST /api/people/families/`
  - Access: ADMIN, PASTOR, or Senior Coordinator
- Update: `PUT /api/people/families/{id}/`
  - Access: ADMIN, PASTOR, or Senior Coordinator
- Partial Update: `PATCH /api/people/families/{id}/`
  - Access: ADMIN, PASTOR, or Senior Coordinator
- Delete: `DELETE /api/people/families/{id}/`
  - Access: ADMIN, PASTOR

Family fields (serializer)

```
id, name, leader (Person id | null), members (Person ids[]), address?, created_at (read-only)
```

### Cluster

- List: `GET /api/people/clusters/`
- Retrieve: `GET /api/people/clusters/{id}/`
- Create: `POST /api/people/clusters/`
- Update: `PUT /api/people/clusters/{id}/`
- Partial Update: `PATCH /api/people/clusters/{id}/`
- Delete: `DELETE /api/people/clusters/{id}/`

Cluster fields (serializer)

```
id, code, name, coordinator (Person id | null), families (Family ids[]),
branch (Branch id)?, description?, created_at (read-only)
```

### Journey

- List: `GET /api/people/journeys/`
  - Query: `user` (Person ID), `type`
- Retrieve: `GET /api/people/journeys/{id}/`
- Create: `POST /api/people/journeys/`
  - Required: `user` (Person ID), `date`, `type`
  - Optional: `title`, `description`, `verified_by` (Person ID)
- Update: `PUT /api/people/journeys/{id}/`
- Partial Update: `PATCH /api/people/journeys/{id}/`
- Delete: `DELETE /api/people/journeys/{id}/`

Journey fields (serializer)

```
id, user (Person ID), title?, date, type (LESSON|BAPTISM|SPIRIT|CLUSTER|NOTE|EVENT_ATTENDANCE|MINISTRY|BRANCH_TRANSFER),
description?, verified_by (Person ID | null), created_at (read-only)
```

Note: `BRANCH_TRANSFER` type is automatically created when a Person's branch changes.

### Module Coordinator Assignments

- List: `GET /api/people/module-coordinators/`
  - Query: `person`, `module`, `level`, `resource_type`, `search`
  - Access: ADMIN only
- Retrieve: `GET /api/people/module-coordinators/{id}/`
  - Access: ADMIN only
- Create: `POST /api/people/module-coordinators/`
  - Access: ADMIN only
  - Payload: `{ person, module, level, resource_id?, resource_type? }`
- Bulk Create: `POST /api/people/module-coordinators/bulk-create/`
  - Access: ADMIN only
  - Payload: `{ assignments: [{ person, module, level, resource_id?, resource_type? }, ...] }`
  - Creates multiple assignments atomically (all validated before any are created)
  - Returns: `{ message: string, created: ModuleCoordinator[] }`
- Update: `PUT /api/people/module-coordinators/{id}/`
  - Access: ADMIN only
- Partial Update: `PATCH /api/people/module-coordinators/{id}/`
  - Access: ADMIN only
- Delete: `DELETE /api/people/module-coordinators/{id}/`
  - Access: ADMIN only

### Ministry

- List: `GET /api/ministries/`
  - Query: `activity_cadence`, `category`, `is_active`, `search` (name, description, coordinator names), `ordering` (name, activity_cadence, created_at)
  - Access: All authenticated non-visitor users (read-only for MEMBER role)
  - Returns: Array of ministry objects with nested `memberships`, `primary_coordinator`, and `support_coordinators`
- Retrieve: `GET /api/ministries/{id}/`
  - Access: All authenticated non-visitor users (read-only for MEMBER role)
- Create: `POST /api/ministries/`
  - Required: `name`, `activity_cadence`
  - Optional: `description`, `category`, `primary_coordinator_id`, `support_coordinator_ids[]`, `meeting_location`, `meeting_schedule` (JSON object), `communication_channel` (URL), `is_active`
  - Access: ADMIN, PASTOR, or Ministry Coordinator with write access
  - Note: Coordinators are automatically synced to `MinistryMember` entries with appropriate roles
- Update: `PUT /api/ministries/{id}/`
  - Access: ADMIN, PASTOR, or Ministry Coordinator with write access
- Partial Update: `PATCH /api/ministries/{id}/`
  - Access: ADMIN, PASTOR, or Ministry Coordinator with write access
- Delete: `DELETE /api/ministries/{id}/`
  - Access: ADMIN, PASTOR, or Ministry Coordinator with write access
  - Note: Cascade deletes all related `MinistryMember` entries

Ministry fields (serializer)

```
id, name, description?, category? (worship|outreach|care|logistics|other),
activity_cadence (weekly|monthly|seasonal|event_driven|holiday|ad_hoc),
primary_coordinator (read-only, UserSummary), primary_coordinator_id (write-only),
support_coordinators (read-only, UserSummary[]), support_coordinator_ids (write-only, Person ids[]),
branch (Branch id)?, meeting_location?, meeting_schedule? (JSON object), communication_channel? (URL),
is_active, created_at (read-only), updated_at (read-only), memberships (read-only, MinistryMember[])
```

### Ministry Member

- List: `GET /api/ministry-members/`
  - Query: `ministry` (Ministry ID), `role` (primary_coordinator|coordinator|team_member|guest_helper), `is_active`, `search` (ministry name, member names), `ordering` (join_date, role)
  - Access: All authenticated non-visitor users (read-only for MEMBER role)
- Retrieve: `GET /api/ministry-members/{id}/`
  - Access: All authenticated non-visitor users (read-only for MEMBER role)
- Create: `POST /api/ministry-members/`
  - Required: `ministry` (Ministry ID), `member_id` (Person ID)
  - Optional: `role` (defaults to team_member), `skills`, `notes`, `is_active` (defaults to true), `availability` (JSON object)
  - Auto: `join_date` set to today if not provided
  - Access: ADMIN, PASTOR, or Ministry Coordinator with write access
- Update: `PUT /api/ministry-members/{id}/`
  - Access: ADMIN, PASTOR, or Ministry Coordinator with write access
- Partial Update: `PATCH /api/ministry-members/{id}/`
  - Access: ADMIN, PASTOR, or Ministry Coordinator with write access
- Delete: `DELETE /api/ministry-members/{id}/`
  - Access: ADMIN, PASTOR, or Ministry Coordinator with write access

Ministry Member fields (serializer)

```
id, ministry (Ministry ID), member (read-only, UserSummary), member_id (write-only, Person ID),
role (primary_coordinator|coordinator|team_member|guest_helper), join_date (read-only, auto-set),
is_active, availability? (JSON object), skills?, notes?
```

### Notes

- Media uploads for `photo` use `MEDIA_URL = /media/` and `MEDIA_ROOT` from settings.
- Pagination is default DRF (not explicitly configured).
- Person serializer includes `journeys` field (read-only) with full journey data.
- Access control: See `docs/ACCESS_CONTROL.md` for complete access matrix and permission rules, including branch-based filtering.
- Branch filtering: All data (People, Families, Clusters, Events, Ministries, Journeys) is filtered by branch based on user's branch assignment. ADMIN and PASTOR from headquarters see all branches.
- Branch transfers: When a Person's `branch` field is updated, a Journey entry with type `BRANCH_TRANSFER` is automatically created.
- Ministry coordinator sync: When `primary_coordinator` or `support_coordinators` are set on a Ministry, corresponding `MinistryMember` entries are automatically created/updated with roles `PRIMARY_COORDINATOR` or `COORDINATOR`. When coordinators are removed, their `MinistryMember` role is updated to `TEAM_MEMBER` if they still have a membership. See `docs/MINISTRIES_MODULE.md` for details.
