import Role from "../models/Role.js";
import User from "../models/User.js";
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

  const roleIds = roles.map((r) => r._id);
  const counts = await User.aggregate([
    { $match: { roleId: { $in: roleIds }, status: { $ne: "Archived" } } },
    { $group: { _id: "$roleId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const shaped = roles.map((role) => {
    const obj = shapeRole(role);
    obj.userCount = countMap.get(role._id.toString()) || 0;
    return obj;
  });

  res.json({ roles: sortRolesForDisplay(shaped) });
}

export async function getRole(req, res) {
  const role = await Role.findById(req.params.id).lean();
  if (!role) return res.status(404).json({ message: "Role not found" });
  const userCount = await User.countDocuments({ roleId: role._id, status: { $ne: "Archived" } });
  const obj = shapeRole(role);
  obj.userCount = userCount;
  res.json({ role: obj });
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
  const userCount = await User.countDocuments({ roleId: req.params.id, status: { $ne: "Archived" } });
  if (userCount > 0) {
    return res.status(400).json({
      message: "This role cannot be deleted because users are still assigned to it.",
    });
  }

  const role = await Role.findByIdAndDelete(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });
  res.json({ ok: true });
}

export async function transferRoleUsers(req, res) {
  const { id } = req.params;
  const { toRoleId } = req.body || {};

  const fromRole = await Role.findById(id);
  if (!fromRole) return res.status(404).json({ message: "Source role not found" });

  const toRole = await Role.findById(toRoleId);
  if (!toRole) return res.status(404).json({ message: "Destination role not found" });

  if (String(id) === String(toRoleId)) {
    return res.status(400).json({ message: "Source and destination roles must be different" });
  }

  const users = await User.find({ roleId: id });
  if (users.length > 0) {
    await User.updateMany(
      { roleId: id },
      { $set: { roleId: toRole._id, role: toRole.name } }
    );
  }

  res.json({ ok: true, message: `Successfully transferred ${users.length} user(s)` });
}
