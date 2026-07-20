import User from "../models/User.js";
import Role from "../models/Role.js";
import { normalizePhone } from "../utils/phone.js";
import { getReportingManagerId } from "../utils/hierarchy.js";

const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

function resolveDefaultPassword(role, password) {
  if (password !== undefined && password !== null && password !== "") return password;
  return normalize(role) === "admin" ? "skillit@123" : "skillit123";
}

// Single source of truth for "which role is this user assigned to": a hard
// foreign key (`roleId` -> Role._id), never a fuzzy string match. The one
// reserved special case is the literal sentinel "admin" (the super-admin
// pseudo-role, which has no Role document — it always has full access).
// This replaces the previous design, which matched `designation` text
// against `Role.name` at permission-resolution time: any rename, typo, or
// casing difference between the two silently broke every permission for
// that user. With a real ObjectId reference that entire bug class is gone.
async function resolveRoleAssignment(roleIdInput) {
  const raw = typeof roleIdInput === "string" ? roleIdInput.trim() : roleIdInput;
  if (!raw) return null;
  if (normalize(raw) === "admin") {
    return { roleId: null, role: "admin", designation: "Admin" };
  }
  const roleDoc = await Role.findById(raw).select("name status").lean();
  if (!roleDoc) return null;
  return { roleId: roleDoc._id, role: roleDoc.name, designation: roleDoc.name };
}

// Reporting relationships live ONLY in Manage Teams now — a user's
// reporting manager is whoever leads the team they've been assigned to as
// a member (see utils/hierarchy.js). Create/Edit User never accepts or
// stores a manually-picked reporting manager; this function is read-only
// shaping for API responses, it never writes anything.
async function withManagerName(doc) {
  const obj = typeof doc.toAdminObject === "function" ? doc.toAdminObject() : { ...doc };
  const reportingManagerId = await getReportingManagerId(obj.id || doc._id);
  obj.reportingManager = reportingManagerId;
  if (reportingManagerId) {
    const mgr = await User.findById(reportingManagerId).select("name").lean();
    obj.reportingManagerName = mgr?.name || "";
  } else {
    obj.reportingManagerName = "";
  }
  return obj;
}

export async function listUsers(req, res) {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .select("salutation name email phone role roleId designation dateOfJoining department appAccess status loginAttempts createdBy updatedBy createdAt updatedAt")
    .lean();

  // Reporting manager for every user is resolved in one pass from Manage
  // Teams data (Team.manager / Team.members) — never from a per-user field.
  const shaped = await Promise.all(
    users.map(async (user) => {
      const reportingManagerId = await getReportingManagerId(user._id);
      let reportingManagerName = "";
      if (reportingManagerId) {
        const mgr = await User.findById(reportingManagerId).select("name").lean();
        reportingManagerName = mgr?.name || "";
      }
      return {
        id: user._id.toString(),
        salutation: user.salutation,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        roleId: user.roleId ? user.roleId.toString() : null,
        designation: user.designation,
        reportingManager: reportingManagerId,
        reportingManagerName,
        dateOfJoining: user.dateOfJoining,
        department: user.department,
        appAccess: user.appAccess,
        status: user.status,
        loginAttempts: user.loginAttempts,
        createdBy: user.createdBy,
        updatedBy: user.updatedBy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    })
  );
  res.json({ users: shaped });
}

export async function createUser(req, res) {
  const {
    salutation, name, email, phone, password, roleId,
    dateOfJoining, department, appAccess,
  } = req.body || {};

  if (!name || !phone || !roleId) {
    return res.status(400).json({ message: "Full name, mobile and role are required" });
  }

  const assignment = await resolveRoleAssignment(roleId);
  if (!assignment) return res.status(400).json({ message: "Selected role could not be found" });

  const normalizedPhone = normalizePhone(phone);
  if (!/^\d{10}$/.test(normalizedPhone)) {
    return res.status(400).json({ message: "Mobile number is invalid" });
  }

  const existing = await User.findOne({ phone: normalizedPhone });
  if (existing) return res.status(409).json({ message: "A user with this mobile number already exists" });

  const passwordHash = await User.hashPassword(resolveDefaultPassword(assignment.role, password));

  // Reporting Manager is intentionally NOT accepted here (even if a caller
  // still sends one) — per product requirement, the only way to establish
  // a reporting relationship is assigning the user to a Team in Manage
  // Teams. The field is left unset and is resolved dynamically wherever a
  // reporting manager is needed (see utils/hierarchy.js).
  const user = await User.create({
    salutation,
    name,
    email,
    phone: normalizedPhone,
    passwordHash,
    role: assignment.role,
    roleId: assignment.roleId,
    designation: assignment.designation,
    reportingManager: null,
    dateOfJoining,
    department,
    appAccess: !!appAccess,
    createdBy: req.user?.name || "Admin",
    updatedBy: req.user?.name || "Admin",
  });

  res.status(201).json({ user: await withManagerName(user) });
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "User not found" });

  let pendingAssignment = null;
  if (req.body.roleId !== undefined) {
    pendingAssignment = await resolveRoleAssignment(req.body.roleId);
    if (!pendingAssignment) return res.status(400).json({ message: "Selected role could not be found" });
  }

  const fields = [
    "salutation", "name", "email", "phone",
    "dateOfJoining", "department", "appAccess", "status",
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      if (f === "phone") {
        const normalizedPhone = normalizePhone(req.body[f]);
        if (!/^\d{10}$/.test(normalizedPhone)) {
          return res.status(400).json({ message: "Mobile number is invalid" });
        }
        const conflict = await User.findOne({ phone: normalizedPhone, _id: { $ne: id } });
        if (conflict) return res.status(409).json({ message: "A user with this mobile number already exists" });
        user[f] = normalizedPhone;
      } else {
        user[f] = req.body[f];
      }
    }
  }

  // Reporting Manager is never written from Edit User either — any change
  // to who a user reports to happens by moving them between teams in
  // Manage Teams, which is the single source of truth.
  if (pendingAssignment) {
    user.role = pendingAssignment.role;
    user.roleId = pendingAssignment.roleId;
    user.designation = pendingAssignment.designation;
  }
  user.updatedBy = req.user?.name || "Admin";

  await user.save();
  res.json({ user: await withManagerName(user) });
}

export async function deleteUser(req, res) {
  const { id } = req.params;
  const user = await User.findByIdAndDelete(id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ ok: true });
}

export async function resetPassword(req, res) {
  const { id } = req.params;
  const { password } = req.body || {};
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.passwordHash = await User.hashPassword(resolveDefaultPassword(user.role, password));
  user.updatedBy = req.user?.name || "Admin";
  await user.save();
  res.json({ ok: true });
}

export async function resetLoginAttempts(req, res) {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.loginAttempts = 0;
  user.updatedBy = req.user?.name || "Admin";
  await user.save();
  res.json({ user: await withManagerName(user) });
}
