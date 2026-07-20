import crypto from "crypto";
import bcrypt from "bcryptjs";
import Student from "../models/Student.js";
import * as emailService from "./emailService.js";

// ==============================================================================
// #1 FORGOT PASSWORD MODULE (REQUEST TOKEN & RESET PASSWORD)
// ==============================================================================
export async function requestPasswordReset(email) {
  const student = await Student.findOne({ email: email.trim() });
  if (!student) {
    throw new Error("No student account found with this email address.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  student.resetPasswordToken = token;
  student.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration
  await student.save();

  await emailService.sendPasswordResetEmail(student, token);
  return true;
}

export async function resetStudentPassword(token, newPassword) {
  if (!token) throw new Error("Reset token is required.");
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const student = await Student.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!student) {
    throw new Error("Password reset token is invalid or has expired.");
  }

  const salt = await bcrypt.genSalt(10);
  student.passwordHash = await bcrypt.hash(newPassword, salt);
  student.resetPasswordToken = null;
  student.resetPasswordExpires = null;
  await student.save();

  return student;
}

// ==============================================================================
// #2 STUDENT MODULE (EMAIL VERIFICATION)
// ==============================================================================
export async function sendEmailVerification(student) {
  const token = crypto.randomBytes(32).toString("hex");
  student.verificationToken = token;
  await student.save();

  await emailService.sendEmailVerificationEmail(student, token);
  return true;
}

export async function verifyStudentEmail(token) {
  if (!token) throw new Error("Verification token is required.");

  const student = await Student.findOne({ verificationToken: token });
  if (!student) {
    throw new Error("Verification token is invalid.");
  }

  student.isVerified = true;
  student.verificationToken = null;
  await student.save();

  return student;
}
