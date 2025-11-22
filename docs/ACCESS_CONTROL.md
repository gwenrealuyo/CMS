# Access Control Documentation

This document describes the complete access control matrix for the Church Management System, including role-based permissions and module coordinator assignments.

## Base Roles (No Module Assignments)

| Role | People Access | Families Access | Clusters Access | Notes |
|------|---------------|-----------------|-----------------|-------|
| **ADMIN** | All people (including other ADMINS) | All families | All clusters | Full access, can edit/delete |
| **PASTOR** | All people (excluding ADMINS) | All families | All clusters | Full access, can edit/delete |
| **MEMBER** | Self + family members only | Own families only | Own cluster (read-only) | Limited access, no edit/delete on clusters |
| **VISITOR** | Cannot log in | Cannot log in | Cannot log in | No access |

## Senior Coordinators (Any Module)

| Assignment | People Access | Families Access | Clusters Access | Notes |
|------------|---------------|-----------------|-----------------|-------|
| **Senior Coordinator** (any module) | All people (excluding ADMINS) | All families | All clusters | Full access regardless of module |

## Module-Specific Assignments (Non-Senior)

| Assignment Type | People Access | Families Access | Clusters Access | Notes |
|-----------------|---------------|-----------------|-----------------|-------|
| **Cluster Coordinator** | People in assigned cluster(s):<br>- Direct cluster members<br>- Members of families in cluster | Families in assigned cluster(s) + Families of cluster members (even if not directly connected) | Assigned cluster(s) only | Limited to assigned clusters |
| **Sunday School Teacher** | Students in classes where they are teacher/assistant | Families of those students | N/A | Limited to their classes |
| **Lessons Teacher** | Students in their lesson sessions | Families of those students | N/A | Limited to their students |
| **Bible Sharer** | Members of assigned evangelism groups | Families of those members | N/A | Limited to assigned groups |

## Frontend Module Access

| Role/Assignment | Sunday School Module | Lessons Module | Notes |
|----------------|---------------------|----------------|-------|
| **ADMIN** | Full access + Stats/Summary cards | Full access + Stats cards | All features visible |
| **PASTOR** | Full access + Stats/Summary cards | Full access + Stats cards | All features visible |
| **Senior Coordinator** | Full access + Stats/Summary cards | Full access + Stats cards | All features visible |
| **Cluster Coordinator** | Full access + Stats/Summary cards | Full access + Stats cards | Stats cards visible |
| **Sunday School Teacher** | Full access + Stats/Summary cards | Limited access (no stats) | Can see their classes |
| **Lessons Teacher** | Limited access (no stats) | Full access + Stats cards | Can see their students |
| **MEMBER** | Limited access (no stats/summary cards) | Limited access (no stats) | Can see their own data only |
| **Bible Sharer** | Limited access (no stats) | Limited access (no stats) | Can see their groups |

## Multiple Assignments (Union)

When a user has multiple assignments, they see the union of all applicable people/families:

| Example Combinations | People Access | Families Access |
|----------------------|---------------|-----------------|
| **Cluster Coordinator + Sunday School Teacher** | People from clusters + Students from classes | Families from clusters + Families of students |
| **Cluster Coordinator + Lessons Teacher** | People from clusters + Students from lessons | Families from clusters + Families of students |
| **Cluster Coordinator + Bible Sharer** | People from clusters + Members from evangelism groups | Families from clusters + Families of members |
| **Sunday School Teacher + Lessons Teacher** | Students from classes + Students from lessons | Families of all students |
| **All three (Cluster + Sunday School + Lessons)** | Union of all three sources | Union of all three sources |

## Access Priority (Evaluation Order)

1. ADMIN/PASTOR → Full access
2. Senior Coordinator (any module) → Full access
3. Multiple Module Assignments → Union of all assignments
4. Single Module Assignment → Limited to that assignment
5. MEMBER → Self + family + own cluster (read-only)
6. Default → Empty (no access)

## Special Rules

1. **ADMIN Exclusion**: ADMIN users are excluded from all queries (except for other ADMINS)
2. **Union Logic**: Multiple assignments are combined (union), not intersection
3. **Resource-Specific Assignments**: Assignments with `resource_id` limit access to that specific resource
4. **Module-Wide Assignments**: Assignments without `resource_id` may grant broader access depending on module rules
5. **Member Cluster Access**: Members can view their own cluster but cannot edit or delete
6. **Cluster Coordinator Family Access**: Cluster coordinators see families of their members even if the family isn't directly connected to the cluster
7. **Member Sunday School Access**: Members can access Sunday School module but stats/summary cards are hidden
8. **Cluster Coordinator Lessons Stats**: Cluster coordinators can see stats cards in Lessons module

## Implementation Details

### Backend Queries

- **PersonViewSet**: Collects people from all module assignments (Cluster, Sunday School, Lessons, Evangelism) and returns union
- **FamilyViewSet**: Includes families directly connected to clusters + families of cluster members
- **ClusterViewSet**: Members can read their own cluster via `HasModuleAccess('CLUSTER', 'read')`

### Frontend Conditional Rendering

- **Sunday School**: `SundaySchoolSummary` component hidden for MEMBER role
- **Lessons**: `LessonStatsCards` shown for ADMIN, PASTOR, Senior Coordinators, and Cluster Coordinators

## Multiple Assignment Tagging

Admins can create multiple module coordinator assignments for a single person in one operation using the "Create Multiple Assignments" feature. This allows efficient bulk tagging of users with multiple roles across different modules.

### Bulk Create Endpoint

- **URL**: `POST /api/people/module-coordinators/bulk-create/`
- **Payload**: `{ assignments: [{ person, module, level, resource_id?, resource_type? }, ...] }`
- **Validation**: All assignments validated before any are created (atomic operation)
- **Duplicate Prevention**: Respects unique_together constraint (person + module + resource_id)

