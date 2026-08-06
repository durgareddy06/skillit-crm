import mongoose from "mongoose";

const userTransferHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fromTeamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    fromTeamName: { type: String, default: "" },
    toTeamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    toTeamName: { type: String, default: "" },
    fromManagerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    fromManagerName: { type: String, default: "" },
    toManagerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    toManagerName: { type: String, default: "" },
    transferredBy: { type: String, default: "" },
    transferredById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    transferredAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

userTransferHistorySchema.index({ userId: 1, transferredAt: -1 });

export default mongoose.model("UserTransferHistory", userTransferHistorySchema);
