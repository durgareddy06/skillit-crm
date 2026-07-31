import mongoose from "mongoose";

// One row per module (and sub-module, e.g. Payments > Active / Archive).
// `key` must be unique inside a role's permissions array.
const permissionRowSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    parentKey: { type: String, default: null }, // set for sub-rows like Payments > Active
    basic: {
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      details: { type: Boolean, default: false },
    },
    administrative: {
      readAll: { type: Boolean, default: false },
      updateAll: { type: Boolean, default: false },
      deleteAll: { type: Boolean, default: false },
    },
    special: {
      email: { type: Boolean, default: false },
      bulkEmail: { type: Boolean, default: false },
      bulkUpdate: { type: Boolean, default: false },
      bulkDelete: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, default: null, sparse: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    permissions: { type: [permissionRowSchema], default: [] },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Role", roleSchema);
