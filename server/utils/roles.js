import Role from "../models/Role.js";

export const DEFAULT_ROLE_NAMES = [
  "Tech",
  "SDE",
  "Manager",
  "Sr.Manager",
  "MIS Executive",
  "Relationship Manager",
  "Customer Support Executive",
];

const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

export function sortRolesForDisplay(roles = []) {
  const order = new Map(DEFAULT_ROLE_NAMES.map((name, index) => [normalize(name), index]));
  return [...(Array.isArray(roles) ? roles : [])].sort((a, b) => {
    const aRank = order.has(normalize(a?.name)) ? order.get(normalize(a.name)) : Number.MAX_SAFE_INTEGER;
    const bRank = order.has(normalize(b?.name)) ? order.get(normalize(b.name)) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

export async function ensureDefaultRoles() {
  const existing = await Role.find({}).select("name").lean();
  const existingNames = new Set(existing.map((role) => normalize(role.name)));
  const now = new Date();

  const getTokensPermission = () => ({
    key: "tokens",
    label: "Tokens",
    parentKey: null,
    basic: { create: true, read: true, update: true, delete: true, details: true },
    administrative: { readAll: false, updateAll: false, deleteAll: false },
    special: { email: true, bulkEmail: false, bulkUpdate: false, bulkDelete: false }
  });

  const missing = DEFAULT_ROLE_NAMES.filter((name) => !existingNames.has(normalize(name))).map((name, index) => {
    const permissions = [];
    const norm = normalize(name);
    if (["tech", "relationshipmanager", "customersupportexecutive"].includes(norm)) {
      permissions.push(getTokensPermission());
    }
    return {
      name,
      description: "",
      status: "Active",
      permissions,
      createdBy: "System",
      updatedBy: "System",
      createdAt: new Date(now.getTime() + index),
      updatedAt: new Date(now.getTime() + index),
    };
  });

  if (missing.length) {
    await Role.insertMany(missing, { ordered: false });
  }

  // Also ensure existing target roles have the tokens permission
  const targetRoles = await Role.find({
    name: { $in: ["Tech", "Relationship Manager", "Customer Support Executive"] }
  });

  for (const role of targetRoles) {
    const hasTokens = role.permissions.some((p) => p.key === "tokens");
    if (!hasTokens) {
      role.permissions.push(getTokensPermission());
      await role.save();
      console.log(`Added default tokens permission to role: ${role.name}`);
    }
  }
}
