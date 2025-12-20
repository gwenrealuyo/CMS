# Ministries Module Guide

## Overview

The Ministries module manages church ministries, their coordinators, and team members. It provides a comprehensive system for tracking ministry activities, member assignments, roles, and coordination responsibilities.

## Data Models

### Ministry Model

- `apps.ministries.models.Ministry` represents a church ministry with:
  - `name` (CharField, max 100 chars) - Name of the ministry
  - `description` (TextField, optional) - Detailed description of the ministry
  - `category` (CharField, optional) - Ministry category:
    - `worship` - Worship ministries (music, choir, etc.)
    - `outreach` - Outreach and evangelism ministries
    - `care` - Care ministries (visitation, counseling, etc.)
    - `logistics` - Logistics and operations
    - `other` - Other ministries
  - `activity_cadence` (CharField) - How often the ministry meets:
    - `weekly` - Weekly activities
    - `monthly` - Monthly activities
    - `seasonal` - Seasonal activities
    - `event_driven` - Activities tied to specific events
    - `holiday` - Holiday-specific activities
    - `ad_hoc` - As needed
  - `primary_coordinator` (ForeignKey to Person, nullable) - Primary coordinator for the ministry
  - `support_coordinators` (ManyToMany to Person) - Additional support coordinators
  - `meeting_location` (CharField, optional) - Where the ministry meets
  - `meeting_schedule` (JSONField, optional) - Meeting schedule details (day, time, window, notes)
  - `communication_channel` (URLField, optional) - Link to communication channel (e.g., WhatsApp, Discord)
  - `is_active` (BooleanField, default=True) - Whether the ministry is currently active
  - Audit fields: `created_at`, `updated_at` (auto-managed timestamps)
- Default ordering: Alphabetically by `name`

### MinistryMember Model

- `apps.ministries.models.MinistryMember` represents a person's membership in a ministry with:
  - `ministry` (ForeignKey to Ministry, CASCADE delete) - The ministry
  - `member` (ForeignKey to Person, CASCADE delete) - The person
  - `role` (CharField) - Role within the ministry:
    - `primary_coordinator` - Primary coordinator (synced from `Ministry.primary_coordinator`)
    - `coordinator` - Support coordinator (synced from `Ministry.support_coordinators`)
    - `team_member` - Regular team member
    - `guest_helper` - Guest or occasional helper
  - `join_date` (DateField, default=today) - When the person joined the ministry
  - `is_active` (BooleanField, default=True) - Whether the membership is active
  - `availability` (JSONField, default=dict) - Availability information (flexible structure)
  - `skills` (TextField, optional) - Skills or talents relevant to the ministry
  - `notes` (TextField, optional) - Additional notes about the membership
- **Unique Constraint**: `unique_together = ("ministry", "member")` - One person can only have one membership per ministry
- Default ordering: By `ministry`, then `member`

### Coordinator Synchronization

The system automatically synchronizes coordinator assignments between `Ministry` fields and `MinistryMember` entries:

1. **When `primary_coordinator` is set**: Automatically creates or updates a `MinistryMember` entry with role `PRIMARY_COORDINATOR`
2. **When `support_coordinators` are set**: Automatically creates or updates `MinistryMember` entries with role `COORDINATOR` for each support coordinator
3. **When coordinators are removed**: If a coordinator is removed from `primary_coordinator` or `support_coordinators`, their `MinistryMember` role is automatically updated to `TEAM_MEMBER` (if they still have a membership record)
4. **Edge Cases**:
   - If a person is removed from `support_coordinators` but is still `primary_coordinator`, they remain `PRIMARY_COORDINATOR`
   - If a person is removed from `primary_coordinator` but is still in `support_coordinators`, they become `COORDINATOR`
   - The primary coordinator cannot be in `support_coordinators` (validation prevents this)

This synchronization happens:

- **Via Serializer**: When creating or updating a Ministry through the API
- **Via Signals**: When updating a Ministry directly (e.g., admin panel, direct model updates)

## API Surface

All routes live under `/api/ministries/`:

### Ministries Endpoint

- **Base URL**: `/api/ministries/`
- **ViewSet**: `MinistryViewSet`

#### List Ministries

- **GET** `/api/ministries/`
  - **Query Parameters**:
    - `activity_cadence` - Filter by activity cadence
    - `category` - Filter by category
    - `is_active` - Filter by active status (true/false)
    - `search` - Search in name, description, and coordinator names
    - `ordering` - Order by `name`, `activity_cadence`, or `created_at`
  - **Response**: Array of ministry objects with nested `memberships`, `primary_coordinator`, and `support_coordinators`
  - **Access**: All authenticated non-visitor users (read-only for MEMBER role)

#### Retrieve Ministry

- **GET** `/api/ministries/{id}/`
  - **Response**: Single ministry object with full details
  - **Access**: All authenticated non-visitor users (read-only for MEMBER role)

#### Create Ministry

- **POST** `/api/ministries/`
  - **Request Body**:
    ```json
    {
      "name": "Worship Team",
      "description": "Handles music for Sunday services",
      "category": "worship",
      "activity_cadence": "weekly",
      "primary_coordinator_id": 1,
      "support_coordinator_ids": [2, 3],
      "meeting_location": "Main Sanctuary",
      "meeting_schedule": {
        "day": "Sunday",
        "time": "09:00",
        "window": "Morning",
        "notes": "Before service"
      },
      "communication_channel": "https://example.com/chat",
      "is_active": true
    }
    ```
  - **Response**: Created ministry object
  - **Access**: ADMIN, PASTOR, or Ministry Coordinator with write access
  - **Note**: Coordinators are automatically synced to `MinistryMember` entries

#### Update Ministry

- **PUT** `/api/ministries/{id}/` (full update)
- **PATCH** `/api/ministries/{id}/` (partial update)
  - **Request Body**: Same as create, all fields optional for PATCH
  - **Response**: Updated ministry object
  - **Access**: ADMIN, PASTOR, or Ministry Coordinator with write access
  - **Note**: Coordinator changes are automatically synced to `MinistryMember` entries

#### Delete Ministry

- **DELETE** `/api/ministries/{id}/`
  - **Response**: 204 No Content
  - **Access**: ADMIN, PASTOR, or Ministry Coordinator with write access
  - **Note**: Cascade deletes all related `MinistryMember` entries

### Ministry Members Endpoint

- **Base URL**: `/api/ministry-members/`
- **ViewSet**: `MinistryMemberViewSet`

#### List Ministry Members

- **GET** `/api/ministry-members/`
  - **Query Parameters**:
    - `ministry` - Filter by ministry ID
    - `role` - Filter by role (primary_coordinator, coordinator, team_member, guest_helper)
    - `is_active` - Filter by active status
    - `search` - Search in ministry name and member names
    - `ordering` - Order by `join_date` or `role`
  - **Response**: Array of ministry member objects
  - **Access**: All authenticated non-visitor users (read-only for MEMBER role)

#### Retrieve Ministry Member

- **GET** `/api/ministry-members/{id}/`
  - **Response**: Single ministry member object
  - **Access**: All authenticated non-visitor users (read-only for MEMBER role)

#### Create Ministry Member

- **POST** `/api/ministry-members/`
  - **Request Body**:
    ```json
    {
      "ministry": 1,
      "member_id": 5,
      "role": "team_member",
      "skills": "Singing, piano",
      "notes": "Available weekends",
      "is_active": true
    }
    ```
  - **Response**: Created ministry member object
  - **Access**: ADMIN, PASTOR, or Ministry Coordinator with write access
  - **Note**: `join_date` is automatically set to today if not provided

#### Update Ministry Member

- **PUT** `/api/ministry-members/{id}/` (full update)
- **PATCH** `/api/ministry-members/{id}/` (partial update)
  - **Request Body**: Same as create, all fields optional for PATCH
  - **Response**: Updated ministry member object
  - **Access**: ADMIN, PASTOR, or Ministry Coordinator with write access
  - **Note**: `join_date` is read-only and cannot be updated

#### Delete Ministry Member

- **DELETE** `/api/ministry-members/{id}/`
  - **Response**: 204 No Content
  - **Access**: ADMIN, PASTOR, or Ministry Coordinator with write access

## Access Control

### Role-Based Permissions

| Role        | Read Access                | Write Access   |
| ----------- | -------------------------- | -------------- |
| **ADMIN**   | All ministries             | All ministries |
| **PASTOR**  | All ministries             | All ministries |
| **MEMBER**  | All ministries (read-only) | None           |
| **VISITOR** | Cannot log in              | Cannot log in  |

### Module Coordinator Access

- **Ministry Coordinators** (assigned via `ModuleCoordinator` with `module=MINISTRIES`):
  - Can read and write ministries they are assigned to
  - Can also access ministries where they are `primary_coordinator` or in `support_coordinators`
  - Access is determined by `resource_id` in the coordinator assignment

### Permission Classes

- **Read Operations** (`list`, `retrieve`): `IsAuthenticatedAndNotVisitor`, `IsMemberOrAbove`
- **Write Operations** (`create`, `update`, `destroy`): `IsAuthenticatedAndNotVisitor`, `HasModuleAccess(MINISTRIES, "write")`

## Common Workflows

### Creating a Ministry with Coordinators

1. Create the ministry with `primary_coordinator_id` and/or `support_coordinator_ids`
2. The system automatically creates `MinistryMember` entries for coordinators with appropriate roles
3. Add additional team members via the `/api/ministry-members/` endpoint

### Adding Members to a Ministry

1. Use `POST /api/ministry-members/` with `ministry`, `member_id`, and `role`
2. For coordinators, it's recommended to set them via `primary_coordinator` or `support_coordinators` on the Ministry to ensure proper sync

### Changing Coordinator Roles

1. Update the ministry's `primary_coordinator_id` or `support_coordinator_ids`
2. The system automatically updates the corresponding `MinistryMember` roles
3. If a coordinator is removed, their role is updated to `TEAM_MEMBER` (if they still have a membership)

### Removing a Member

1. Use `DELETE /api/ministry-members/{id}/` to remove a member
2. If the member is a coordinator, consider removing them from coordinator fields first to maintain data consistency

## Frontend Integration

The frontend provides:

- **Ministry List View**: Displays all ministries with filtering and search
- **Ministry Form**: Create/edit ministry with coordinator selection and member management
- **Ministry View**: Detailed view showing ministry information, coordinators, and members
- **Member Management**: Add, edit, and remove members with role assignment

### Key Frontend Files

- `frontend/src/app/ministries/page.tsx` - Main ministries page
- `frontend/src/components/ministries/MinistryForm.tsx` - Ministry creation/editing form
- `frontend/src/components/ministries/MinistryView.tsx` - Ministry detail view
- `frontend/src/hooks/useMinistries.ts` - React hook for ministry operations
- `frontend/src/types/ministry.ts` - TypeScript type definitions

## Data Integrity

### Constraints

- **Unique Membership**: One person can only have one `MinistryMember` record per ministry
- **Coordinator Sync**: Coordinator assignments are automatically synced to `MinistryMember` entries
- **Cascade Deletes**: Deleting a ministry deletes all related `MinistryMember` entries
- **Validation**: Primary coordinator cannot be in `support_coordinators` list

### Best Practices

1. **Use Coordinator Fields for Coordinators**: Always set coordinators via `primary_coordinator` or `support_coordinators` rather than directly creating `MinistryMember` entries with coordinator roles
2. **Member Management**: Use `MinistryMember` entries for team members and guest helpers
3. **Role Consistency**: The system maintains consistency between coordinator fields and `MinistryMember` roles automatically

## Signals

The module uses Django signals to ensure coordinator synchronization even when ministries are updated outside the serializer:

- **`post_save` signal**: Syncs when `Ministry` is saved (handles `primary_coordinator` changes)
- **`m2m_changed` signal**: Syncs when `support_coordinators` ManyToMany is modified

Signals are registered in `apps.ministries.apps.MinistriesConfig.ready()`.




