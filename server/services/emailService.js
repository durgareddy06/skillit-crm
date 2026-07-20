import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import EmailLog from "../models/EmailLog.js";
import * as templates from "./templateService.js";

// ==============================================================================
// #1 TRANSPORTER & SMTP CONFIGURATION
// ==============================================================================
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT) || 587;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;

  if (host && user && pass) {
    console.log(`[Email Service] Initializing SMTP transport with host: ${host}:${port}`);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  } else {
    console.warn("[Email Service] SMTP configuration missing. Falling back to Console / Logger mode.");
  }
  return transporter;
};

// ==============================================================================
// #2 NATIVE PDF INVOICE & RECEIPT GENERATOR
// ==============================================================================
export function generateInvoicePDF({ studentName, studentId, email, transactionId, amount, date }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on("data", chunk => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", err => reject(err));

      doc.rect(0, 0, 612, 100).fill("#4f46e5");
      doc.fillColor("#ffffff").fontSize(26).text("SkillIT Academy", 50, 35, { bold: true });
      doc.fontSize(10).text("OFFICIAL INVOICE & RECEIPT", 400, 48, { align: "right" });

      doc.fillColor("#1e293b").fontSize(12).text(`Invoice No: INV-${transactionId.substring(0, 8).toUpperCase()}`, 50, 130);
      doc.text(`Date: ${date}`, 50, 145);
      doc.text(`Transaction ID: ${transactionId}`, 50, 160);

      doc.text(`Student Name: ${studentName}`, 320, 130);
      doc.text(`Email: ${email}`, 320, 145);
      doc.text(`Student Portal ID: ${studentId}`, 320, 160);

      doc.moveTo(50, 190).lineTo(562, 190).stroke("#e2e8f0");

      doc.rect(50, 210, 512, 24).fill("#f1f5f9");
      doc.fillColor("#475569").fontSize(10).text("Item Description", 60, 217);
      doc.text("Qty", 350, 217);
      doc.text("Unit Price", 420, 217);
      doc.text("Total", 500, 217, { align: "right" });

      doc.fillColor("#0f172a").fontSize(11).text("SkillIT Career Accelerator Program Fee", 60, 250);
      doc.text("1", 355, 250);
      doc.text(`₹${amount}`, 420, 250);
      doc.text(`₹${amount}`, 500, 250, { align: "right" });

      doc.moveTo(50, 280).lineTo(562, 280).stroke("#e2e8f0");

      doc.fontSize(12).text(`Total Paid: ₹${amount}`, 350, 310, { bold: true, width: 212, align: "right" });

      doc.fontSize(9).fillColor("#64748b").text("This is a computer generated invoice and does not require a physical signature.", 50, 400, { align: "center" });
      doc.text("Contact Support: support@skillit.com | +91 98765 43210", 50, 415, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ==============================================================================
// #3 BASE DISPATCHER & MONGODB EMAIL LOGGING
// ==============================================================================
export async function sendEmail({ to, subject, html, attachments = [], retries = 2 }) {
  const from = process.env.MAIL_FROM || "SkillIT Academy <noreply@skillit.com>";
  const smtp = getTransporter();

  let logStatus = "SENT";
  let logError = null;

  if (smtp) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        await smtp.sendMail({
          from,
          to,
          subject,
          html,
          attachments,
        });
        console.log(`[Email Service] Sent email to ${to} ("${subject}") on attempt ${attempt}`);
        logStatus = "SENT";
        logError = null;
        break;
      } catch (err) {
        console.error(`[Email Service] Send failed (attempt ${attempt}/${retries + 1}):`, err.message);
        logStatus = "FAILED";
        logError = err.message;
        if (attempt <= retries) {
          const delay = Math.pow(2, attempt) * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  } else {
    console.log(`[Email Service LOGGER] Simulation Mail:
      FROM: ${from}
      TO: ${to}
      SUBJECT: ${subject}
      BODY SUMMARY: ${html.substring(0, 150)}...
      ATTACHMENTS COUNT: ${attachments.length}`);
    logStatus = "SENT";
  }

  try {
    const attachmentNames = attachments.map(a => a.filename || "file");
    await EmailLog.create({
      sender: from,
      receiver: to,
      subject,
      body: html,
      attachments: attachmentNames,
      status: logStatus,
      error: logError,
    });
  } catch (dbErr) {
    console.error("[Email Service] Database logging failed:", dbErr.message);
  }

  if (logStatus === "FAILED") {
    throw new Error(`Email delivery failed: ${logError}`);
  }

  return true;
}

// ==============================================================================
// #4 STUDENT MODULE EMAIL INTEGRATIONS
// ==============================================================================
export async function sendWelcomeEmail(student, tempPassword = null) {
  const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;
  const html = templates.getWelcomeTemplate({
    name: student.customerName,
    email: student.email,
    loginUrl,
    tempPassword,
  });

  return sendEmail({
    to: student.email,
    subject: `Welcome to SkillIT, ${student.customerName}!`,
    html,
  });
}

// ==============================================================================
// #5 FORGOT PASSWORD & AUTHENTICATION MODULE INTEGRATIONS
// ==============================================================================
export async function sendPasswordResetEmail(student, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;
  const html = templates.getPasswordResetTemplate({
    name: student.customerName,
    resetUrl,
    expiresHours: 1,
  });

  return sendEmail({
    to: student.email,
    subject: "SkillIT Portal Password Reset Request",
    html,
  });
}

export async function sendEmailVerificationEmail(student, verificationToken) {
  const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${verificationToken}`;
  const html = templates.getEmailVerificationTemplate({
    name: student.customerName,
    verificationUrl,
  });

  return sendEmail({
    to: student.email,
    subject: "Verify Your Email Address - SkillIT",
    html,
  });
}

// ==============================================================================
// #6 PAYMENT MODULE EMAIL INTEGRATIONS (CONFIRMATION, FAILURE, REFUND)
// ==============================================================================
export async function sendPaymentSuccessEmail(student, transactionId, amount, date, productName = "Career Program Fee") {
  const html = templates.getPaymentSuccessTemplate({
    name: student.customerName,
    amount,
    date,
    transactionId,
    productName,
  });

  let attachments = [];
  try {
    const pdfBuffer = await generateInvoicePDF({
      studentName: student.customerName,
      studentId: student.id,
      email: student.email,
      transactionId,
      amount,
      date,
    });
    attachments.push({
      filename: `invoice_${transactionId}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  } catch (pdfErr) {
    console.error("[Email Service] PDF generation failed, sending mail without PDF attachment:", pdfErr);
  }

  return sendEmail({
    to: student.email,
    subject: `Payment Successful! - Receipt [${transactionId.substring(0, 8).toUpperCase()}]`,
    html,
    attachments,
  });
}

export async function sendPaymentFailureEmail(student, amount, errorReason, retryUrl = "") {
  const html = templates.getPaymentFailureTemplate({
    name: student.customerName,
    amount,
    errorReason,
    retryUrl,
  });

  return sendEmail({
    to: student.email,
    subject: "Transaction Unsuccessful - SkillIT",
    html,
  });
}

export async function sendRefundEmail(student, transactionId, amount, date = new Date().toLocaleDateString("en-GB")) {
  const html = templates.getRefundTemplate({
    name: student.customerName,
    amount,
    date,
    transactionId,
  });

  return sendEmail({
    to: student.email,
    subject: `Refund Processed - Ref: ${transactionId.substring(0, 8).toUpperCase()}`,
    html,
  });
}

// ==============================================================================
// #7 TOKENS (SUPPORT) MODULE EMAIL INTEGRATIONS
// ==============================================================================
export async function sendSupportReplyEmail(ticket, replyMessage) {
  const html = templates.getSupportReplyTemplate({
    ticketId: ticket.ticketId,
    subject: ticket.subject,
    replyMessage,
    conversationHistory: ticket.conversation,
  });

  return sendEmail({
    to: ticket.studentEmail,
    subject: `Re: ${ticket.subject} [${ticket.ticketId}]`,
    html,
  });
}

export async function sendTicketCreatedEmail(ticket) {
  const html = templates.getTicketCreatedTemplate({
    ticketId: ticket.ticketId,
    subject: ticket.subject,
    description: ticket.description,
    department: ticket.assignedDepartment,
  });

  return sendEmail({
    to: ticket.studentEmail,
    subject: `Ticket [${ticket.ticketId}] Created: ${ticket.subject}`,
    html,
  });
}

export async function sendTicketResolvedEmail(ticket) {
  const html = templates.getTicketResolvedTemplate({
    ticketId: ticket.ticketId,
    resolvedBy: ticket.resolvedByName,
    resolvedAt: ticket.resolvedAt,
  });

  return sendEmail({
    to: ticket.studentEmail,
    subject: `Support Ticket Resolved - #${ticket.ticketId}`,
    html,
  });
}

// ==============================================================================
// #8 GENERAL NOTIFICATIONS
// ==============================================================================
export async function sendGeneralNotificationEmail(student, title, message) {
  const html = templates.getGeneralNotificationTemplate({
    title,
    message,
  });

  return sendEmail({
    to: student.email,
    subject: title,
    html,
  });
}
