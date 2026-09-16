# Access Control Documentation

This document describes the complete access control matrix for the Church Management System, including role-based permissions and module coordinator assignments.

## Branch-Based Access Control

The system supports multiple church branches. Access to data is filtered by branch based on the user's branch assignment:

- **ADMIN**: See all branches and all data (no branch filtering)
- **PASTOR from Headquarters**: See all branches and all data (no branch filtering)
- **PASTOR from Regular Branch**: See only their branch's data
- **Senior Coordinators from Headquarters**: See all branches
- **Senior Coordinators from Regular Branch**: See only their branch's data
- **Regular Coordinators**: See only their branch's data (module assignments also filtered by branch)
- **MEMBER**: See only their branch's data

Branch filtering applies to:

- People (Person)
- Families (derived from members' branches)
- Clusters
- Events
- Ministries
- Journeys (filtered by journey's user's branch)
- Module Coordinator assignments (coordinators only see assignments/resources within their branch)

## Base Roles (No Module Assignments)

| Role        | People Access                       | Families Access   | Clusters Access         | Notes                                                                      |
| ----------- | ----------------------------------- | ----------------- | ----------------------- | -------------------------------------------------------------------------- |
| **ADMIN**   | All people (including other ADMINS) | All families      | All clusters            | Full access, can edit/delete. No branch filtering.                         |
| **PASTOR**  | All people (excluding ADMINS)       | All families      | All clusters            | Full access, can edit/delete. Filtered by branch unless from headquarters. |
| **MEMBER**  | Self + family members only. **May edit own profile** except staff fields and **vital dates** (invited / attended / baptism / lessons — cluster coordinator+ only; Members request changes via coordinator). | Own families only | **All clusters in branch** (read-only), with privacy-safe roster summaries (`members_details` / `families_details`). Full person/family profiles remain self + own family only. | Limited access, no edit/delete on clusters. **Weekly cluster reports are not visible** unless assigned as Cluster Reporter or Coordinator (see module assignments below). Filtered by branch.            |
| **VISITOR** | Cannot log in                       | Cannot log in     | Cannot log in           | No access                                                                  |

## Senior Coordinators (Any Module)

| Assignment                          | People Access                 | Families Access | Clusters Access | Notes                                                                          |
| ----------------------------------- | ----------------------------- | --------------- | --------------- | ------------------------------------------------------------------------------ |
| **Senior Coordinator** (any module) | All people (excluding ADMINS) | All families    | All clusters    | Full access regardless of module. Filtered by branch unless from headquarters. |

## Module-Specific Assignments (Non-Senior)

| Assignment Type           | People Access                                                                                  | Families Access                                                                                | Clusters Access          | Notes                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| **Cluster Coordinator**   | People in assigned cluster(s):<br>- Direct cluster members<br>- Members of families in cluster | Families in assigned cluster(s) + Families of cluster members (even if not directly connected) | **Read** all clusters in branch; **edit/delete** and **reports** only on managed clusters | Module-wide assignments are Senior Coordinator+ only. Filtered by branch. |
| **Cluster Reporter**      | No expanded People list | No expanded Families list | **Assigned cluster(s) only** (read-only); weekly reports on assigned clusters | CLUSTER module only; resource-specific; no cluster management; cannot add people. |
| **Sunday School Teacher** | Students in classes where they are teacher/assistant                                           | Families of those students                                                                     | N/A                      | Limited to their classes                          |
| **Lessons Teacher**       | Students in their lesson sessions                                                              | Families of those students                                                                     | N/A                      | Limited to their students                         |
| **Bible Sharer**          | Members of assigned evangelism groups                                                          | Families of those members                                                                      | N/A                      | Limited to assigned groups; can submit weekly reports; **Add Visitor** only |
| **Evangelism Reporter**   | No expanded People list | No expanded Families list | N/A | Weekly reports for assigned evangelism groups only; cannot add people |

**Evangelism Coordinator** (non-senior): **read** all approved groups in their branch; **create** extra groups (pending until Evangelism Senior / Pastor / Admin approve); **edit** only managed groups and their own pending drafts; **reports** only for managed **approved** groups.

## Frontend Module Access

| Role/Assignment           | Sunday School Module                    | Lessons Module            | Notes                       |
| ------------------------- | --------------------------------------- | ------------------------- | --------------------------- |
| **ADMIN**                 | Full access + Stats/Summary cards       | Full access + Stats cards | All features visible        |
| **PASTOR**                | Full access + Stats/Summary cards       | Full access + Stats cards | All features visible        |
| **Senior Coordinator**    | Full access + Stats/Summary cards       | Full access + Stats cards | All features visible        |
| **Cluster Coordinator**   | Full access + Stats/Summary cards       | Full access + Stats cards | Stats cards visible         |
| **Sunday School Teacher** | Full access + Stats/Summary cards       | Limited access (no stats) | Can see their classes       |
| **Lessons Teacher**       | Limited access (no stats)               | Full access + Stats cards | Can see their students      |
| **MEMBER**                | Limited access (no stats/summary cards) | **Lesson Content** and **Files** only (no Student Progress or Session Reports) | Can see their own data only |
| **Bible Sharer**          | Limited access (no stats)               | Limited access (no stats) | Can see their groups        |

## Multiple Assignments (Union)

When a user has multiple assignments, they see the union of all applicable people/families:

| Example Combinations                              | People Access                                         | Families Access                               |
| ------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| **Cluster Coordinator + Sunday School Teacher**   | People from clusters + Students from classes          | Families from clusters + Families of students |
| **Cluster Coordinator + Lessons Teacher**         | People from clusters + Students from lessons          | Families from clusters + Families of students |
| **Cluster Coordinator + Bible Sharer**            | People from clusters + Members from evangelism groups | Families from clusters + Families of members  |
| **Sunday School Teacher + Lessons Teacher**       | Students from classes + Students from lessons         | Families of all students                      |
| **All three (Cluster + Sunday School + Lessons)** | Union of all three sources                            | Union of all three sources                    |

## Access Priority (Evaluation Order)

1. ADMIN/PASTOR → Full access
2. Senior Coordinator (any module) → Full access
3. Multiple Module Assignments → Union of all assignments
4. Single Module Assignment → Limited to that assignment
5. MEMBER → Self + family; all branch clusters (read-only roster); no expanded People/Family directory
6. Default → Empty (no access)

## Special Rules

1. **ADMIN Exclusion**: ADMIN users are excluded from all queries (except for other ADMINS)
2. **Union Logic**: Multiple assignments are combined (union), not intersection
3. **Resource-Specific Assignments**: Assignments with `resource_id` limit access to that specific resource
4. **Module-Wide Assignments**: For Cluster, Evangelism, and Sunday School, module-wide rows (`resource_id` null) are allowed only at **Senior Coordinator** level. Legacy Coordinator rows without a resource should be normalized with `python manage.py normalize_module_wide_coordinators`.
5. **Member Cluster Access**: Members can browse all clusters in their branch (read-only) and see member/visitor/family **names** via cluster roster summaries. They cannot edit/delete clusters, and cannot open fellow members’ full person or family profiles (self + own families only).
6. **Vital dates**: `date_first_invited`, `date_first_attended`, `first_activity_attended`, baptism dates, and lessons-started / lessons-finished fields are editable only by **cluster coordinator+** (ADMIN, PASTOR, CLUSTER Senior Coordinator, or CLUSTER Coordinator for a cluster containing that person). Others see locked fields with a “contact your cluster coordinator” hover hint.
7. **Cluster Coordinator Family Access**: Cluster coordinators see families of their members even if the family isn't directly connected to the cluster
8. **Member Sunday School Access**: Members can access Sunday School module but stats/summary cards are hidden
9. **Cluster Coordinator Lessons Stats**: Cluster coordinators can see stats cards in Lessons module
10. **NCC ministry coordinators**: Support coordinators have Lessons Coordinator access; primary coordinators have Lessons Senior access (HQ primary may view other branches). These roles do **not** expand People/Families. Access is derived from the NCC ministry record, not a `ModuleCoordinator` LESSONS row.

## Implementation Details

### Backend Queries

- **PersonViewSet**: Collects people from all module assignments (Cluster, Sunday School, Lessons, Evangelism) and returns union
- **FamilyViewSet**: List/retrieve scoped by role (Members: own families; Cluster coordinators: cluster-linked families + families of cluster members). **Create/update** requires Admin, Pastor, or `HasModuleAccess('CLUSTER')` (Cluster COORDINATOR or SENIOR_COORDINATOR). Destroy remains Admin-only. Other-module coordinators (e.g. Evangelism-only) cannot create/update families.
- **ClusterViewSet**: Members can list/retrieve all clusters in their branch; roster fields `members_details` / `families_details` provide display-only summaries without expanding People/Family list scope

### Frontend Conditional Rendering

- **Sunday School**: `SundaySchoolSummary` component hidden for MEMBER role
- **Lessons**: `LessonStatsCards` shown for ADMIN, PASTOR, Senior Coordinators (including NCC primary coordinators), Cluster Coordinators, Lessons coordinators, and Lessons teachers (teacher stats follow their assigned students). **Student Progress** and **Session Reports** tabs are hidden for users without Lessons write access (plain Members). The **Teachers** tab is hidden except for Admin, Pastor, Lessons coordinators, and NCC primary/support coordinators.
- **Lessons branch filter** (tab row on `/lessons`): editable for ADMIN, PASTOR, and **HQ** senior Lessons coordinators (Admin Settings or NCC primary). Locked to the user’s assigned branch for Lessons teachers, Lessons coordinators, NCC support coordinators, and satellite seniors. Student-linked API lists honor `branch_id` when privileged; otherwise server forces `user.branch`. See [LESSONS_MODULE.md](./LESSONS_MODULE.md#branch-scoping).
- **Clusters**: On `ClustersPageView`, the **Clusters** tab primary header action is **Add Cluster** for **ADMIN**, **CLUSTER Senior Coordinator**, or **PASTOR** without a non-senior CLUSTER coordinator-only assignment; others see **Submit Report** as primary. Requires **`module_coordinator_assignments`** on the auth user payload (`UserSerializer` / `GET /auth/me/`). See **Clusters homepage / CTAs** in `docs/CLUSTERS_MODULE.md`. Member cluster cards/views use `members_details` / `families_details` for rosters; person/family panels open only when already in People/Family scope.
- **Families**: **Add Family** and family edit/add-members/mark-inactive actions on People → Families are shown only for Admin, Pastor, or Cluster coordinators (senior or non-senior) via `canManageFamilies`. Plain Members and Cluster Reporters can view families in their list scope but cannot create or edit.

### People create, export, and import

Create, **Export All**, **Import**, and bulk export are **not** granted to every module assignment. Multiple assignments use the union (Cluster Coordinator + Teacher can still Add Person).

| Who | Add Person (Member) | Add Visitor | Export All / Import / bulk export |
| --- | --- | --- | --- |
| **Admin, Pastor** | Yes | Yes | Yes |
| **Cluster Senior Coordinator** or **Cluster Coordinator** (assignment or `Cluster.coordinator` FK) | Yes | Yes | Yes |
| **Evangelism Senior Coordinator, Evangelism Coordinator, Bible Sharer** | No | Yes | No |
| **Plain members, Cluster/Evangelism Reporters, Lessons/Sunday School Teachers**, and coordinators of other modules (Lessons, Sunday School, Finance, Events, Ministries) unless they also have Cluster access above | No | No | No |

`POST /api/people/people/` follows the same matrix: Visitor requires `can_add_visitor`; Member and any other role require `can_add_person`. Senior Coordinators of a non-Cluster module no longer get Add Person. Only **admins** may assign the Pastor or Admin roles (the person form hides those options for everyone else). Non-admins who already have Pastor as their current role may keep it on update.

## Multiple Assignment Tagging

Admins can create multiple module coordinator assignments for a single person in one operation using the "Create Multiple Assignments" feature. This allows efficient bulk tagging of users with multiple roles across different modules.

### Bulk Create Endpoint

- **URL**: `POST /api/people/module-coordinators/bulk-create/`
- **Payload**: `{ assignments: [{ person, module, level, resource_id?, resource_type? }, ...] }`
- **Validation**: All assignments validated before any are created (atomic operation)
- **Duplicate Prevention**: Respects unique_together constraint (person + module + resource_id)
