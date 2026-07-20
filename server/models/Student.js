import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paidDate: String,
    amount: Number,
    product: String,
    mode: String,
    refId: String,
    statementId: String,
    settlementDate: String,
  },
  { _id: false }
);

const paymentLinkSchema = new mongoose.Schema(
  {
    linkId: String,
    amount: Number,
    status: String,
    url: String,
    createdAt: String,
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g. STU-0007 — what the frontend routes on

    customerName: { type: String, required: true },
    primaryContactName: String,
    contactNumber: String,
    altContactNumber: String,
    email: String,
    category: { type: String, default: "Fresher" },

    program: String,
    course: String,
    batch: String,
    quarter: { type: Number, default: 1 },
    month: String,
    cycle: { type: Number, default: 1 },
    date: String,
    academicYear: { type: String, default: "2025-2026" },
    uniqueId: String,
    graduatedBranch: String,
    graduationYear: String,

    sdeName: String,
    manager: String,
    demoDoneBy: String,
    salesType: String,
    leadSource: String,
    leadLink: String,
    officeVisit: String,

    saleValue: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    paymentMode: String,

    paymentLinkGenerated: { type: Boolean, default: false },
    paymentLinkAmount: { type: Number, default: 0 },
    paymentLinkStatus: { type: String, default: "Not Generated" },
    paymentLinkUrl: { type: String, default: "" },
    paymentLinks: { type: [paymentLinkSchema], default: [] },
    payments: { type: [paymentSchema], default: [] },

    orderPunched: { type: Boolean, default: false },
    status: { type: String, default: "Active" }, // Active | Pending | Enrolled | Cancelled | Dropped
    misStatus: { type: String, default: null }, // null | 'approved'
    onboardingSubmitted: { type: Boolean, default: false },
    orientationCompleted: { type: Boolean, default: false },
    onboardingComments: { type: String, default: "" },
    onboardingDate: { type: String, default: "" },
    orientationDate: { type: String, default: "" },
    orientationLink: { type: String, default: "" },
    recordedLink: { type: String, default: "" },
    internalRemarks: { type: String, default: "" },
    dropped: { type: Boolean, default: false },

    createdAt: String,
    createdBy: String,
    // Authoritative owner reference used for hierarchy/ownership enforcement.
    // `createdBy` (name string) stays for display/back-compat only — every
    // access-control decision must use this id, never the name.
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reportedTo: String,
    department: String,

    passwordHash: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // Lead-transfer audit trail (append-only, backend-populated only).
    transferHistory: {
      type: [
        {
          fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          transferredAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      _id: false,
    },
  },
  { timestamps: { createdAt: false, updatedAt: "updatedAt" } }
);

studentSchema.index({ createdById: 1, dropped: 1, _id: -1 });
studentSchema.index({ createdBy: 1, dropped: 1, _id: -1 });
studentSchema.index({ status: 1, misStatus: 1, dropped: 1, _id: -1 });
studentSchema.index({ paymentLinkGenerated: 1, dropped: 1, _id: -1 });
studentSchema.index({ paidAmount: 1, dropped: 1, _id: -1 });
studentSchema.index({ orderPunched: 1, status: 1, dropped: 1, _id: -1 });
studentSchema.index({ onboardingSubmitted: 1, orientationCompleted: 1, dropped: 1, _id: -1 });
studentSchema.index({ customerName: "text", uniqueId: "text", email: "text", contactNumber: "text", altContactNumber: "text", primaryContactName: "text", sdeName: "text", manager: "text", course: "text", program: "text", batch: "text", leadLink: "text" });

export default mongoose.model("Student", studentSchema);
