import mongoose from "mongoose";
import Student from "../models/Student.js";
import Ticket from "../models/Ticket.js";
import EmailLog from "../models/EmailLog.js";
import * as emailService from "../services/emailService.js";
import * as studentService from "../services/studentService.js";
import * as inboxService from "../services/inboxService.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/skillit-fbcrm";

async function runVerification() {
  console.log("=== STARTING NATIVE EMAIL & TICKET INTEGRATION VERIFICATION ===");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("[✔] Connected to MongoDB.");

    // Clean up test data if any
    const testEmail = "test.learner@skillit.com";
    await Student.deleteMany({ email: testEmail });
    await Ticket.deleteMany({ studentEmail: testEmail });
    await EmailLog.deleteMany({ receiver: testEmail });
    await EmailLog.deleteMany({ sender: testEmail });

    // 1. Create Test Student
    const student = await Student.create({
      id: `STU-TEST-${Date.now().toString().slice(-4)}`,
      customerName: "Alex Mercer",
      altContactNumber: "9876543210",
      contactNumber: "9876543210",
      email: testEmail,
      course: "Data Science & AI",
      status: "Active",
      paidAmount: 10000,
      saleValue: 15000,
      outstanding: 5000,
    });
    console.log(`[✔] Test Student Created: ${student.customerName} (${student.id})`);

    // 2. Test Welcome Email
    console.log("\n--- Testing Student Welcome Email ---");
    await emailService.sendWelcomeEmail(student, "TempPass123!");
    const welcomeLog = await EmailLog.findOne({ receiver: testEmail, subject: { $regex: /Welcome/i } });
    if (!welcomeLog) throw new Error("Welcome email was not logged in EmailLog DB!");
    console.log(`[✔] Welcome email sent and logged! Status: ${welcomeLog.status}`);

    // 3. Test Password Reset Flow
    console.log("\n--- Testing Password Reset Flow ---");
    await studentService.requestPasswordReset(testEmail);
    const updatedStudent = await Student.findOne({ email: testEmail });
    if (!updatedStudent.resetPasswordToken || !updatedStudent.resetPasswordExpires) {
      throw new Error("Password reset token was not saved on Student document!");
    }
    console.log(`[✔] Reset token generated: ${updatedStudent.resetPasswordToken.substring(0, 10)}...`);

    const resetLog = await EmailLog.findOne({ receiver: testEmail, subject: { $regex: /Password Reset/i } });
    if (!resetLog) throw new Error("Password Reset email was not logged in EmailLog DB!");
    console.log(`[✔] Password Reset email logged! Status: ${resetLog.status}`);

    // Complete reset
    const newPassword = "BrandNewSecurePassword123!";
    await studentService.resetStudentPassword(updatedStudent.resetPasswordToken, newPassword);
    const finalStudent = await Student.findOne({ email: testEmail });
    if (!finalStudent.passwordHash || finalStudent.resetPasswordToken !== null) {
      throw new Error("Student password reset failed to clear token or update hash!");
    }
    console.log("[✔] Password successfully updated and reset token invalidated!");

    // 4. Test Payment Confirmation & PDF Generation
    console.log("\n--- Testing Payment Confirmation & Invoice PDF Attachment ---");
    const txnId = `pay_${Date.now()}`;
    await emailService.sendPaymentSuccessEmail(student, txnId, 5000, "20/07/2026", "Data Science & AI");
    const paymentLog = await EmailLog.findOne({ receiver: testEmail, subject: { $regex: /Payment Successful/i } });
    if (!paymentLog) throw new Error("Payment Success email was not logged in EmailLog DB!");
    if (!paymentLog.attachments || paymentLog.attachments.length === 0) {
      throw new Error("PDF Invoice attachment was missing in Payment Success Email Log!");
    }
    console.log(`[✔] Payment Success Email sent with PDF Attachment (${paymentLog.attachments[0]})!`);

    // 5. Test Refund Confirmation Email
    console.log("\n--- Testing Refund Email ---");
    await emailService.sendRefundEmail(student, txnId, 5000, "20/07/2026");
    const refundLog = await EmailLog.findOne({ receiver: testEmail, subject: { $regex: /Refund Processed/i } });
    if (!refundLog) throw new Error("Refund email was not logged in EmailLog DB!");
    console.log(`[✔] Refund Email sent and logged! Status: ${refundLog.status}`);

    // 6. Test Incoming Email & Auto Department Routing (Tech Department)
    console.log("\n--- Testing Inbound Email & Auto Department Routing (Tech) ---");
    const techEmailResult = await inboxService.processIncomingEmail({
      senderEmail: testEmail,
      recipientEmail: "tech@skillit.com",
      subject: "Jupyter Notebook Kernel Issue",
      body: "My Jupyter environment keeps timing out during training.",
    });

    if (!techEmailResult.success || techEmailResult.type !== "new") {
      throw new Error("Failed to process inbound tech email!");
    }
    const createdTechTicket = techEmailResult.ticket;
    if (createdTechTicket.assignedDepartment !== "Tech") {
      throw new Error(`Department routing failed! Expected "Tech", got "${createdTechTicket.assignedDepartment}"`);
    }
    console.log(`[✔] Inbound tech email auto-routed to Tech Department! Ticket ID: ${createdTechTicket.ticketId}`);

    // Check received email log
    const inboundLog = await EmailLog.findOne({ sender: testEmail, status: "RECEIVED" });
    if (!inboundLog) throw new Error("Inbound received email was not logged in EmailLog DB!");
    console.log(`[✔] Inbound email logged in EmailLog DB with RECEIVED status.`);

    // 7. Test CRM Reply to Student
    console.log("\n--- Testing Support Reply to Ticket ---");
    const replyText = "We have allocated more GPU RAM to your Jupyter environment. Please restart.";
    await emailService.sendSupportReplyEmail(createdTechTicket, replyText);
    const replyLog = await EmailLog.findOne({ receiver: testEmail, subject: { $regex: /Re: Jupyter/i } });
    if (!replyLog) throw new Error("Support Reply email was not logged in EmailLog DB!");
    console.log(`[✔] Support Reply email sent and logged!`);

    // 8. Test Student Thread Reply Matching
    console.log("\n--- Testing Student Reply Thread Syncing ---");
    const threadReplyResult = await inboxService.processIncomingEmail({
      senderEmail: testEmail,
      recipientEmail: "tech@skillit.com",
      subject: `Re: Jupyter Notebook Kernel Issue [${createdTechTicket.ticketId}]`,
      body: "Working perfectly now, thank you so much!",
    });

    if (!threadReplyResult.success || threadReplyResult.type !== "reply") {
      throw new Error("Thread reply failed to match existing ticket!");
    }
    const updatedTicket = await Ticket.findOne({ ticketId: createdTechTicket.ticketId });
    if (updatedTicket.conversation.length < 2) {
      throw new Error("Conversation thread was not appended to ticket!");
    }
    console.log(`[✔] Student reply matched ticket ${updatedTicket.ticketId}. Total conversation messages: ${updatedTicket.conversation.length}`);

    // 9. Test Ticket Resolution
    console.log("\n--- Testing Ticket Resolution ---");
    updatedTicket.status = "RESOLVED";
    updatedTicket.resolvedAt = new Date();
    updatedTicket.resolvedByName = "Tech Support Team";
    await updatedTicket.save();

    await emailService.sendTicketResolvedEmail(updatedTicket);
    const resolveLog = await EmailLog.findOne({ receiver: testEmail, subject: { $regex: /Resolved/i } });
    if (!resolveLog) throw new Error("Ticket Resolution email was not logged in EmailLog DB!");
    console.log(`[✔] Ticket Resolution Email sent and logged! Status: ${resolveLog.status}`);

    console.log("\n=======================================================");
    console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
    console.log("=======================================================\n");

  } catch (error) {
    console.error("\n[❌ VERIFICATION FAILED]:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runVerification();
