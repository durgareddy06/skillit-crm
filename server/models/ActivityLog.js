import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    studentUniqueId: { type: String, required: true }, // e.g. STU-0001
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, required: true },
    userRole: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

activityLogSchema.index({ studentId: 1, timestamp: -1 });
activityLogSchema.index({ studentUniqueId: 1, timestamp: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);
