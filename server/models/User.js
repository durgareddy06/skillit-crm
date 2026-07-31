import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { normalizePhone } from "../utils/phone.js";

const userSchema = new mongoose.Schema(
  {
    salutation: { type: String, default: "Mr." },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    // System-level access value. Either the reserved literal "admin" (the
    // one hardcoded super-admin, per design — Admin is the single source of
    // truth for every other role) or a mirror of the assigned Role's name
    // (kept for display/back-compat only — see roleId for the real link).
    role: { type: String, required: true, trim: true },
    // The authoritative link to a Role document. This — not any string
    // comparison — is what utils/permissions.js uses to resolve a user's
    // module access. Null for the reserved "admin" super-admin account.
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: "Role", default: null },
    // Free-form designation/title as picked in the admin "Create User"
    // screen. Mirrors the assigned Role's name; also used for a few
    // unrelated hierarchy rules (SDE reporting-manager requirement, etc).
    designation: { type: String, default: "" },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    dateOfJoining: { type: String, default: "" },
    department: { type: String, default: "" },
    appAccess: { type: Boolean, default: false },
    status: { type: String, enum: ["Active", "Inactive", "Archived"], default: "Active" },
    loginAttempts: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.pre("save", function normalizePhoneNumber(next) {
  if (this.isModified("phone")) {
    this.phone = normalizePhone(this.phone);
  }
  next();
});

userSchema.index({ role: 1, status: 1, designation: 1 });
userSchema.index({ roleId: 1, status: 1 });
userSchema.index({ reportingManager: 1, designation: 1 });

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

// Never leak the hash to the client
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    phone: this.phone,
    role: this.role,
    roleId: this.roleId ? this.roleId.toString() : null,
    designation: this.designation,
    reportingManager: this.reportingManager ? this.reportingManager.toString() : null,
  };
};

// Fuller shape used by the admin Users/Teams screens.
userSchema.methods.toAdminObject = function () {
  return {
    id: this._id.toString(),
    salutation: this.salutation,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    roleId: this.roleId ? this.roleId.toString() : null,
    designation: this.designation,
    reportingManager: this.reportingManager,
    dateOfJoining: this.dateOfJoining,
    department: this.department,
    appAccess: this.appAccess,
    status: this.status,
    loginAttempts: this.loginAttempts,
    createdBy: this.createdBy,
    updatedBy: this.updatedBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model("User", userSchema);
