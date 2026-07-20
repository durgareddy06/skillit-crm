import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true },
    receiver: { type: String, default: "" },
    message: { type: String, required: true },
    attachments: { type: [String], default: [] },
    timestamp: { type: Date, default: Date.now },
    direction: { type: String, enum: ["INBOUND", "OUTBOUND"], required: true },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true }, // e.g. TKT-8291
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    studentName: { type: String, default: "" },
    studentEmail: { type: String, default: "" },
    department: { type: String, default: "" }, // mapping target
    assignedDepartment: { type: String, enum: ["Support", "Tech", "RM", ""], default: "" },
    assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedUserName: { type: String, default: "" },
    subject: { type: String, required: true },
    description: { type: String, default: "" },
    attachments: { type: [String], default: [] },
    conversation: { type: [conversationSchema], default: [] },
    status: { type: String, enum: ["Active", "RESOLVED"], default: "Active" },
    priority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedByName: { type: String, default: "" },
    sourceEmail: { type: String, default: "" },
    destinationEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

// Indexes for query performance and fast routing filtering
ticketSchema.index({ ticketId: 1 });
ticketSchema.index({ studentEmail: 1 });
ticketSchema.index({ assignedDepartment: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ createdAt: -1 });

export default mongoose.model("Ticket", ticketSchema);
