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
    invoiceNumber: String,
    invoiceDate: String,
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
    onboardingVerifications: {
      type: [
        {
          item: { type: String, required: true },
          verified: { type: Boolean, default: false },
          verifiedBy: { type: String, default: "" },
          verifiedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          verifiedAt: { type: Date, default: null },
        }
      ],
      default: []
    },
    callRecordings: {
      type: [
        {
          fileName: { type: String, default: "" },
          url: { type: String, required: true },
          uploadedBy: { type: String, default: "" },
          uploadedAt: { type: Date, default: Date.now },
        }
      ],
      default: []
    },
    orientationDate: { type: String, default: "" },
    orientationLink: { type: String, default: "" },
    recordedLink: { type: String, default: "" },
    internalRemarks: { type: String, default: "" },
    customFields: { type: Object, default: {} },
    dropped: { type: Boolean, default: false },
    droppedAt: { type: String, default: "" },
    orderPunchedAt: { type: String, default: "" },
    enrolledAt: { type: String, default: "" },
    cancelledAt: { type: String, default: "" },
    misApprovedAt: { type: String, default: "" },
    onboardingSubmittedAt: { type: String, default: "" },
    orientationCompletedAt: { type: String, default: "" },

    createdAt: String,
    createdBy: String,
    // Authoritative owner reference used for hierarchy/ownership enforcement.
    // `createdBy` (name string) stays for display/back-compat only — every
    // access-control decision must use this id, never the name.
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reportedTo: String,
    reportedToId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reportingHierarchyIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    teamName: { type: String, default: "" },
    assignmentTimestamp: { type: Date, default: null },
    department: String,

    passwordHash: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    orderPunchedEmailSent: { type: Boolean, default: false },
    misApprovedEmailSent: { type: Boolean, default: false },
    onboardingEmailSent: { type: Boolean, default: false },
    orientationEmailSent: { type: Boolean, default: false },

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

studentSchema.pre("save", async function (next) {
  try {
    const User = mongoose.model("User");
    const Team = mongoose.model("Team");

    // 1. If sdeName is modified, sync creator details & parent team/manager info
    if (this.isModified("sdeName") && this.sdeName) {
      const sdeUser = await User.findOne({ name: this.sdeName, status: "Active" }).lean();
      if (!sdeUser) {
        throw new Error(`Active user with name "${this.sdeName}" not found`);
      }
      this.createdById = sdeUser._id;
      this.createdBy = sdeUser.name;
      this.sdeName = sdeUser.name;

      // Find team of the SDE
      const team = await Team.findOne({ members: sdeUser._id, status: "Active" }).lean();
      if (team) {
        this.teamId = team._id;
        this.teamName = team.name;
      } else {
        this.teamId = null;
        this.teamName = "";
      }

      // Resolve direct manager of SDE
      const mgrId = team?.manager ? team.manager.toString() : null;
      if (mgrId) {
        const mgrUser = await User.findById(mgrId).lean();
        if (mgrUser) {
          this.reportedToId = mgrUser._id;
          this.reportedTo = mgrUser.name;
          this.manager = mgrUser.name;

          // Rebuild reporting hierarchy upwards
          const ancestors = [];
          const visited = new Set();
          let currentId = mgrUser._id.toString();
          visited.add(currentId);
          while (true) {
            const nextTeam = await Team.findOne({ members: currentId, status: "Active" }).lean();
            const nextMgrId = nextTeam?.manager ? nextTeam.manager.toString() : null;
            if (!nextMgrId || visited.has(nextMgrId)) break;
            ancestors.push(new mongoose.Types.ObjectId(nextMgrId));
            visited.add(nextMgrId);
            currentId = nextMgrId;
          }
          this.reportingHierarchyIds = [mgrUser._id, ...ancestors];
        }
      } else {
        this.reportedToId = null;
        this.reportedTo = "";
        this.manager = "";
        this.reportingHierarchyIds = [];
      }
    }

    // 2. If manager/reportedTo is explicitly modified, override the manager & hierarchy
    if ((this.isModified("manager") || this.isModified("reportedTo")) && (this.manager || this.reportedTo)) {
      const mgrName = this.manager || this.reportedTo;
      const mgrUser = await User.findOne({ name: mgrName, status: "Active" }).lean();
      if (!mgrUser) {
        throw new Error(`Active manager user with name "${mgrName}" not found`);
      }
      this.reportedToId = mgrUser._id;
      this.reportedTo = mgrUser.name;
      this.manager = mgrUser.name;

      // Rebuild reporting hierarchy upwards from this manager
      const ancestors = [];
      const visited = new Set();
      let currentId = mgrUser._id.toString();
      visited.add(currentId);
      while (true) {
        const nextTeam = await Team.findOne({ members: currentId, status: "Active" }).lean();
        const nextMgrId = nextTeam?.manager ? nextTeam.manager.toString() : null;
        if (!nextMgrId || visited.has(nextMgrId)) break;
        ancestors.push(new mongoose.Types.ObjectId(nextMgrId));
        visited.add(nextMgrId);
        currentId = nextMgrId;
      }
      this.reportingHierarchyIds = [mgrUser._id, ...ancestors];
    }

    next();
  } catch (err) {
    next(err);
  }
});

studentSchema.index({ createdById: 1, dropped: 1, _id: -1 });
studentSchema.index({ createdBy: 1, dropped: 1, _id: -1 });
studentSchema.index({ status: 1, misStatus: 1, dropped: 1, _id: -1 });
studentSchema.index({ paymentLinkGenerated: 1, dropped: 1, _id: -1 });
studentSchema.index({ paidAmount: 1, dropped: 1, _id: -1 });
studentSchema.index({ orderPunched: 1, status: 1, dropped: 1, _id: -1 });
studentSchema.index({ onboardingSubmitted: 1, orientationCompleted: 1, dropped: 1, _id: -1 });
studentSchema.index({ reportingHierarchyIds: 1 });
studentSchema.index({ customerName: "text", uniqueId: "text", email: "text", contactNumber: "text", altContactNumber: "text", primaryContactName: "text", sdeName: "text", manager: "text", course: "text", program: "text", batch: "text", leadLink: "text" });

export default mongoose.model("Student", studentSchema);
