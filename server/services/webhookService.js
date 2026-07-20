import crypto from "crypto";
import axios from "axios";

// Compute HMAC signature using WEBHOOK_SECRET
function calculateHMAC(payloadStr, secret) {
  return crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
}

// Send request with retries and exponential backoff
async function sendWithRetry(url, payload, headers, retries = 3, delay = 100) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Webhook Service] Sending POST to ${url}. Attempt ${attempt}/${retries}`);
      const response = await axios.post(url, payload, { headers, timeout: 5000 });
      console.log(`[Webhook Service] Successfully triggered webhook at ${url}. Status: ${response.status}`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message;
      console.error(`[Webhook Service] Attempt ${attempt} failed for webhook ${url}: ${errorMsg}`);
      if (attempt === retries) {
        throw error;
      }
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }
}

// Unified webhook trigger
export async function triggerWebhook(urlKey, defaultUrl, payload, eventName) {
  const url = process.env[urlKey] || defaultUrl;
  if (!url) {
    console.log(`[Webhook Service] Webhook for event "${eventName}" skipped: ${urlKey} is not configured in environment.`);
    return;
  }

  const payloadStr = JSON.stringify(payload);
  const secret = process.env.WEBHOOK_SECRET || "";
  const apiKey = process.env.WEBHOOK_API_KEY || "";

  const headers = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["x-webhook-signature"] = calculateHMAC(payloadStr, secret);
    headers["x-webhook-secret"] = secret;
  }
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  try {
    await sendWithRetry(url, payloadStr, headers);
  } catch (error) {
    console.error(`[Webhook Service] E2E webhook call failed for event "${eventName}" on ${url} after 3 attempts.`);
  }
}

// 1. StudentWebhook (Triggered upon student creation)
export async function triggerStudentWebhook(student) {
  const payload = {
    event: "student.created",
    timestamp: new Date().toISOString(),
    student: {
      id: student.id,
      name: student.customerName,
      email: student.email,
      course: student.course || student.program || "",
      createdAt: student.createdAt || new Date().toLocaleString("en-GB")
    }
  };
  return triggerWebhook("N8N_STUDENT_WEBHOOK_URL", null, payload, "student.created");
}

// 2. PaymentWebhook (Unified handler for payment link creation, success, and failure)
export async function triggerPaymentWebhook({ event, student, amount, link, transactionId = "", errorReason = "" }) {
  const payload = {
    event, // "payment.link_created" | "payment.success" | "payment.failed"
    timestamp: new Date().toISOString(),
    student: {
      id: student.id,
      name: student.customerName,
      email: student.email,
      course: student.course || student.program || ""
    },
    payment: {
      amount,
      link: link || "",
      status: event === "payment.success" ? "Paid" : (event === "payment.failed" ? "Failed" : "Pending"),
      transactionId: transactionId || "",
      errorReason: errorReason || ""
    }
  };
  return triggerWebhook("N8N_PAYMENT_WEBHOOK_URL", null, payload, event);
}

// 3. EmailOutboxWebhook (Triggered on ticket creation/reply)
export async function triggerEmailOutboxWebhook(ticket, details) {
  const payload = {
    event: "email.outbox",
    timestamp: new Date().toISOString(),
    ticketId: ticket.ticketId,
    studentEmail: ticket.studentEmail,
    studentName: ticket.studentName,
    subject: details.subject || `Re: ${ticket.subject} [${ticket.ticketId}]`,
    message: details.message || details.body || "",
    attachments: details.attachments || []
  };
  return triggerWebhook("N8N_EMAIL_OUTBOX_WEBHOOK_URL", null, payload, "email.outbox");
}

// 4. TokenResolvedWebhook (Triggered when ticket is resolved)
export async function triggerTokenResolvedWebhook(ticket) {
  const payload = {
    event: "token.resolved",
    timestamp: new Date().toISOString(),
    ticketId: ticket.ticketId,
    studentEmail: ticket.studentEmail,
    studentName: ticket.studentName,
    resolvedBy: ticket.resolvedByName || "System",
    resolvedAt: ticket.resolvedAt || new Date()
  };
  return triggerWebhook("N8N_TOKEN_RESOLVED_WEBHOOK_URL", null, payload, "token.resolved");
}
