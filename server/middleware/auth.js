import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Step 1 + 2 of the required chain: verify the JWT, then ALWAYS reload the
// user from the database. The JWT is only ever used to prove identity
// (its `id` claim) — every authorization-relevant field (role, roleId,
// designation, status) is re-read from Mongo on every request. This is
// what makes it impossible for a permission/role/team change made in
// Manage Roles or Manage Teams to be masked by a stale 7-day-old token:
// the very next request picks up the change, no re-login required.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: "No token provided" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-key");
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  if (!payload?.id) return res.status(401).json({ message: "Invalid or expired token" });

  try {
    const user = await User.findById(payload.id)
      .select("name phone role roleId designation status")
      .lean();

    if (!user) return res.status(401).json({ message: "Account no longer exists" });
    if (user.status !== "Active" && user.role !== "admin") {
      return res.status(403).json({ message: "Your account has been disabled. Please contact your administrator." });
    }

    // req.user is now always the LATEST row from the database, never the
    // token snapshot. Controllers/middleware downstream must treat this as
    // the single source of truth for who the caller is.
    req.user = {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      role: user.role,
      roleId: user.roleId ? user.roleId.toString() : null,
      designation: user.designation || "",
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to do that" });
    }
    next();
  };
}
