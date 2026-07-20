import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { userHasPermission } from "../utils/permissions.js";
import {
  listTickets, getTicket, createTicket, assignTicket, resolveTicket, replyTicket,
  getSupportTickets, getTechTickets, getRMTickets
} from "../controllers/ticketController.js";

const router = Router();

// All ticket routes require a valid authenticated session
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

router.get("/", requireTokensPermission("read"), listTickets);
router.get("/team/support", requireTokensPermission("read"), getSupportTickets);
router.get("/team/tech", requireTokensPermission("read"), getTechTickets);
router.get("/team/rm", requireTokensPermission("read"), getRMTickets);
router.get("/:id", requireTokensPermission("read"), getTicket);

router.post("/", requireTokensPermission("create"), createTicket);
router.put("/:id/assign", requireTokensPermission("update"), assignTicket);
router.put("/:id/resolve", requireTokensPermission("update"), resolveTicket);
router.post("/:id/reply", requireTokensPermission("update"), replyTicket);

export default router;
