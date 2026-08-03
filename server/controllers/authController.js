import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { normalizePhone } from "../utils/phone.js";
import { resolveEffectivePermissions } from "../utils/permissions.js";
import { getReportingManagerId } from "../utils/hierarchy.js";

// The JWT only ever needs to prove identity (id). Every authorization-
// relevant claim (role, roleId, designation, reporting line) is re-read
// from the database on every request via middleware/auth.js's requireAuth,
// so nothing here can go stale between logins.
function signToken(user) {
  const jwtSecret = process.env.JWT_SECRET || "dev-secret-key";
  return jwt.sign(
    { id: user._id.toString() },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function shapeAuthUser(user) {
  // Reporting manager is derived live from Manage Teams — never from a
  // manually-assigned field on the user record.
  const reportingManagerId = await getReportingManagerId(user._id);
  let reportingManagerName = "";
  if (reportingManagerId) {
    const mgr = await User.findById(reportingManagerId).select("name");
    reportingManagerName = mgr?.name || "";
  }

  return {
    ...user.toSafeObject(),
    designation: user.designation || "",
    reportingManager: reportingManagerId,
    reportingManagerName,
    permissions: await resolveEffectivePermissions(user),
  };
}

export async function login(req, res) {
  const { phone, password } = req.body || {};
  if (!phone || !password) {
    return res.status(400).json({ message: "Phone and password are required" });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!/^\d{10}$/.test(normalizedPhone)) {
    return res.status(400).json({ message: "Phone number is invalid" });
  }

  const user = await User.findOne({ phone: normalizedPhone });
  if (!user) return res.status(401).json({ message: "No account found for this number" });
  if (user.status !== "Active" && user.role !== "admin") {
    return res.status(403).json({ message: "Your account has been disabled. Please contact your administrator." });
  }

  const valid = await user.comparePassword(password);
  if (!valid) return res.status(401).json({ message: "Incorrect password" });

  const token = signToken(user);
  res.json({ token, user: await shapeAuthUser(user) });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user: await shapeAuthUser(user) });
}
