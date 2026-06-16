# Church CMS — User Management Guide

**Audience:** Administrators who create accounts and assign module access  
**Last updated:** June 2026

**PDF:** [`User-Management-Guide.pdf`](./User-Management-Guide.pdf) — regenerate with:

```bash
python3 docs/scripts/generate_user_management_pdf.py
```

(Requires `fpdf2`: `pip install fpdf2`)

---

## Before you start

- You need an **ADMIN** account. Do not share your login; each admin should have their own account.
- You must use the main web app (not Django `/admin/`).
- Have the person's **first name**, **last name**, and **branch** ready before creating them.
- For login-capable users (Member, Pastor, Admin), you will set or auto-generate a **temporary password**.

---

## Part 1 — Create a new user

### Step 1: Log in

1. Open the CMS in your browser.
2. Go to the **Login** page.
3. Enter your admin **username** and **password**.
4. Click **Sign in**.

### Step 2: Open the People page

1. In the left sidebar, click **People**.
2. Click the **Add Person** button (top right).

   **Shortcut:** Use the **+** menu in the top navbar and choose **Add Person**.

### Step 3: Fill in basic information

On the **Basic Info** tab, complete at minimum:

| Field | Required | Notes |
|-------|----------|-------|
| First name | Yes | Used to generate username |
| Last name | Yes | Used to generate username |
| Email | Recommended | For contact and password-reset requests |
| Phone, address, etc. | Optional | As needed for your records |
| Branch | Yes | Required for admins creating users |

**Username rule:** The system auto-generates the username from the name (first two letters of first name + last name, lowercase). Example: John Smith → `josmith`. If that username exists, a number is appended (`josmith1`, etc.). Usernames cannot be changed from the main app after creation.

### Step 4: Set role and status

In the **Account & Role** section:

| Role | Can log in? | Typical use |
|------|-------------|-------------|
| **Member** | Yes | Regular church member; add module assignments for coordinator/teacher access |
| **Visitor** | No | Guest record only |
| **Pastor** | Yes | Branch or HQ pastoral oversight |
| **Admin** | Yes | Full system access (use sparingly) |

Coordinator capabilities come from **module assignments** (see Part 3 and the Access Levels Guide).

Choose **Status** (e.g. Active). For visitors, use Invited or Attended.

### Step 5: Set login access (admins only, non-Visitor roles)

If the role is **not** Visitor, you will see a **Login access** section:

1. **Auto-generate temporary password** (recommended, default)  
   - The system creates a secure random password.
2. **Set password manually**  
   - Enter and confirm a password (min. 8 characters, at least one letter and one number).

The user will be required to **change their password on first login**.

### Step 6: Save and share credentials

1. Click **Save** / submit the form.
2. A **User created successfully** dialog appears with:
   - Full name
   - **Username**
   - **Temporary password** (only when auto-generated)
3. Use **Copy** buttons and share credentials securely (in person or encrypted channel—not plain email if avoidable).
4. Tell the new user to log in and follow the **change password** screen.

### Step 7: New user's first login

1. New user opens the login page.
2. Enters the **username** and **temporary password** you provided.
3. Is redirected to **Change password** and must set a new password before using the app.

---

## Part 2 — Reset a user's password

If someone forgets their password:

### Option A — From the person's profile (recommended)

1. Go to **People** and open the person's profile.
2. Click **Reset password** (admin only, not available for Visitors).
3. Choose **auto-generate** or **manual** temporary password.
4. Share the new credentials securely.

### Option B — Password reset request workflow

1. User visits **Forgot password** and is told to contact an administrator.
2. Admin goes to **Admin Settings** → **Password Resets** tab.
3. Approve or reject pending requests. Approved resets use a default temporary password (`changeme123`) unless you use Option A instead.

---

## Part 3 — Assign module coordinator access

Module assignments grant coordinator, teacher, and bible-sharer access within a module (e.g. Cluster Coordinator, Lessons Teacher). A person is usually a **Member** (or Pastor) with one or more assignments. A person can hold **multiple** assignments across modules.

### Step 1: Open Module Coordinators

1. In the sidebar, click **Admin Settings** (ADMIN only).
2. Open the **Module Coordinators** tab.

### Step 2: Choose how to assign

**Single assignment — Create Assignment**

1. Click **Create Assignment**.
2. Select **Person** (ADMIN users are not listed).
3. Select **Module** and **Level** (see reference table below).
4. Choose scope:
   - **Module-wide** — access across the whole module (typical for Senior Coordinators).
   - **Resource-specific** — limit to selected clusters, evangelism groups, or Sunday School classes.
5. Click **Create Assignment**.

**Multiple resources at once — Bulk assign**

1. Click **Bulk assign…**
2. Pick one **person**, one **module**, and one **level**.
3. For Cluster, Evangelism, or Sunday School with resource-specific scope, multi-select the resources.
4. Submit once; all assignments are saved together.

**Mixed modules in one submit**

1. In the Bulk assign modal, open **Advanced**.
2. Add rows for different module/level/resource combinations.
3. Submit when all rows are complete.

### Step 3: Verify assignments

- Use the search and **Module** / **Level** filters on the Module Coordinators page.
- Open the person's profile → access section to see their assignments (if visible in UI).

### Module and level reference

| Module | Available levels | Resource-specific? |
|--------|------------------|--------------------|
| Cluster | Coordinator, Senior Coordinator | Yes — select cluster(s) |
| Finance | Coordinator, Senior Coordinator | Module-wide only |
| Evangelism | Coordinator, Senior Coordinator, Bible Sharer | Yes — evangelism group(s) |
| Sunday School | Coordinator, Senior Coordinator, Teacher | Yes — class(es) |
| Lessons | Coordinator, Senior Coordinator, Teacher | Module-wide only |
| Events | Coordinator, Senior Coordinator | Module-wide only |
| Ministries | Coordinator, Senior Coordinator | Module-wide only |

**Level meanings (summary)**

- **Senior Coordinator** — Broad module access (branch-scoped unless HQ); usually module-wide.
- **Coordinator** — Module or resource-scoped leadership (e.g. specific clusters).
- **Teacher** — Sunday School or Lessons instruction access.
- **Bible Sharer** — Evangelism group facilitation access.

### Common examples

**Cluster coordinator for one cluster**

1. Create Assignment → Person → Module: **Cluster** → Level: **Coordinator**.
2. Scope: **Resource-specific** → select the cluster.

**Lessons teacher (module-wide)**

1. Create Assignment → Person → Module: **Lessons** → Level: **Teacher**.
2. Scope: **Module-wide**.

**Person with multiple hats**

1. Use **Bulk assign** or create several **Create Assignment** entries.
2. Example: Cluster Coordinator for Cluster A + Sunday School Teacher for Class 1.

---

## Part 4 — Create another administrator

To onboard a co-admin:

1. **People** → **Add Person**.
2. Set role to **Admin**.
3. Set branch (HQ branch if they need all-branch visibility).
4. Use **Login access** to set a temporary password.
5. Share credentials securely; they change password on first login.

Do **not** share your own admin password.

---

## Quick reference checklist

**New member who needs to log in**

- [ ] People -> Add Person
- [ ] First name, last name, branch, role (Member or higher)
- [ ] Login access → auto-generate or manual password
- [ ] Copy username/password from success dialog
- [ ] User logs in and changes password

**New module coordinator**

- [ ] User exists with login-capable role
- [ ] Admin Settings → Module Coordinators
- [ ] Create Assignment or Bulk assign
- [ ] Confirm module, level, and scope

**Forgotten password**

- [ ] People → profile → Reset password  
  **or** Admin Settings → Password Resets → Approve request

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Cannot see Admin Settings | Your account must be role **Admin** |
| No Login access section | Only **Admin** sees this when creating non-Visitor users |
| User cannot log in | Role must not be Visitor; password must have been set at create or reset |
| Person not in coordinator dropdown | ADMIN accounts are excluded from assignment picker |
| Branch required error | Select a branch before saving |
| Weak password rejected | Min. 8 chars, at least one letter and one number |

---

## Support

For technical issues (server down, migrations, initial bootstrap admin), contact your system developer or refer to `docs/RUNBOOK.md` in the project repository.
