import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createOrder, verifyPayment, handleWebhook } from "../controllers/paymentController.js";

const router = Router();

// Webhook endpoint (Razorpay payload notification - must be public)
router.post("/webhook", handleWebhook);

// Protected routes (require user authentication)
router.post("/order", requireAuth, createOrder);
router.post("/verify", requireAuth, verifyPayment);

export default router;
