import * as studentService from "../services/studentService.js";
import * as emailService from "../services/emailService.js";
import * as inboxService from "../services/inboxService.js";
import Student from "../models/Student.js";
import { canAccessStudentHelper } from "../utils/authorization.js";

// ==============================================================================
// #1 FORGOT PASSWORD MODULE & AUTHENTICATION CONTROLLERS
// ==============================================================================
export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email address is required." });
    }

    await studentService.requestPasswordReset(email);
    res.json({ success: true, message: "Password reset link has been dispatched to your email." });
  } catch (error) {
    console.error("Error in requestPasswordReset controller:", error.message);
    res.status(400).json({ message: error.message || "Failed to initiate password reset." });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and newPassword are required." });
    }

    await studentService.resetStudentPassword(token, newPassword);
    res.json({ success: true, message: "Your password has been reset successfully." });
  } catch (error) {
    console.error("Error in resetPassword controller:", error.message);
    res.status(400).json({ message: error.message || "Failed to reset password." });
  }
}

// ==============================================================================
// #2 STUDENT MODULE - EMAIL VERIFICATION
// ==============================================================================
export async function verifyEmail(req, res) {
  try {
    const { token } = req.query || req.body || {};
    if (!token) {
      return res.status(400).json({ message: "Verification token is required." });
    }

    await studentService.verifyStudentEmail(token);
    res.json({ success: true, message: "Your email address has been verified successfully." });
  } catch (error) {
    console.error("Error in verifyEmail controller:", error.message);
    res.status(400).json({ message: error.message || "Email verification failed." });
  }
}

// ==============================================================================
// #3 MANUAL EMAIL DISPATCH & GENERAL NOTIFICATIONS
// ==============================================================================
export async function sendManualEmail(req, res) {
  try {
    const { to, subject, message } = req.body || {};
    if (!to || !subject || !message) {
      return res.status(400).json({ message: "to, subject, and message are required." });
    }

    const student = await Student.findOne({ email: to.trim() });
    if (student && !(await canAccessStudentHelper(req.user, student))) {
      return res.status(403).json({ message: "You don't have permission to access this student" });
    }
    
    await emailService.sendEmail({
      to: to.trim(),
      subject: subject.trim(),
      html: `<h3>Notification</h3><p>${message}</p>`,
    });

    res.json({ success: true, message: "Manual email dispatched successfully." });
  } catch (error) {
    console.error("Error in sendManualEmail controller:", error.message);
    res.status(500).json({ message: error.message || "Failed to dispatch manual email." });
  }
}

// ==============================================================================
// #4 INCOMING EMAIL SIMULATION (DEVELOPER / TESTING TOOLS)
// ==============================================================================
export async function simulateReceiveEmail(req, res) {
  try {
    const { senderEmail, recipientEmail, subject, body, attachments } = req.body || {};
    if (!senderEmail || !subject) {
      return res.status(400).json({ message: "senderEmail and subject are required." });
    }

    const result = await inboxService.processIncomingEmail({
      senderEmail,
      recipientEmail,
      subject,
      body,
      attachments
    });

    if (result.ignored) {
      return res.status(400).json({ message: result.reason });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Error simulating email reception:", error.message);
    res.status(500).json({ message: error.message || "Failed to simulate incoming email." });
  }
}
