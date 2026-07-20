import Role from "../models/Role.js";
import Module from "../models/Module.js";

// Fallback seed used ONLY by seed.js the very first time the Module
// collection is empty (so a fresh database boots with the modules the
// product ships today). After that, Admin fully owns this list via
// /api/admin/modules — nothing at runtime reads from this array.
export const DEFAULT_MODULE_SEED = [
  { key: "student", label: "Student", order: 10 },
  { key: "payment-link", label: "Payment Link", order: 20 },
  { key: "payments", label: "Payments", order: 30 },
  { key: "payments.active", label: "Active", parentKey: "payments", order: 31 },
  { key: "payments.archive", label: "Archive", parentKey: "payments", order: 32 },
  { key: "booked-orders", label: "Booked Orders", order: 40 },
  { key: "pending", label: "Pending", order: 50 },
  { key: "enrolled", label: "Enrolled", order: 55 },
  { key: "enrollments", label: "Enrollments", order: 60 },
  { key: "mis-approval", label: "MIS Approval", order: 70 },
  { key: "approved", label: "Approved", order: 80 },
  { key: "cancelled", label: "Cancelled", order: 90 },
  { key: "onboarding", label: "Onboarding", order: 100 },
  { key: "orientation", label: "Orientation", order: 110 },
  { key: "learners", label: "Learners", order: 120 },
  { key: "tokens", label: "Tokens", order: 130 },
  { key: "job-alerts", label: "Job Alerts", order: 140 },
];

const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

function blankRow(mod) {
  return {
    key: mod.key,
    label: mod.label,
    parentKey: mod.parentKey || null,
    basic: { create: false, read: false, update: false, delete: false },
    administrative: { readAll: false, updateAll: false, deleteAll: false },
    special: { email: false, bulkEmail: false, bulkUpdate: false, bulkDelete: false },
  };
}

function fullRow(mod) {
  return {
    key: mod.key,
    label: mod.label,
    parentKey: mod.parentKey || null,
    basic: { create: true, read: true, update: true, delete: true },
    administrative: { readAll: true, updateAll: true, deleteAll: true },
    special: { email: true, bulkEmail: true, bulkUpdate: true, bulkDelete: true },
  };
}

// Every module currently registered in the database, ordered for display.
export async function getAllModules() {
  return Module.find({ status: "Active" }).sort({ order: 1, createdAt: 1 }).lean();
}

// Full-access permission rows for every module — used only for the
// reserved super-admin account, never for a named/custom role.
export async function buildFullAccessPermissions() {
  const modules = await getAllModules();
  return modules.map(fullRow);
}

// Takes whatever permission rows Admin submitted for a role and reconciles
// them against the real module registry:
//  - every active module gets exactly one row (missing ones default to off)
//  - unknown/stale keys (deleted modules) are dropped
//  - each CRUD/administrative/special flag is preserved independently —
//    nothing here ever infers one flag's value from another.
// This intentionally does NOT filter modules by role name/group: Admin is
// free to assign any module to any role.
export async function reconcileRolePermissionRows(submittedRows = []) {
  const modules = await getAllModules();
  const submittedByKey = new Map(
    (Array.isArray(submittedRows) ? submittedRows : []).map((row) => [row.key, row])
  );

  return modules.map((mod) => {
    const existing = submittedByKey.get(mod.key);
    const base = blankRow(mod);
    if (!existing) return base;
    return {
      ...base,
      basic: { ...base.basic, ...(existing.basic || {}) },
      administrative: { ...base.administrative, ...(existing.administrative || {}) },
      special: { ...base.special, ...(existing.special || {}) },
    };
  });
}

export async function resolveEffectivePermissions(user) {
  if (!user) return [];
  if (normalize(user.role) === "admin") return buildFullAccessPermissions();

  // Primary, authoritative path: a hard foreign key to the Role document.
  // No string comparison involved at all, so renames/typos/casing in
  // `designation` or `role` can never desync a user from their role.
  if (user.roleId) {
    const role = await Role.findById(user.roleId).select("name status permissions").lean();
    if (role && role.status === "Active") return role.permissions || [];
    if (role) return []; // role exists but has been deactivated — deny, don't fall back
  }

  // Legacy fallback for any user record created before roleId existed.
  // Safe to keep: it only ever runs when roleId is completely absent.
  const candidates = [user.designation, user.role]
    .filter(Boolean)
    .map((value) => normalize(value));
  if (candidates.length === 0) return [];

  const roles = await Role.find({ status: "Active" }).select("name permissions").lean();
  const match = roles.find((role) => candidates.includes(normalize(role.name)));
  return match?.permissions || [];
}

// -----------------------------------------------------------------------
// Action -> module mapping.
//
// This is the fix for the production bug where a button appears enabled in
// Manage Roles but the API still rejects the request (reported for Punch
// Order, but the same bug class applied to every action that the product
// spec says is reachable from more than one module).
//
// The old code gated e.g. Punch Order behind a single hardcoded module key
// ("booked-orders"/"create"), while Manage Roles (correctly, per product
// spec) lets Admin grant that same action's visibility via Student,
// Payment Link, or Payments' Create toggle. A role could have
// Student -> Create ON and still get 403 on Punch Order because the one
// module the backend actually checked (Booked Orders) was OFF.
//
// Fixing this generically: every action button maps to the list of module
// rows that the product's permission model says can unlock it (OR logic —
// having Create on ANY one of the mapped modules is enough), matching the
// action mapping table in the product spec exactly. No module implicitly
// grants another; this only reflects the *documented* multi-module
// mapping for actions that legitimately live under several modules.
// -----------------------------------------------------------------------
export const ACTION_MODULE_MAP = {
  "create-student": [{ key: "student", action: "create" }],
  "generate-payment-link": [
    { key: "student", action: "create" },
    { key: "payment-link", action: "create" },
    { key: "pending", action: "create" },
  ],
  "add-payment": [
    { key: "student", action: "create" },
    { key: "payment-link", action: "create" },
    { key: "payments", action: "create" },
    { key: "pending", action: "create" },
  ],
  "punch-order": [
    { key: "student", action: "create" },
    { key: "payment-link", action: "create" },
    { key: "payments", action: "create" },
  ],
  "create-booked-order": [{ key: "booked-orders", action: "create" }],
  "enroll-student": [{ key: "pending", action: "create" }],
  "cancel-student": [{ key: "pending", action: "create" }],
  "mis-approve": [{ key: "mis-approval", action: "update" }],
  "mis-escalate": [{ key: "mis-approval", action: "update" }],
  "drop-student": [{ key: "student", action: "delete" }],
  "edit-student": [
    { key: "student", action: "update" },
    { key: "onboarding", action: "update" },
    { key: "orientation", action: "update" },
    { key: "learners", action: "update" },
    { key: "approved", action: "update" },
    { key: "pending", action: "update" },
    { key: "enrolled", action: "update" },
  ],
  "transfer-lead": [{ key: "student", action: "update" }],
};

// OR-across-modules authorization check for an action key from the map
// above. Admin always passes. Every underlying userHasPermission call still
// enforces the independent per-action-group rule (toggling one action never
// implies another) — this only widens *which module row* is allowed to
// satisfy a given action, per the documented mapping.
export async function userHasActionPermission(user, actionKey) {
  if (!user) return false;
  if (normalize(user.role) === "admin") return true;

  const rules = ACTION_MODULE_MAP[actionKey];
  if (!rules || rules.length === 0) return false;

  for (const rule of rules) {
    // eslint-disable-next-line no-await-in-loop
    if (await userHasPermission(user, rule.key, rule.action)) return true;
  }
  return false;
}

// Independent, per-action authorization check. Each action is looked up
// on its own row/group — toggling one action (e.g. create) never reads or
// mutates any other action's value (read/update/delete stay untouched).
export async function userHasPermission(user, moduleKey, action) {
  if (!user || !moduleKey || !action) return false;
  if (normalize(user.role) === "admin") return true;

  const permissions = await resolveEffectivePermissions(user);
  const row = permissions.find((perm) => normalize(perm?.key) === normalize(moduleKey));
  if (!row) return false;

  const groups = {
    basic: ["create", "read", "update", "delete"],
    administrative: ["readAll", "updateAll", "deleteAll"],
    special: ["email", "bulkEmail", "bulkUpdate", "bulkDelete"],
  };
  for (const [group, actions] of Object.entries(groups)) {
    if (!actions.includes(action)) continue;
    return Boolean(row[group]?.[action]);
  }
  return false;
}
