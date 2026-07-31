// Admin is the single source of truth for which modules a role can see —
// there is no hardcoded mapping from a role's name to a fixed module list
// here anymore. `modules` (the real registry, fetched from
// /api/admin/modules) is the only thing that decides what rows exist;
// whatever CRUD flags Admin already saved for a role are preserved as-is.

function blankRow(mod) {
  return {
    key: mod.key,
    label: mod.label,
    parentKey: mod.parentKey || null,
    basic: { create: false, read: false, update: false, delete: false, details: false },
    administrative: { readAll: false, updateAll: false, deleteAll: false },
    special: { email: false, bulkEmail: false, bulkUpdate: false, bulkDelete: false },
  };
}

// Build one row per registered module, merging in whatever the role
// already has saved. Every action stays independent — nothing here ever
// derives one flag's value from another.
export function buildRolePermissionRows(modules = [], rows = []) {
  const current = new Map((Array.isArray(rows) ? rows : []).map((row) => [row.key, row]));
  return (Array.isArray(modules) ? modules : [])
    .filter((mod) => mod.status !== "Inactive")
    .map((mod) => {
      const existing = current.get(mod.key);
      const base = blankRow(mod);
      if (!existing) return base;
      return {
        ...base,
        ...existing,
        key: mod.key,
        label: mod.label,
        parentKey: mod.parentKey || null,
        basic: { ...base.basic, ...(existing.basic || {}) },
        administrative: { ...base.administrative, ...(existing.administrative || {}) },
        special: { ...base.special, ...(existing.special || {}) },
      };
    });
}
