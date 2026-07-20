import mongoose from "mongoose";

const emailLogSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, default: "" },
    attachments: { type: [String], default: [] },
    status: { type: String, enum: ["SENT", "RECEIVED", "FAILED"], required: true },
    timestamp: { type: Date, default: Date.now },
    error: { type: String, default: null }
  },
  { timestamps: true }
);

emailLogSchema.index({ sender: 1 });
emailLogSchema.index({ receiver: 1 });
emailLogSchema.index({ status: 1 });
emailLogSchema.index({ timestamp: -1 });

export default mongoose.model("EmailLog", emailLogSchema);
