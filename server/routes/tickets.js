import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { userHasPermission } from "../utils/permissions.js";
import {
  listTickets, getTicket, createTicket, assignTicket, resolveTicket, replyTicket,
  getSupportTickets, getTechTickets, getRMTickets
} from "../controllers/ticketController.js";

const router = Router();

// ==============================================================================
// #1 AUTHENTICATION & PERMISSION MIDDLEWARE
// ==============================================================================
router.use(requireAuth);

function requireTokensPermission(action) {
  return (req, res, next) => {
    userHasPermission(req.user, "tokens", action)
      .then((allowed) => {
        if (!allowed) {
          return res.status(403).json({ message: "You don't have permission to do that" });
        }
        return next();
      })
      .catch(next);
  };
}

const handleBodyIdParam = (req, res, next) => {
  if (!req.params.id && (req.body.ticketId || req.body.id)) {
    req.params.id = req.body.ticketId || req.body.id;
  }
  next();
};

// ==============================================================================
// #2 TOKENS (SUPPORT) MODULE - LISTING & DEPARTMENT QUEUES
// ==============================================================================
router.get("/", requireTokensPermission("read"), listTickets);
router.get("/team/support", requireTokensPermission("read"), getSupportTickets);
router.get("/team/tech", requireTokensPermission("read"), getTechTickets);
router.get("/team/rm", requireTokensPermission("read"), getRMTickets);
router.get("/:id", requireTokensPermission("read"), getTicket);

// ==============================================================================
// #3 TOKENS (SUPPORT) MODULE - CREATION, REPLIES, ASSIGNMENT & RESOLUTION
// ==============================================================================
router.post("/", requireTokensPermission("create"), createTicket);

// Direct body-based routes
router.post("/reply", requireTokensPermission("update"), handleBodyIdParam, replyTicket);
router.put("/assign", requireTokensPermission("update"), handleBodyIdParam, assignTicket);
router.put("/resolve", requireTokensPermission("update"), handleBodyIdParam, resolveTicket);

// Path parameter routes
router.post("/:id/reply", requireTokensPermission("update"), replyTicket);
router.put("/:id/assign", requireTokensPermission("update"), assignTicket);
router.put("/:id/resolve", requireTokensPermission("update"), resolveTicket);

export default router;
