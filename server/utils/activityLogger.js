import ActivityLog from "../models/ActivityLog.js";

export async function logActivity(student, req, action, details = {}) {
  try {
    const user = req?.user || null;
    const userName = user?.name || "System";
    const userRole = user?.designation || user?.role || "System";
    const userId = user?.id || user?._id || null;

    await ActivityLog.create({
      studentId: student._id,
      studentUniqueId: student.id,
      user: userId,
      userName,
      userRole,
      action,
      details,
      timestamp: new Date()
    });
  } catch (err) {
    console.error("[Activity Logger] Failed to log activity:", err);
  }
}
