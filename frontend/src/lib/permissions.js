const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

const actionGroups = {
  basic: ["create", "read", "update", "delete", "details"],
  administrative: ["readAll", "updateAll", "deleteAll"],
  special: ["email", "bulkEmail", "bulkUpdate", "bulkDelete"],
};

function fullAccessRow(key) {
  return {
    key,
    basic: { create: true, read: true, update: true, delete: true, details: true },
    administrative: { readAll: true, updateAll: true, deleteAll: true },
    special: { email: true, bulkEmail: true, bulkUpdate: true, bulkDelete: true },
  };
}

export function getPermissionRow(user, moduleKey) {
  if (!user || !moduleKey) return null;
  if (user.role === "admin") return fullAccessRow(moduleKey);

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const target = permissions.find((row) => normalize(row?.key) === normalize(moduleKey));
  return target || null;
}

export function hasPermission(user, moduleKey, action) {
  if (!user || !moduleKey || !action) return false;
  if (user.role === "admin") return true;

  const row = getPermissionRow(user, moduleKey);
  if (!row) return false;

  // Let administrative permissions imply their basic counterparts —
  // matches the server's userHasPermission logic exactly.
  if (action === "read" && row.administrative?.readAll) return true;
  if (action === "update" && row.administrative?.updateAll) return true;
  if (action === "delete" && row.administrative?.deleteAll) return true;

  for (const [group, actions] of Object.entries(actionGroups)) {
    if (!actions.includes(action)) continue;
    return Boolean(row[group]?.[action]);
  }

  return false;
}


export function canUsePermission(user, moduleKey, action, fallback) {
  const row = getPermissionRow(user, moduleKey);
  if (row) return hasPermission(user, moduleKey, action);
  if (typeof fallback === "function") return Boolean(fallback(user));
  return Boolean(fallback);
}

export function hasAnyPermission(user, moduleKey, actions = []) {
  return actions.some((action) => hasPermission(user, moduleKey, action));
}

// Mirrors server/utils/permissions.js ACTION_MODULE_MAP exactly. Some
// action buttons (Generate Payment Link, Add Payment, Punch Order) are
// documented as reachable from more than one module's Create toggle — this
// keeps the frontend's enable/disable state in sync with what the backend
// will actually accept, so a permission granted via Student/Create doesn't
// show as disabled here while the API would accept it (or vice versa).
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
  "mis-approve": [{ key: "mis-approval", action: "create" }],
  "mis-escalate": [{ key: "mis-approval", action: "create" }],
  "drop-student": [{ key: "student", action: "delete" }],
  "edit-student": [{ key: "student", action: "update" }],
  "transfer-lead": [{ key: "student", action: "update" }],
};

export function hasActionPermission(user, actionKey, context) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const rules = ACTION_MODULE_MAP[actionKey];
  if (!rules || rules.length === 0) return false;

  if (context) {
    const specificRule = rules.find((r) => r.key === context);
    if (specificRule) {
      return hasPermission(user, specificRule.key, specificRule.action);
    }
    const studentRule = rules.find((r) => r.key === "student");
    if (studentRule) {
      return hasPermission(user, studentRule.key, studentRule.action);
    }
  }

  return rules.some((rule) => hasPermission(user, rule.key, rule.action));
}

export function isReadOnlyRole(user, fallback = false) {
  if (!user) return fallback;
  if (user.role === "admin") return false;
  return fallback;
}

