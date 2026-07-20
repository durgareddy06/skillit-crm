import http from "http";
import crypto from "crypto";
import axios from "axios";
import mongoose from "mongoose";
import { spawn } from "child_process";
import path from "path";
import Student from "../models/Student.js";
import Ticket from "../models/Ticket.js";

const CRM_PORT = 4001;
const CRM_URL = `http://localhost:${CRM_PORT}`;
const MOCK_PORT = 5689;
const WEBHOOK_SECRET = "test_webhook_secret_67890";
const WEBHOOK_API_KEY = "test_api_key_12345";

// Mock n8n webhook receiver server
let mockReceivedWebhooks = [];
let mockServer;

function startMockServer() {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        const payload = body ? JSON.parse(body) : {};
        const signature = req.headers["x-webhook-signature"];
        const apiKey = req.headers["x-api-key"];
        const secret = req.headers["x-webhook-secret"];

        // Verify signature if secret is provided
        let isValidSignature = false;
        if (signature) {
          const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
          isValidSignature = (signature === expected);
        }

        console.log(`[Mock n8n] Received webhook on ${req.url}:`, {
          event: payload.event,
          isValidSignature,
          apiKeyMatch: apiKey === WEBHOOK_API_KEY,
          secretMatch: secret === WEBHOOK_SECRET,
        });

        mockReceivedWebhooks.push({
          url: req.url,
          headers: req.headers,
          payload,
          isValidSignature,
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    mockServer.listen(MOCK_PORT, () => {
      console.log(`[Mock n8n] Running on http://localhost:${MOCK_PORT}`);
      resolve();
    });
  });
}

function stopMockServer() {
  return new Promise((resolve) => {
    if (mockServer) {
      mockServer.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function run() {
  console.log("Starting Webhooks E2E verification test...");

  // Start mock receiver
  await startMockServer();

  let serverProcess;
  try {
    // Connect to DB to ensure we can verify DB changes
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/crm";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    // Start CRM server on test port 4001
    console.log(`Booting test CRM server on port ${CRM_PORT}...`);
    serverProcess = spawn("node", ["index.js"], {
      cwd: path.resolve(process.cwd()),
      env: {
        ...process.env,
        PORT: CRM_PORT.toString(),
        WEBHOOK_SECRET,
        WEBHOOK_API_KEY,
        N8N_STUDENT_WEBHOOK_URL: `http://localhost:${MOCK_PORT}/webhook-test/student`,
        N8N_PAYMENT_WEBHOOK_URL: `http://localhost:${MOCK_PORT}/webhook/payment`,
        N8N_EMAIL_OUTBOX_WEBHOOK_URL: `http://localhost:${MOCK_PORT}/webhook/email-outbox`,
        N8N_TOKEN_RESOLVED_WEBHOOK_URL: `http://localhost:${MOCK_PORT}/webhook/token-resolved`
      }
    });

    serverProcess.stdout.on("data", (data) => {
      console.log(`[Test Server Output] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`[Test Server Error] ${data.toString().trim()}`);
    });

    // Wait for the test server to boot up
    await new Promise((r) => setTimeout(r, 3000));

    // 1. Log in to CRM to get JWT auth token
    console.log("\n--- Logging in to CRM ---");
    const loginRes = await axios.post(`${CRM_URL}/api/auth/login`, {
      phone: "9998887766",
      password: "skillit@123",
    });
    const token = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log("Login successful.");

    // 2. Test StudentWebhook (outbound)
    console.log("\n--- Test StudentWebhook (Outbound) ---");
    mockReceivedWebhooks = [];
    const testStudentEmail = `test_student_${Date.now()}@example.com`;
    const studentRes = await axios.post(
      `${CRM_URL}/api/students`,
      {
        customerName: "John Doe",
        email: testStudentEmail,
        altContactNumber: "9876543210",
        course: "Full Stack Development",
        saleValue: 50000,
        discount: 5000,
      },
      { headers: authHeaders }
    );
    const student = studentRes.data;
    console.log(`Created student ${student.id} (${student.customerName}).`);

    // Wait for webhook async call
    await new Promise((r) => setTimeout(r, 1000));

    const studentWebhook = mockReceivedWebhooks.find((w) => w.url === "/webhook-test/student");
    if (!studentWebhook) {
      throw new Error("StudentWebhook was not received by mock n8n server!");
    }
    console.log("StudentWebhook validation successful:", studentWebhook.payload);
    if (!studentWebhook.isValidSignature) {
      throw new Error("StudentWebhook HMAC signature verification failed!");
    }

    // 2.5 Test PaymentLink generation and PaymentWebhook trigger
    console.log("\n--- Test PaymentLink generated Webhook (Outbound) ---");
    mockReceivedWebhooks = [];
    const paymentLinkRes = await axios.post(
      `${CRM_URL}/api/students/${student.id}/payment-link`,
      {
        amount: 15000,
      },
      { headers: authHeaders }
    );
    console.log(`Payment link generated for student ${student.id}. Amount: 15000.`);

    // Wait for webhook async call
    await new Promise((r) => setTimeout(r, 1000));

    const paymentLinkWebhook = mockReceivedWebhooks.find((w) => w.url === "/webhook/payment" && w.payload.event === "payment.link_created");
    if (!paymentLinkWebhook) {
      throw new Error("PaymentLink generated webhook was not received by mock n8n server!");
    }
    console.log("PaymentLink generated webhook validation successful:", paymentLinkWebhook.payload);
    if (!paymentLinkWebhook.isValidSignature) {
      throw new Error("PaymentLink generated webhook HMAC signature verification failed!");
    }

    // 3. Test EmailInboxWebhook (Inbound with registered email)
    console.log("\n--- Test EmailInboxWebhook (Inbound) ---");
    mockReceivedWebhooks = [];
    const inboundWebhookHeaders = {
      "x-webhook-secret": WEBHOOK_SECRET,
      "x-api-key": WEBHOOK_API_KEY,
    };

    const inboxRes = await axios.post(
      `${CRM_URL}/api/webhooks/email/inbox`,
      {
        senderEmail: testStudentEmail,
        recipientEmail: "support@skillit.com",
        subject: "Need help with CSS styling",
        body: "I am having trouble centering a div. Please assist.",
      },
      { headers: inboundWebhookHeaders }
    );
    const ticket = inboxRes.data;
    console.log(`EmailInboxWebhook response status: ${inboxRes.status}. Ticket created: ${ticket.ticketId}`);

    // Wait for outbound confirmation webhook call
    await new Promise((r) => setTimeout(r, 1000));

    // Verify outbound confirmation EmailOutboxWebhook received
    const outboxWebhook = mockReceivedWebhooks.find((w) => w.url === "/webhook/email-outbox");
    if (!outboxWebhook) {
      throw new Error("EmailOutboxWebhook confirmation was not received by mock n8n!");
    }
    console.log("EmailOutboxWebhook (confirmation) validation successful:", outboxWebhook.payload);

    // 4. Test EmailInboxWebhook rejection (Inbound with unregistered email)
    console.log("\n--- Test EmailInboxWebhook rejection (Inbound unregistered) ---");
    try {
      await axios.post(
        `${CRM_URL}/api/webhooks/email/inbox`,
        {
          senderEmail: "unregistered_user@example.com",
          recipientEmail: "support@skillit.com",
          subject: "Spam inquiry",
          body: "Buy this product!",
        },
        { headers: inboundWebhookHeaders }
      );
      throw new Error("Expected request to be rejected, but it succeeded!");
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log("EmailInboxWebhook successfully rejected unregistered email with 404.");
      } else {
        throw err;
      }
    }

    // 5. Test CRM User Reply to Student (trigger EmailOutboxWebhook)
    console.log("\n--- Test Ticket Reply (Outbound Reply) ---");
    mockReceivedWebhooks = [];
    const replyRes = await axios.post(
      `${CRM_URL}/api/tickets/${ticket.ticketId}/reply`,
      {
        message: "You can center a div using CSS Flexbox: display: flex; justify-content: center; align-items: center;",
      },
      { headers: authHeaders }
    );
    console.log("Reply added successfully in CRM.");

    await new Promise((r) => setTimeout(r, 1000));
    const replyWebhook = mockReceivedWebhooks.find((w) => w.url === "/webhook/email-outbox");
    if (!replyWebhook) {
      throw new Error("EmailOutboxWebhook reply notification was not received by mock n8n!");
    }
    console.log("EmailOutboxWebhook (reply) validation successful:", replyWebhook.payload);

    // 6. Test Ticket Resolution (trigger TokenResolvedWebhook)
    console.log("\n--- Test Ticket Resolution (Outbound Resolution) ---");
    mockReceivedWebhooks = [];
    const resolveRes = await axios.put(
      `${CRM_URL}/api/tickets/${ticket.ticketId}/resolve`,
      {},
      { headers: authHeaders }
    );
    console.log(`Ticket status resolved: ${resolveRes.data.status}`);

    await new Promise((r) => setTimeout(r, 1000));
    const resolvedWebhook = mockReceivedWebhooks.find((w) => w.url === "/webhook/token-resolved");
    if (!resolvedWebhook) {
      throw new Error("TokenResolvedWebhook was not received by mock n8n!");
    }
    console.log("TokenResolvedWebhook validation successful:", resolvedWebhook.payload);

    console.log("\n====================================");
    console.log("All webhook integration tests PASSED successfully!");
    console.log("====================================");
  } catch (error) {
    console.error("\nVerification test FAILED!");
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error("Response data:", error.response.data);
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  } finally {
    if (serverProcess) {
      serverProcess.kill();
      console.log("Killed test CRM server process.");
    }
    await stopMockServer();
    await mongoose.disconnect();
    console.log("Disconnected DB & mock server closed.");
  }
}

run();
