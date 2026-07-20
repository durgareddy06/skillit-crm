import { Router } from "express";
import {
  webhookIncomingEmail, webhookOutgoingEmail, webhookReplySync,
  webhookTicketAssign, webhookTicketResolve
} from "../controllers/ticketController.js";
import {
  requireWebhookAuth,
  emailInboxWebhookHandler,
  studentWebhookHandler,
  paymentWebhookHandler,
  emailOutboxWebhookHandler,
  tokenResolvedWebhookHandler
} from "../controllers/webhookController.js";

const router = Router();

// Middleware to verify a webhook signature or API key for security
router.use(requireWebhookAuth);

// Primary Webhooks
router.post("/email/webhook", webhookIncomingEmail);
router.post("/email/support", webhookIncomingEmail);
router.post("/email/tech", webhookIncomingEmail);
router.post("/email/rm", webhookIncomingEmail);
router.post("/email/send", webhookOutgoingEmail);
router.post("/email/reply", webhookReplySync);
router.post("/ticket/assign", webhookTicketAssign);
router.post("/ticket/resolve", webhookTicketResolve);

// New automation webhooks
router.post("/student", studentWebhookHandler);
router.post("/payment", paymentWebhookHandler);
router.post("/email/inbox", emailInboxWebhookHandler);
router.post("/email/outbox", emailOutboxWebhookHandler);
router.post("/token/resolve", tokenResolvedWebhookHandler);

export default router;
