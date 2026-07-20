import crypto from "crypto";
import Student from "../models/Student.js";
import Ticket from "../models/Ticket.js";
import { nextTicketId } from "../models/Counter.js";
import { triggerEmailOutboxWebhook } from "../services/webhookService.js";

// Middleware to verify webhook auth (API Key or HMAC Signature)
export function requireWebhookAuth(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  const apiKey = process.env.WEBHOOK_API_KEY;

  if (!secret && !apiKey) {
    console.warn("[Webhook Auth] WARNING: WEBHOOK_SECRET and WEBHOOK_API_KEY are not configured. Webhooks are public!");
    return next();
  }

  // Check API Key first
  if (apiKey) {
    const requestApiKey = req.headers["x-api-key"];
    if (requestApiKey === apiKey) {
      return next();
    }
  }

  // Check Secret / Signature
  if (secret) {
    const requestSecret = req.headers["x-webhook-secret"];
    if (requestSecret === secret) {
      return next();
    }

    const expectedSignature = req.headers["x-webhook-signature"] || req.headers["x-signature"];
    if (expectedSignature && req.rawBody) {
      const computedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.rawBody)
        .digest("hex");

      try {
        if (crypto.timingSafeEqual(Buffer.from(computedSignature, "utf8"), Buffer.from(expectedSignature, "utf8"))) {
          return next();
        }
      } catch (e) {
        // signature verification failed
      }
    }
  }

  return res.status(401).json({ message: "Unauthorized webhook request" });
}

// Inbound EmailInboxWebhook (POST /api/webhooks/email/inbox)
export async function emailInboxWebhookHandler(req, res) {
  try {
    const { senderEmail, recipientEmail, subject, body, attachments } = req.body;
    if (!senderEmail || !subject) {
      return res.status(400).json({ message: "senderEmail and subject are required" });
    }

    // 1. Before ticket creation, verify the sender exists in the students database
    const student = await Student.findOne({ email: senderEmail.trim() });
    if (!student) {
      console.log(`[EmailInboxWebhook] Rejected email from unregistered student: ${senderEmail}`);
      return res.status(404).json({ message: "Sender email is not registered as a student" });
    }

    // 2. Determine assigned department based on recipient email
    let dept = "Support";
    const dest = (recipientEmail || "").toLowerCase();
    if (dest.includes("tech@")) {
      dept = "Tech";
    } else if (dest.includes("rm@")) {
      dept = "RM";
    }

    const tId = await nextTicketId();

    // 3. Create a ticket (token)
    const newTicket = new Ticket({
      ticketId: tId,
      studentId: student._id,
      studentName: student.customerName,
      studentEmail: senderEmail.trim(),
      department: dept,
      assignedDepartment: dept,
      subject,
      description: body || "",
      attachments: attachments || [],
      status: "Active",
      priority: "Medium",
      sourceEmail: senderEmail,
      destinationEmail: recipientEmail || "support@skillit.com",
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
    console.log(`[EmailInboxWebhook] Token/Ticket ${tId} created successfully for student: ${senderEmail}`);

    // 4. Show it in the tokens module (broadcast update via Socket.IO)
    const io = req.app.get("io");
    if (io) {
      io.emit("ticket-created", newTicket);
    }

    // 5. Trigger an EmailOutboxWebhook confirmation with the new token ID
    const details = {
      subject: `Ticket [${tId}] Created: ${subject}`,
      message: `Hi ${student.customerName},\n\nWe have received your support request and created a ticket for you.\n\nTicket ID: ${tId}\nSubject: ${subject}\n\nOur team will get back to you shortly.\n\nBest regards,\nSkillIT Support Team`
    };

    triggerEmailOutboxWebhook(newTicket, details).catch((err) => {
      console.error("[EmailInboxWebhook] Failed to trigger outbound confirmation:", err.message);
    });

    return res.status(201).json(newTicket);
  } catch (error) {
    console.error("[EmailInboxWebhook] Error in emailInboxWebhookHandler:", error);
    return res.status(500).json({ message: "Error processing email webhook" });
  }
}

// Inbound StudentWebhook logger/stub (POST /api/webhooks/student)
export async function studentWebhookHandler(req, res) {
  console.log("[StudentWebhook] Inbound webhook received:", req.body);
  return res.json({ ok: true, message: "Inbound student webhook logged", body: req.body });
}

// Inbound PaymentWebhook logger/stub (POST /api/webhooks/payment)
export async function paymentWebhookHandler(req, res) {
  console.log("[PaymentWebhook] Inbound webhook received:", req.body);
  return res.json({ ok: true, message: "Inbound payment webhook logged", body: req.body });
}

// Inbound EmailOutboxWebhook logger/stub (POST /api/webhooks/email/outbox)
export async function emailOutboxWebhookHandler(req, res) {
  console.log("[EmailOutboxWebhook] Inbound webhook received:", req.body);
  return res.json({ ok: true, message: "Inbound email outbox webhook logged", body: req.body });
}

// Inbound TokenResolvedWebhook logger/stub (POST /api/webhooks/token/resolve)
export async function tokenResolvedWebhookHandler(req, res) {
  console.log("[TokenResolvedWebhook] Inbound webhook received:", req.body);
  return res.json({ ok: true, message: "Inbound token resolved webhook logged", body: req.body });
}
