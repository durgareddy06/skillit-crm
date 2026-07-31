import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createOrder, verifyPayment, handleWebhook, confirmPayment, refundPayment, verifyPaymentLink } from "../controllers/paymentController.js";

const router = Router();

// ==============================================================================
// #1 PAYMENT MODULE - WEBHOOK LISTENER (RAZORPAY PAYLOAD NOTIFICATION)
// ==============================================================================
router.post("/webhook", handleWebhook);

// ==============================================================================
// #2 PAYMENT MODULE - ORDERS, VERIFICATION, CONFIRMATION & REFUNDS
// ==============================================================================
router.post("/order", requireAuth, createOrder);
router.post("/verify", requireAuth, verifyPayment);
router.post("/verify-link", requireAuth, verifyPaymentLink);
router.post("/confirm", requireAuth, confirmPayment);
router.post("/refund", requireAuth, refundPayment);

export default router;
