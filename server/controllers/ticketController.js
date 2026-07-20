import Ticket from "../models/Ticket.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import { nextTicketId } from "../models/Counter.js";
import axios from "axios";
import { triggerEmailOutboxWebhook, triggerTokenResolvedWebhook } from "../services/webhookService.js";

// Helper to determine allowed department based on user role and designation
function getAllowedDepartment(user) {
  const role = (user.role || "").trim().toLowerCase();
  const designation = (user.designation || "").trim().toLowerCase();

  if (role === "admin") {
    return null; // Admin has no department filter (sees all)
  }
  if (role === "tech" || designation.includes("tech")) {
    return "Tech";
  }
  if (role === "relationship manager" || role === "rm" || designation.includes("relationship manager") || designation.includes("rm")) {
    return "RM";
  }
  if (role === "customer support executive" || role === "support" || designation.includes("support") || designation.includes("customer support")) {
    return "Support";
  }
  return "Support"; // default fallback
}

// Trigger n8n webhook asynchronously
async function triggerN8NWebhook(url, data) {
  if (!url) return;
  try {
    await axios.post(url, data);
    console.log(`Triggered n8n webhook: ${url}`);
  } catch (error) {
    console.error(`Failed to trigger n8n webhook: ${url}`, error.message);
  }
}

// 1. List Tickets (filtered by role and status)
export async function listTickets(req, res) {
  try {
    const dept = getAllowedDepartment(req.user);
    const resolved = req.query.resolved === "true";
    
    const query = {
      status: resolved ? "RESOLVED" : "Active"
    };

    if (dept) {
      query.assignedDepartment = dept;
    }

    const tickets = await Ticket.find(query).sort({ updatedAt: -1 }).lean();
    res.json(tickets);
  } catch (error) {
    console.error("Error in listTickets:", error);
    res.status(500).json({ message: "Error listing tickets" });
  }
}

// 2. Get Single Ticket by Ticket ID
export async function getTicket(req, res) {
  try {
    const { id } = req.params;
    
    // Support lookup by either ticketId (TKT-XXXX) or mongo ObjectId
    const query = id.startsWith("TKT-") ? { ticketId: id } : { _id: id };
    const ticket = await Ticket.findOne(query).lean();

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Verify department permission
    const dept = getAllowedDepartment(req.user);
    if (dept && ticket.assignedDepartment !== dept) {
      return res.status(403).json({ message: "You don't have permission to access this ticket" });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error in getTicket:", error);
    res.status(500).json({ message: "Error retrieving ticket" });
  }
}

// 3. Create Ticket (System/n8n)
export async function createTicket(req, res) {
  try {
    const { senderEmail, recipientEmail, subject, body, attachments, priority } = req.body;
    if (!senderEmail || !subject) {
      return res.status(400).json({ message: "Sender email and subject are required" });
    }

    // Check if student exists
    const student = await Student.findOne({ email: senderEmail.trim() });
    
    const allowUnknown = process.env.ALLOW_UNKNOWN_SENDER === "true";
    if (!student && !allowUnknown) {
      console.log(`Ignoring email from unregistered student: ${senderEmail}`);
      return res.status(200).json({ message: "Ignored: Sender email not registered as student." });
    }

    // Determine assigned department based on recipient email
    let dept = "Support";
    const dest = (recipientEmail || "").toLowerCase();
    if (dest.includes("tech@")) {
      dept = "Tech";
    } else if (dest.includes("rm@")) {
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
      subject,
      description: body || "",
      attachments: attachments || [],
      status: "Active",
      priority: priority || "Medium",
      sourceEmail: senderEmail,
      destinationEmail: recipientEmail || `support@skillit.com`,
      conversation: [{
        sender: senderEmail,
        receiver: recipientEmail || `${dept.toLowerCase()}@skillit.com`,
        message: body || "",
        attachments: attachments || [],
        timestamp: new Date(),
        direction: "INBOUND"
      }]
    });

    await newTicket.save();

    // Broadcast update via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.emit("ticket-created", newTicket);
    }

    res.status(201).json(newTicket);
  } catch (error) {
    console.error("Error in createTicket:", error);
    res.status(500).json({ message: "Error creating ticket" });
  }
}

// 4. Assign Ticket
export async function assignTicket(req, res) {
  try {
    const { id } = req.params;
    const { department } = req.body;

    if (!["Support", "Tech", "RM"].includes(department)) {
      return res.status(400).json({ message: "Invalid department" });
    }

    const query = id.startsWith("TKT-") ? { ticketId: id } : { _id: id };
    const ticket = await Ticket.findOne(query);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const oldDept = ticket.assignedDepartment;
    ticket.assignedDepartment = department;
    ticket.department = department; // keep in sync
    await ticket.save();

    // Broadcast updates
    const io = req.app.get("io");
    if (io) {
      io.emit("ticket-assigned", { ticketId: ticket.ticketId, ticket, fromDepartment: oldDept, toDepartment: department });
    }

    // Trigger n8n webhook for Ticket Assignment
    const n8nUrl = process.env.N8N_TICKET_ASSIGN_WEBHOOK_URL;
    triggerN8NWebhook(n8nUrl, { ticketId: ticket.ticketId, assignedDepartment: department, oldDepartment: oldDept });

    res.json(ticket);
  } catch (error) {
    console.error("Error in assignTicket:", error);
    res.status(500).json({ message: "Error assigning ticket" });
  }
}

// 5. Resolve Ticket
export async function resolveTicket(req, res) {
  try {
    const { id } = req.params;

    const query = id.startsWith("TKT-") ? { ticketId: id } : { _id: id };
    const ticket = await Ticket.findOne(query);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    ticket.status = "RESOLVED";
    ticket.resolvedAt = new Date();
    ticket.resolvedBy = req.user ? req.user.id : null;
    ticket.resolvedByName = req.user ? req.user.name : "System";
    await ticket.save();

    // Broadcast updates
    const io = req.app.get("io");
    if (io) {
      io.emit("ticket-resolved", { ticketId: ticket.ticketId, ticket });
    }

    // Trigger n8n webhook for Ticket Resolution
    const n8nUrl = process.env.N8N_TICKET_RESOLVE_WEBHOOK_URL;
    triggerN8NWebhook(n8nUrl, { ticketId: ticket.ticketId, resolvedBy: ticket.resolvedByName, resolvedAt: ticket.resolvedAt, studentEmail: ticket.studentEmail });

    // Trigger TokenResolvedWebhook to n8n asynchronously
    triggerTokenResolvedWebhook(ticket).catch((err) => {
      console.error("[Ticket Controller] Failed to trigger TokenResolvedWebhook:", err.message);
    });

    res.json(ticket);
  } catch (error) {
    console.error("Error in resolveTicket:", error);
    res.status(500).json({ message: "Error resolving ticket" });
  }
}

// 6. Send CRM User Reply to Student
export async function replyTicket(req, res) {
  try {
    const { id } = req.params;
    const { message, attachments } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message body is required" });
    }

    const query = id.startsWith("TKT-") ? { ticketId: id } : { _id: id };
    const ticket = await Ticket.findOne(query);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const newReply = {
      sender: req.user.name + ` (${ticket.assignedDepartment || "Support"})`,
      receiver: ticket.studentEmail,
      message,
      attachments: attachments || [],
      timestamp: new Date(),
      direction: "OUTBOUND"
    };

    ticket.conversation.push(newReply);
    await ticket.save();

    // Broadcast updates
    const io = req.app.get("io");
    if (io) {
      io.emit("ticket-updated", ticket);
    }

    // Trigger n8n webhook to send the email out to the student
    const n8nUrl = process.env.N8N_EMAIL_SEND_WEBHOOK_URL;
    triggerN8NWebhook(n8nUrl, {
      ticketId: ticket.ticketId,
      studentEmail: ticket.studentEmail,
      studentName: ticket.studentName,
      subject: `Re: ${ticket.subject} [${ticket.ticketId}]`,
      message,
      attachments: attachments || []
    });

    // Trigger EmailOutboxWebhook back to student email
    triggerEmailOutboxWebhook(ticket, {
      subject: `Re: ${ticket.subject} [${ticket.ticketId}]`,
      message,
      attachments: attachments || []
    }).catch((err) => {
      console.error("[Ticket Controller] Failed to trigger EmailOutboxWebhook:", err.message);
    });

    res.json(ticket);
  } catch (error) {
    console.error("Error in replyTicket:", error);
    res.status(500).json({ message: "Error adding reply" });
  }
}

// 7. Team specific endpoints
export async function getSupportTickets(req, res) {
  req.query.department = "Support";
  try {
    const tickets = await Ticket.find({ assignedDepartment: "Support", status: "Active" }).sort({ updatedAt: -1 }).lean();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving Support tickets" });
  }
}

export async function getTechTickets(req, res) {
  req.query.department = "Tech";
  try {
    const tickets = await Ticket.find({ assignedDepartment: "Tech", status: "Active" }).sort({ updatedAt: -1 }).lean();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving Tech tickets" });
  }
}

export async function getRMTickets(req, res) {
  req.query.department = "RM";
  try {
    const tickets = await Ticket.find({ assignedDepartment: "RM", status: "Active" }).sort({ updatedAt: -1 }).lean();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving RM tickets" });
  }
}

// Webhook Handlers (matching n8n public webhooks)

// Webhook 1, 2, 3: Incoming Support/Tech/RM emails
export async function webhookIncomingEmail(req, res) {
  // Map parameters to createTicket
  const { senderEmail, recipientEmail, subject, body, attachments } = req.body;
  req.body.priority = req.body.priority || "Medium";
  return createTicket(req, res);
}

// Webhook 4: Outgoing reply
export async function webhookOutgoingEmail(req, res) {
  const { ticketId, message, attachments } = req.body;
  
  if (!ticketId || !message) {
    return res.status(400).json({ message: "ticketId and message are required" });
  }

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return res.status(404).json({ message: "Ticket not found" });
  }

  const sender = req.user ? req.user.name : "System";
  const newReply = {
    sender: `${sender} (${ticket.assignedDepartment || "Support"})`,
    receiver: ticket.studentEmail,
    message,
    attachments: attachments || [],
    timestamp: new Date(),
    direction: "OUTBOUND"
  };

  ticket.conversation.push(newReply);
  await ticket.save();

  // Broadcast updates
  const io = req.app.get("io");
  if (io) {
    io.emit("ticket-updated", ticket);
  }

  // Trigger n8n sending email
  const n8nUrl = process.env.N8N_EMAIL_SEND_WEBHOOK_URL;
  triggerN8NWebhook(n8nUrl, {
    ticketId: ticket.ticketId,
    studentEmail: ticket.studentEmail,
    studentName: ticket.studentName,
    subject: `Re: ${ticket.subject} [${ticket.ticketId}]`,
    message,
    attachments: attachments || []
  });

  // Trigger EmailOutboxWebhook back to student email
  triggerEmailOutboxWebhook(ticket, {
    subject: `Re: ${ticket.subject} [${ticket.ticketId}]`,
    message,
    attachments: attachments || []
  }).catch((err) => {
    console.error("[Ticket Controller] Failed to trigger EmailOutboxWebhook from webhookOutgoingEmail:", err.message);
  });

  res.json(ticket);
}

// Webhook 5: Inbound Reply Sync (when student replies back to an email thread)
export async function webhookReplySync(req, res) {
  try {
    const { senderEmail, subject, body, attachments } = req.body;

    if (!senderEmail || !subject || !body) {
      return res.status(400).json({ message: "senderEmail, subject, and body are required" });
    }

    // Match the ticket ID in subject, e.g. [TKT-8291]
    const match = subject.match(/\[(TKT-\d+)\]/);
    let ticket = null;

    if (match) {
      const ticketId = match[1];
      ticket = await Ticket.findOne({ ticketId });
    }

    // Fallback: search by student email and status = Active
    if (!ticket) {
      ticket = await Ticket.findOne({ studentEmail: senderEmail.trim(), status: "Active" }).sort({ updatedAt: -1 });
    }

    if (!ticket) {
      return res.status(404).json({ message: "No matching active ticket found for this reply" });
    }

    const newReply = {
      sender: senderEmail,
      receiver: ticket.destinationEmail || "support@skillit.com",
      message: body,
      attachments: attachments || [],
      timestamp: new Date(),
      direction: "INBOUND"
    };

    ticket.conversation.push(newReply);
    ticket.updatedAt = new Date();
    await ticket.save();

    // Broadcast updates
    const io = req.app.get("io");
    if (io) {
      io.emit("ticket-updated", ticket);
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error in webhookReplySync:", error);
    res.status(500).json({ message: "Error syncing reply" });
  }
}

// Webhook 6: Ticket Assignment (called by n8n or direct)
export async function webhookTicketAssign(req, res) {
  const { ticketId, department } = req.body;
  if (!ticketId || !department) {
    return res.status(400).json({ message: "ticketId and department are required" });
  }

  req.params.id = ticketId;
  req.body.department = department;
  return assignTicket(req, res);
}

// Webhook 7: Ticket Resolution (called by n8n or direct)
export async function webhookTicketResolve(req, res) {
  const { ticketId } = req.body;
  if (!ticketId) {
    return res.status(400).json({ message: "ticketId is required" });
  }

  req.params.id = ticketId;
  return resolveTicket(req, res);
}
