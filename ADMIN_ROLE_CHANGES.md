# Admin Role — What Was Added

## Login
- Phone: `9998887766`
- Password: `skillit@123`
- This is now the ONLY seeded account. Every Sales, MIS, Support (and any
  further Admin) user, plus every Team and Role, is created from inside
  the app by the Admin — nothing else is pre-loaded.

## Setup
```
cd server && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

## What's new (Admin only — Sales/MIS/Support screens are untouched)
- **4th system role: `admin`** — sees every module Sales + MIS + Support
  have (Student, Payment Link, Payments, Booked Orders, Pending,
  Enrollments, MIS Approval, Approved, Cancelled, Onboarding, Orientation,
  Learners, Tokens).
- **Settings → Users** — table of every user with search, create/edit
  modal (salutation, role/designation, name, reporting manager, email,
  mobile, date of joining, department, app access), reset password, reset
  login attempts, activate/deactivate, delete.
- **Settings → Manage Teams** — table of teams, create/edit, and an
  Assign Users dual-list screen (move users between Available/Assigned).
- **Settings → Manage Roles** — table of roles, create, and a full
  permission-matrix editor (Basic / Administrative / Special Access per
  module, with Payments expandable into Active/Archive sub-rows).

## Backend additions
- `server/models/Team.js`, `server/models/Role.js` (new)
- `server/models/User.js` — extended (email, designation, reportingManager,
  dateOfJoining, department, appAccess, status, loginAttempts, `admin`
  added to the role enum). Only additive; nothing existing was removed.
- `server/controllers/adminUserController.js`,
  `adminTeamController.js`, `adminRoleController.js` (new)
- `server/routes/admin.js` (new, mounted at `/api/admin`, admin-only via
  existing `requireAuth` + `requireRole("admin")` middleware — untouched)
- `server/seed.js` — now seeds just the 1 Admin row instead of 3 demo
  Sales/MIS/Support logins. Student seed data untouched.
- `server/index.js` — 2-line addition to mount `/api/admin`.

## Frontend additions
- `frontend/src/pages/AdminSettings.jsx` (new) — the Users / Manage Teams
  / Manage Roles workspace, rendered inside the existing Layout/Sidebar
  (no duplicate sidebar).
- `frontend/src/components/admin/*` (new) — UsersTab, TeamsTab, RolesTab,
  UserFormModal, TeamFormModal, AssignUsersPanel, CreateRoleModal,
  RolePermissionsEditor.
- `frontend/src/api/admin.js` (new) — API calls for the above.
- `frontend/src/pages/Settings.jsx` — now branches: `role === "admin"` →
  `<AdminSettings />`; every other role sees the exact original profile
  screen, unchanged.
- `frontend/src/config/menuConfig.js` — added the `admin` menu array and
  its `ROLE_LABEL`. Sales/MIS/Support entries untouched.
- `frontend/src/App.jsx` — one line, so `admin` lands on `/student` like
  Sales/MIS after login.

## One honest caveat
The Manage Roles permission matrix is fully wired (saved to the DB,
toggle-able), but it isn't yet *enforced* — module access in the sidebar
still comes from the fixed `sales/mis/support/admin` system role, not
dynamically from a custom Role's permission grid. Wiring real per-toggle
enforcement is a bigger follow-up if you want it; let me know.

## Dynamic RBAC refactor (Algoreks Skillit CRM)

The previous version of this feature stored the module list and per-role
visibility as **hardcoded arrays keyed by role name** (`sales` / `mis` /
`support` / `admin`). That meant:
- Every module a role could ever see was decided by matching the role's
  *name* against a fixed pattern in code — Admin's actual toggle choices
  in the Role editor were silently overridden on save.
- `User.role` was a fixed 4-value enum, so no truly new/custom role could
  ever be assigned to a user without a code change.
- Several pages (`StudentPunchOrderPage`, `StudentFeeEditPage`, the
  sidebar, the home-page redirect) gated access by literally checking
  `user.role === "mis"`, ignoring whatever Admin had actually configured.
- Buttons in Student pages fell back to **allow-by-default** for any role
  that had no explicit permission row, so a custom role could see enabled
  Create/Edit/Delete buttons that always failed with a 403 on click.
- The `GET /api/students` list/detail/summary routes had **no read-permission
  check at all** — any authenticated user could view all student records
  regardless of what Admin had assigned them.

What changed:
- New **`Module`** collection (`server/models/Module.js`) is now the single
  source of truth for "what modules exist." Manage it via
  `GET/POST/PATCH/DELETE /api/admin/modules`. A fresh database is seeded
  once from `DEFAULT_MODULE_SEED` in `server/utils/permissions.js`; after
  that, everything is DB-driven.
- Role permission rows are reconciled against the live `Module` list —
  Admin's choices are saved exactly as submitted, independent of the
  role's name (`server/utils/permissions.js` → `reconcileRolePermissionRows`,
  used by `adminRoleController.js`).
- `User.role` no longer has a fixed enum. It's derived server-side from
  `designation` (`deriveSystemRole` in `adminUserController.js`): the
  literal `"admin"` is the one reserved super-admin value; every other
  role is exactly the name Admin gave it when creating the Role.
- The frontend "Role" dropdown (`UserFormModal.jsx`) and the "Create Role"
  name suggestions (`CreateRoleModal.jsx`) now fetch real role names from
  `/api/admin/roles` instead of a hardcoded preset list.
- The sidebar (`Sidebar.jsx`) and the post-login redirect (`App.jsx`) now
  derive the visible module list purely from the logged-in user's
  (database-driven) `read` permissions via a flat `MODULE_NAV` registry
  (`config/menuConfig.js`) — no more per-role hardcoded menu groups.
- `StudentPunchOrderPage.jsx` / `StudentFeeEditPage.jsx` now gate on the
  actual relevant permission (`enrollments`/`update`, `booked-orders`/
  `create`, `payments`/`update`) instead of a hardcoded `role === "mis"`
  check.
- Student list/detail/summary routes now require the `student`/`read`
  permission, matching every other action.
- Frontend Create/Edit/Delete button gating (`StudentListPage.jsx`,
  `StudentDetail.jsx`, `StudentCreatePage.jsx`) no longer has an
  allow-by-default fallback — a module a role wasn't assigned is denied,
  not silently allowed.
- Every CRUD flag (`create`/`read`/`update`/`delete`, plus the
  administrative/special toggles) is read and written independently, both
  in the backend engine and the Role editor — turning one off never
  changes another.

### Small, unavoidable UI-text changes
The UI layout/components/styling are untouched, but two lines of *text*
that only existed to describe the removed hardcoded logic were reworded
(same position/classes, new copy since the old copy was no longer true):
- Role editor: "Visible access group: {sales/mis/support/admin}" →
  "Modules assigned: {n} of {m}".
- The two Student pages above: "MIS access is read-only…" →
  a generic "You don't have permission to…" message.

### Known pre-existing limitation (unchanged)
The "Administrative" (Read All/Update All/Delete All) and "Special Access"
(Email/Bulk Email/Bulk Update/Bulk Delete) toggles are stored and
reconciled like every other flag, but — as in the original codebase — no
controller or page currently reads them to gate any action. Wiring real
behaviour to those toggles would touch page logic beyond the scope of
this permission-engine fix.

## Round 2 — root cause of "toggled ON but nothing reflects" (all modules)

### The bug, precisely
Reported symptom: Admin enables Basic (Create/Read/Update/Delete) toggles
for a role (e.g. "SDE") in the Role editor and saves — but the affected
user still can't create payment links, punch orders, etc. in the Student
module, and the same happens across every other module too (not one
specific mapping).

### Root cause
Permission resolution (`server/utils/permissions.js` →
`resolveEffectivePermissions`) previously found "which Role does this user
have" by **string-matching** `user.designation` (or `user.role`) against
every `Role.name` in the database, case/space-normalized. This is a classic
fragile join:
- If Admin ever renamed a Role after users were assigned to it, every one
  of those users silently lost all permissions (no row matched → empty
  permissions array → every `hasPermission` check on every module returns
  `false`). This explains why the symptom hit **all modules at once**
  rather than one — the user simply had zero matched permission rows, so
  literally nothing was ever granted regardless of what Admin toggled.
- The "Role" field in the Create/Edit User screen stored a free-text
  designation string, so a typo, extra space, or a role name that got
  edited later would desync a user from their role with no error, no
  warning, and no way to see it from the UI.
- Re-login didn't help, because the token/session was never the problem —
  the *lookup itself* had nothing to match.

### The fix — a real foreign key, not a string comparison
- `User` now has an authoritative `roleId` (ObjectId → `Role._id`). This is
  the single source of truth for a user's module access, end to end:
  **DB** (`User.roleId` → `Role._id`) → **API** (`/admin/users` accepts/
  returns `roleId`) → **JWT** (`roleId` is now part of the signed token
  payload) → **backend authorization** (`resolveEffectivePermissions` does
  `Role.findById(user.roleId)` directly — no name matching) → **login/me
  response** (`user.permissions`) → **frontend context** (`AuthContext`) →
  **route guards / sidebar** (`hasPermission`) → **components** (buttons,
  row menus) — one FK, no place in the chain re-derives it from text.
- The "Role" dropdown in the Create/Edit User screen (`UserFormModal.jsx`)
  now stores and submits the Role's real `_id` (or the reserved `"admin"`
  literal) as its value — visually identical dropdown, but it can no
  longer drift out of sync with the Role document, ever. Renaming a role
  in Manage Roles no longer affects any already-assigned user.
- `server/seed.js` now runs an idempotent backfill on every `npm run seed`:
  it finds any user still missing `roleId` (i.e. created under the old
  system) and links them to the Role whose name matches their designation,
  and prints exactly which users could **not** be matched — surfacing
  the previously-silent mismatch instead of hiding it.
- Legacy name-matching is kept only as a last-resort fallback for a user
  that somehow still has no `roleId` after the backfill — new
  creates/edits never rely on it.

### Verified
- `npx vite build` succeeds (1659 modules, no errors).
- `node --check` passes on every changed backend file.
- Manually traced every `canUsePermission`/`hasPermission` call site in
  `StudentDetail.jsx`, `StudentListPage.jsx`, `StudentCreatePage.jsx`,
  `StudentPunchOrderPage.jsx`, `StudentFeeEditPage.jsx`, `Sidebar.jsx`, and
  `App.jsx` against the actual module keys in `DEFAULT_MODULE_SEED` /
  `MODULE_NAV` — all keys match exactly (`student`, `payment-link`,
  `payments`, `booked-orders`, `enrollments`, `cancelled`, `mis-approval`),
  and every button/row-menu item in a given module reads the *same*
  computed `canX` variable, so there's no divergence between what a table
  row menu allows and what its corresponding button allows.

### What to do with existing data
Run `cd server && npm run seed` once after deploying this — it will not
touch students/roles/permissions, it only backfills the new `roleId` field
on users and reports any it couldn't match (those need their Role
re-selected once from Settings → Users, since their old designation no
longer maps to any existing Role).
