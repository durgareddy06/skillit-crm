import Role from "../models/Role.js";
import { reconcileRolePermissionRows } from "../utils/permissions.js";
import { ensureDefaultRoles, sortRolesForDisplay } from "../utils/roles.js";

function shapeRole(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    status: doc.status,
    permissions: doc.permissions,
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Admin is the single source of truth here: whatever module rows Admin
// submits for a role are honoured as-is (reconciled only against the real
// module registry, never filtered by the role's name). Every action
// (create/read/update/delete/...) is preserved independently — flipping
// one flag never touches another.
async function normalizeRolePayload(payload = {}) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const description = typeof payload.description === "string" ? payload.description : "";
  const status = payload.status === "Inactive" ? "Inactive" : "Active";
  const permissions = await reconcileRolePermissionRows(
    Array.isArray(payload.permissions) ? payload.permissions : []
  );

  return { name, description, status, permissions };
}

export async function listRoles(req, res) {
  await ensureDefaultRoles();
  const roles = await Role.find().sort({ createdAt: -1 }).lean();
  res.json({ roles: sortRolesForDisplay(roles.map(shapeRole)) });
}

export async function getRole(req, res) {
  const role = await Role.findById(req.params.id).lean();
  if (!role) return res.status(404).json({ message: "Role not found" });
  res.json({ role: shapeRole(role) });
}

export async function createRole(req, res) {
  const payload = await normalizeRolePayload(req.body || {});
  if (!payload.name) return res.status(400).json({ message: "Role name is required" });

  const existing = await Role.findOne({ name: new RegExp(`^${payload.name}$`, "i") });
  if (existing) return res.status(409).json({ message: "A role with this name already exists" });

  const role = await Role.create({
    name: payload.name,
    description: payload.description,
    status: payload.status,
    permissions: payload.permissions,
    createdBy: req.user?.name || "Admin",
    updatedBy: req.user?.name || "Admin",
  });
  res.status(201).json({ role: shapeRole(role) });
}

export async function updateRole(req, res) {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });

  const { name, description, status, permissions } = req.body || {};
  if (name !== undefined) role.name = name;
  if (description !== undefined) role.description = description;
  if (status !== undefined) role.status = status;
  if (Array.isArray(permissions)) {
    role.permissions = await reconcileRolePermissionRows(permissions);
  }
  role.updatedBy = req.user?.name || "Admin";

  await role.save();
  res.json({ role: shapeRole(role) });
}

export async function deleteRole(req, res) {
  const role = await Role.findByIdAndDelete(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });
  res.json({ ok: true });
}
