import { Router } from "express";
import {
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  sendManualEmail,
  simulateReceiveEmail,
} from "../controllers/emailController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ==============================================================================
// #1 FORGOT PASSWORD & EMAIL VERIFICATION ROUTES
// ==============================================================================
router.post("/reset-password", requestPasswordReset);
router.post("/confirm-reset", resetPassword);
router.post("/verify", verifyEmail);

// ==============================================================================
// #2 TOKENS (SUPPORT) MODULE - INBOUND EMAIL SIMULATION ROUTES
// ==============================================================================
router.post("/receive", simulateReceiveEmail);
router.post("/webhook", simulateReceiveEmail);
router.post("/reply", simulateReceiveEmail);

// ==============================================================================
// #3 MANUAL EMAIL DISPATCH (PROTECTED ADMIN ROUTE)
// ==============================================================================
router.post("/send", requireAuth, sendManualEmail);

export default router;
