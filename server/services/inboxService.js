import Ticket from "../models/Ticket.js";
import Student from "../models/Student.js";
import EmailLog from "../models/EmailLog.js";
import { nextTicketId } from "../models/Counter.js";
import * as emailService from "./emailService.js";

// ==============================================================================
// #1 SOCKET.IO BINDING FOR REAL-TIME UPDATES
// ==============================================================================
let socketIo = null;

export function setSocketIo(ioInstance) {
  socketIo = ioInstance;
}

// ==============================================================================
// #2 TOKENS (SUPPORT) MODULE - INCOMING EMAIL PROCESSING & AUTO DEPARTMENT ROUTING
// Inboxes Monitored: support@skillit.com, tech@skillit.com, rm@skillit.com
// ==============================================================================
export async function processIncomingEmail({ senderEmail, recipientEmail, subject, body, attachments = [] }) {
  if (!senderEmail || !subject) {
    throw new Error("senderEmail and subject are required.");
  }

  const cleanSender = senderEmail.trim().toLowerCase();
  const cleanRecipient = (recipientEmail || "").trim().toLowerCase();
  const cleanSubject = subject.trim();

  console.log(`[Inbox Service] Processing incoming email from ${cleanSender} to ${cleanRecipient} ("${cleanSubject}")`);

  await EmailLog.create({
    sender: senderEmail,
    receiver: recipientEmail || "support@skillit.com",
    subject,
    body: body || "",
    attachments: attachments.map(a => typeof a === "string" ? a : (a.filename || "file")),
    status: "RECEIVED",
    timestamp: new Date()
  });

  const match = cleanSubject.match(/\[(TKT-\d+)\]/);
  let ticket = null;

  if (match) {
    const matchedTicketId = match[1];
    ticket = await Ticket.findOne({ ticketId: matchedTicketId });
    if (ticket) {
      console.log(`[Inbox Service] Matched ticket ID ${matchedTicketId} from subject line.`);
    }
  }

  if (!ticket) {
    ticket = await Ticket.findOne({ studentEmail: cleanSender, status: "Active" }).sort({ updatedAt: -1 });
    if (ticket) {
      console.log(`[Inbox Service] Fallback: Matched active ticket ${ticket.ticketId} for email ${cleanSender}.`);
    }
  }

  if (ticket) {
    if (ticket.status === "RESOLVED") {
      ticket.status = "Active";
      ticket.resolvedAt = null;
      ticket.resolvedBy = null;
      ticket.resolvedByName = "";
      console.log(`[Inbox Service] Re-opening resolved ticket ${ticket.ticketId} due to student reply.`);
    }

    const newReply = {
      sender: senderEmail,
      receiver: cleanRecipient,
      message: body || "",
      attachments: attachments.map(a => typeof a === "string" ? a : (a.filename || "file")),
      timestamp: new Date(),
      direction: "INBOUND"
    };

    ticket.conversation.push(newReply);
    ticket.updatedAt = new Date();
    await ticket.save();

    if (socketIo) {
      socketIo.emit("ticket-updated", ticket);
      console.log(`[Inbox Service] Socket broadcast: ticket-updated for ${ticket.ticketId}`);
    }

    return { success: true, type: "reply", ticketId: ticket.ticketId, ticket };
  }

  const student = await Student.findOne({ email: new RegExp(`^${cleanSender}$`, "i") });
  const allowUnknown = process.env.ALLOW_UNKNOWN_SENDER === "true";

  if (!student && !allowUnknown) {
    console.log(`[Inbox Service] Ignored email from unregistered user: ${cleanSender}`);
    return { success: false, ignored: true, reason: "Sender email is not registered as a student." };
  }

  let dept = "Support";
  if (cleanRecipient.includes("tech@")) {
    dept = "Tech";
  } else if (cleanRecipient.includes("rm@")) {
    dept = "RM";
  }

  const tId = await nextTicketId();
  const newTicket = new Ticket({
    ticketId: tId,
    studentId: student ? student._id : null,
    studentName: student ? student.customerName : "Unknown User",
    studentEmail: senderEmail.trim(),
    department: dept,
    assignedDepartment: dept,
    subject: cleanSubject,
    description: body || "",
    attachments: attachments.map(a => typeof a === "string" ? a : (a.filename || "file")),
    status: "Active",
    priority: "Medium",
    sourceEmail: senderEmail,
    destinationEmail: recipientEmail || `${dept.toLowerCase()}@skillit.com`,
    conversation: [{
      sender: senderEmail,
      receiver: recipientEmail || `${dept.toLowerCase()}@skillit.com`,
      message: body || "",
      attachments: attachments.map(a => typeof a === "string" ? a : (a.filename || "file")),
      timestamp: new Date(),
      direction: "INBOUND"
    }]
  });

  await newTicket.save();
  console.log(`[Inbox Service] Created ticket ${tId} for ${senderEmail} routed to ${dept}`);

  if (socketIo) {
    socketIo.emit("ticket-created", newTicket);
    console.log(`[Inbox Service] Socket broadcast: ticket-created for ${tId}`);
  }

  emailService.sendTicketCreatedEmail(newTicket).catch((err) => {
    console.error(`[Inbox Service] Failed to send ticket confirmation email for ${tId}:`, err.message);
  });

  return { success: true, type: "new", ticketId: tId, ticket: newTicket };
}

// ==============================================================================
// #3 IMAP / GMAIL INBOX POLLING SERVICE
// ==============================================================================
let pollingInterval = null;

export function startInboxMonitoring() {
  const imapUser = process.env.IMAP_USER;
  const imapPass = process.env.IMAP_PASSWORD;
  const imapHost = process.env.IMAP_HOST;

  if (imapUser && imapPass && imapHost) {
    console.log(`[Inbox Service] Starting active IMAP polling for user: ${imapUser}`);
    pollingInterval = setInterval(async () => {
      try {
        await pollInboxes();
      } catch (err) {
        console.error("[Inbox Service] IMAP Polling cycle failed:", err.message);
      }
    }, 30000);
  } else {
    console.log("[Inbox Service] IMAP credentials missing in .env. Active inbox polling is disabled. Use developer simulation tools.");
  }
}

export function stopInboxMonitoring() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[Inbox Service] Stopped IMAP polling loop.");
  }
}

async function pollInboxes() {
  // IMAP fetch loop stub
}
