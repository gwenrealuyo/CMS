# The Lighthouse — Access Levels Guide

**Audience:** Administrators, pastors, and coordinators who need to understand who can see and do what  
**Last updated:** June 2026

**PDF:** `Access-Levels-Guide.pdf`

---

## How access works

The Lighthouse uses **two layers** of access control:

1. **Base role** — set on each person's account (Admin, Pastor, Member, or Visitor).
2. **Module assignments** — optional extras that grant coordinator, teacher, or bible-sharer capabilities **within a specific module**.

A cluster coordinator is typically a **Member** (or Pastor) who also has a **Cluster → Coordinator** assignment.

Your **branch** (church location) further limits what data you see unless you are an Admin, an HQ Pastor, or an HQ Senior Coordinator.

---

## Base roles

These are set when an administrator creates or edits a person under **Account & Role**.

| Role | Can log in? | Typical use |
|------|-------------|-------------|
| **Admin** | Yes | Full system access; manages users, branches, module settings, and coordinator assignments |
| **Pastor** | Yes | Pastoral oversight; broad read/write across modules in their branch (all branches if HQ) |
| **Member** | Yes | Regular church member; read-mostly access unless given module assignments |
| **Visitor** | **No** | Guest record only — tracked by staff, cannot sign in |

### What each base role can do (without module assignments)

| Capability | Admin | Pastor | Member | Visitor |
|------------|-------|--------|--------|---------|
| Log in | Yes | Yes | Yes | No |
| See disabled modules | Yes | No | No | — |
| Manage branches / module toggles | Yes | No | No | — |
| Assign module coordinators | Yes | No | No | — |
| People — view | All (incl. admins) | All except admins | Self + family | — |
| People — create/edit | Yes | Yes | Add visitors only | — |
| People — delete | Yes | No | No | — |
| Families — view | All | All (branch-scoped) | Own families | — |
| Clusters — view | All | All (branch-scoped) | Own cluster (read-only) | — |
| Module read access | All modules | All enabled modules | All enabled modules (limited data) | — |
| Module write access | All | All enabled | **Read only** | — |
| Finance module | Yes | Yes | No | — |
| Analytics / Reports hub | Yes | Yes | No | — |
| Admin Settings | Yes | No | No | — |

---

## Module assignments overview

Administrators assign module access under **Admin Settings → Module Coordinators**.

Each assignment has:

| Field | Meaning |
|-------|---------|
| **Person** | Who receives the access (Admin accounts cannot be assigned) |
| **Module** | Which area of the app (Cluster, Evangelism, Lessons, etc.) |
| **Level** | What kind of access within that module |
| **Scope** | **Senior Coordinator:** module-wide. **Coordinator** on Cluster, Evangelism, or Sunday School: must pick resource(s) in the assignee's branch |

A person can hold **multiple assignments** across different modules. Access is combined (you see the **union** of everything your assignments allow).

### Available modules

| Module | What it covers |
|--------|----------------|
| **Cluster** | Small groups and weekly cluster reports |
| **Evangelism** | Bible study groups, prospects, conversion tracking |
| **Lessons** | New Converts Course (NCC) |
| **Sunday School** | Classes, enrollment, attendance |
| **Events** | Church calendar and occurrence attendance |
| **Ministries** | Ministry teams and rosters |
| **Finance** | Donations, offerings, pledges |

---

## Coordinator levels

| Level | Summary |
|-------|---------|
| **Senior Coordinator** | Module-wide oversight; can delete records; sees branch-wide (or all branches at HQ); compliance and stats views |
| **Coordinator** | Leadership within a module; create and edit; may be scoped to specific clusters, groups, or classes |
| **Teacher** | Sunday School or Lessons instruction; edit own classes/students; generally cannot delete |
| **Bible Sharer** | Evangelism group facilitation; edit assigned groups; generally cannot delete |

### Per-module levels available

| Module | Levels you can assign | Resource-specific scope? |
|--------|----------------------|--------------------------|
| **Cluster** | Coordinator, Senior Coordinator, **Reporter** | Coordinator/Reporter: pick cluster(s); Senior: module-wide |
| **Evangelism** | Coordinator, Senior Coordinator, Bible Sharer | Yes — pick evangelism group(s) |
| **Lessons** | Coordinator, Senior Coordinator, Teacher | Module-wide only |
| **Sunday School** | Coordinator, Senior Coordinator, Teacher | Yes — pick class(es) |
| **Events** | Coordinator, Senior Coordinator | Module-wide only |
| **Ministries** | Coordinator, Senior Coordinator | Module-wide only |
| **Finance** | Coordinator, Senior Coordinator | Module-wide only |

### Scope: module-wide vs resource-specific

| Scope | Meaning |
|-------|---------|
| **Module-wide** (`resource` not set) | **Senior Coordinators only** for Cluster, Evangelism, and Sunday School — access across the entire module within your branch |
| **Resource-specific** | **Required** for Coordinators on Cluster, Evangelism, and Sunday School — limit to selected clusters, groups, or classes in the assignee's branch |

**Example:** A **Cluster Coordinator** scoped to "North Cluster" can manage and submit reports only for that cluster. A **Cluster Senior Coordinator** (module-wide) can oversee all clusters in their branch.

**Cluster coordinator sync:** When you set someone as **coordinator** on a cluster record, the system also creates a matching **Cluster → Coordinator** module assignment for that cluster.

---

## What module assignments add

Module assignments grant **extra** capabilities on top of your base role. They do **not** change your login role — the app checks both.

### People and families visibility

When you have module assignments, you may see more people and families than a plain Member:

| Assignment | People you can view | Families you can view |
|------------|--------------------|-----------------------|
| **Senior Coordinator** (any module) | All people except admins (branch-scoped) | All families in scope |
| **Cluster Coordinator** | Members of assigned cluster(s) + their families | Families linked to those clusters |
| **Sunday School Teacher** | Students in your class(es) | Families of those students |
| **Lessons Teacher** | Your lesson students | Families of those students |
| **Bible Sharer** | Members of assigned evangelism groups | Families of those members |
| **Multiple assignments** | Union of all the above | Union of all the above |

### People and families editing

| Who | Create / edit people & families |
|-----|--------------------------------|
| Admin, Pastor | Yes (within branch scope) |
| **Any module coordinator assignment** | Yes (within visibility scope) |
| Plain Member | Add **visitors** only |

### Per-module actions

| Action | Admin / Pastor | Senior Coordinator | Coordinator / Teacher / Bible Sharer | Plain Member |
|--------|----------------|--------------------|----------------------------------------|--------------|
| **Read** module data | Yes | Yes | Yes (scoped) | Yes (limited) |
| **Create / edit** in module | Yes | Yes | Yes (scoped) | No |
| **Delete** in module | Yes | Yes (senior level) | No* | No |

\* Coordinators and teachers can create and edit but **delete** typically requires **Senior Coordinator** level (or Admin/Pastor).

### Module-specific notes

**Clusters**

- **Cluster Reporter** (CLUSTER module only): see **assigned cluster card(s) only**; submit weekly reports for those clusters; cannot edit cluster members or settings; People create limited to **visitors only**.
- Non-senior **Cluster Coordinators** can **browse all cluster cards in their branch** (read-only for clusters they do not manage).
- **Weekly reports** (list, analytics, year filters, create/edit/delete) are limited to **managed clusters** (FK coordinator and/or resource-specific Cluster → Coordinator assignment).
- **Compliance** tab is for senior cluster coordinators only.
- Members see their own cluster read-only.

**Evangelism**

- **Bible Sharers** can edit groups they belong to; coordinators manage assigned groups.
- Weekly evangelism reports require evangelism coordinator access.

**Lessons**

- **Teachers** see and log sessions for their students.
- **Coordinators** assign lessons and see broader student lists.
- Branch filter on Lessons is editable for Admin, Pastor, and senior Lessons coordinators.

**Sunday School**

- **Teachers** manage attendance for their classes.
- Summary stats hidden from plain members.

**Events**

- Event coordinators create and edit events.
- Non-events senior coordinators may only edit events they created.

**Ministries**

- Ministry coordinators see ministries they are assigned to or listed on as primary/support coordinator.

**Finance**

- Page access is primarily **Admin** and **Pastor**; finance module coordinators support finance workflows where configured.

---

## Branch scoping

| Who | Branch visibility |
|-----|-------------------|
| **Admin** | All branches |
| **Pastor at Headquarters** | All branches |
| **Pastor at regular branch** | Own branch only |
| **Senior Coordinator at HQ** | All branches |
| **Senior Coordinator at regular branch** | Own branch only |
| **Scoped coordinators / teachers** | Own branch; data further limited by resource assignment |
| **Member** | Own branch; self + family + own cluster |

Branch filters appear as chips or dropdowns on many pages. If a filter is locked, your role cannot view other branches.

---

## Multiple assignments (common examples)

| Person | Assignments | Effective access |
|--------|-------------|------------------|
| Small-group leader | Member + Cluster Coordinator (Cluster A) | Submit reports for Cluster A; edit cluster members; see those families |
| NCC teacher | Member + Lessons Teacher | Log lesson sessions; view assigned students |
| SS teacher + cluster lead | Member + Sunday School Teacher (Class 1) + Cluster Coordinator (Cluster B) | Students in Class 1 **plus** Cluster B members and families |
| Department head | Pastor + Evangelism Senior Coordinator | Full evangelism module in branch + pastoral people access |
| Finance volunteer | Member + Finance Coordinator | Finance module write access (page may still require Pastor/Admin for some views) |

When assignments overlap, you always get the **broadest combined view** — never less than any single assignment would give alone.

---

## Frontend: what you see in the app

The sidebar, dashboard cards, quick actions (+ menu), and stats panels adapt to your access:

- **Disabled modules** disappear from the sidebar (except for Admins).
- **Stats / summary cards** in Sunday School and Lessons are hidden from plain Members.
- **Cluster page primary button** is **Add Cluster** for admins, pastors, and senior cluster coordinators; other cluster coordinators see **Submit Report** as the main action.
- **Analytics** appears only for Admin and Pastor roles.
- **Admin Settings** appears only for Admins.

The app reads your assignments from your login profile — you do not pick a "coordinator mode."

---

## Assigning access (admin quick steps)

1. **Create the person** with a login-capable base role (Member, Pastor, or Admin).
2. Go to **Admin Settings → Module Coordinators**.
3. **Create Assignment** (one at a time) or **Bulk assign** (several resources or modules at once).
4. Choose person, module, level, and scope.
5. Verify with filters on the Module Coordinators list or the person's profile.

See the **User Management Guide** for step-by-step screenshots and password workflows.

---

## Access evaluation order

When the system decides what you can see:

1. **Admin / Pastor** — broad access (with branch rules).
2. **Senior Coordinator** (any module) — broad people/families access in branch.
3. **Multiple module assignments** — union of all assignment scopes.
4. **Single module assignment** — limited to that module's scope.
5. **Plain Member** — self, family, own cluster (read-only).
6. **Visitor** — cannot log in.

**Special rules:**

- Admin accounts are hidden from non-admin user searches.
- Disabled modules block access for everyone except Admins.
- Resource-specific assignments always limit lists to those resources unless you also have a module-wide row for that module.

---

## Troubleshooting access issues

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| User cannot submit cluster reports | No Cluster assignment for that cluster | Add Cluster → Coordinator scoped to the cluster |
| User sees no one in People | Plain Member with no assignments | Expected — they only see self/family; add assignment if they need more |
| User needs coordinator access | No module assignments | Add assignments under Admin Settings → Module Coordinators |
| Cannot see Finance page | Page restricted to Admin/Pastor | Change base role or use pastor account |
| Module missing from sidebar | Module disabled | Admin → Module Controls → enable module |
| Teacher cannot delete a record | Delete requires Senior Coordinator | Escalate to senior coordinator or pastor |

---

## Quick reference matrix

| I am a… | People edit | Cluster reports | Lessons assign | SS attendance | Events create |
|---------|-------------|-----------------|----------------|---------------|---------------|
| Admin | All | All | All | All | All |
| Pastor | All (branch) | All (branch) | All (branch) | All (branch) | All (branch) |
| Member | Visitors only | No | No | No | No |
| Cluster Coordinator | Scoped | Yes (scoped) | No | No | No |
| Cluster Reporter | Visitors only | Yes (assigned) | No | No | No |
| Cluster Senior Coord. | Branch-wide | All (branch) | No | No | No |
| Lessons Teacher | Students | No | No | No | No |
| Lessons Coordinator | Branch students | No | Yes | No | No |
| SS Teacher | Class students | No | No | Yes (class) | No |
| Evangelism Coord. | Group members | No | No | No | No |
| Bible Sharer | Group members | No | No | No | No |

For full technical detail (API permissions, queryset rules), see `ACCESS_CONTROL.md` in the developer documentation.
