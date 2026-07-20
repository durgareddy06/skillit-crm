import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { userHasPermission, userHasActionPermission } from "../utils/permissions.js";

import {
  listStudents, studentSummary, getStudent, createStudent, generatePaymentLink, addPayment,
  punchOrder, enrollStudent, cancelStudent, misApprove, misCancel, dropStudent, editStudent,
  transferStudent, listTransferTargets,
} from "../controllers/studentController.js";

import { requestPasswordReset, resetPassword, verifyEmail } from "../controllers/emailController.js";

const router = Router();

// Public routes for student self-service (Password Reset & Verification)
router.post("/reset-password", requestPasswordReset);
router.post("/confirm-reset", resetPassword);
router.post("/verify-email", verifyEmail);

router.use(requireAuth); // every route below requires a valid JWT (and, per
// middleware/auth.js, a freshly-reloaded, currently-Active user — never a
// stale JWT snapshot).

// Module-row gate: exactly one module/action pair, independent per action.
function requireStudentPermission(moduleKey, action) {
  return (req, res, next) => {
    userHasPermission(req.user, moduleKey, action)
      .then((allowed) => {
        if (!allowed) {
          return res.status(403).json({ message: "You don't have permission to do that" });
        }
        return next();
      })
      .catch(next);
  };
}

// Action gate: OR across every module the product spec says can unlock this
// action (see utils/permissions.js ACTION_MODULE_MAP). Use this instead of
// requireStudentPermission for any action that the spec lists under more
// than one module (Generate Payment Link, Add Payment, Punch Order, ...) —
// this is what fixes the "enabled in Manage Roles but still 403s" bug class.
function requireActionPermission(actionKey) {
  return (req, res, next) => {
    userHasActionPermission(req.user, actionKey)
      .then((allowed) => {
        if (!allowed) {
          return res.status(403).json({ message: "You don't have permission to do that" });
        }
        return next();
      })
      .catch(next);
  };
}

const ALL_STUDENT_MODULE_KEYS = [
  "student",
  "payment-link",
  "payments",
  "booked-orders",
  "pending",
  "enrolled",
  "enrollments",
  "mis-approval",
  "approved",
  "cancelled",
  "onboarding",
  "orientation",
  "learners",
];

const normalizeStr = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

function requireReadStudentPermission() {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    if (normalizeStr(req.user.role) === "admin") return next();

    const view = req.query.view;
    const relevantModules = new Set(["student"]);

    if (view) {
      relevantModules.add(view);
      if (view === "approved" || view === "onboarding") {
        relevantModules.add("approved");
        relevantModules.add("onboarding");
        relevantModules.add("enrolled");
      }
      if (view === "orientation") {
        relevantModules.add("orientation");
        relevantModules.add("onboarding");
        relevantModules.add("approved");
      }
      if (view === "learners") {
        relevantModules.add("learners");
        relevantModules.add("orientation");
      }
      if (view === "enrolled" || view === "enrollments") {
        relevantModules.add("enrolled");
        relevantModules.add("enrollments");
        relevantModules.add("approved");
      }
      if (view === "pending") {
        relevantModules.add("pending");
        relevantModules.add("booked-orders");
      }
    } else {
      ALL_STUDENT_MODULE_KEYS.forEach((key) => relevantModules.add(key));
    }

    const modulesToTest = [...relevantModules];

    Promise.all(modulesToTest.map((key) => userHasPermission(req.user, key, "read")))
      .then((results) => {
        if (results.some(Boolean)) {
          return next();
        }
        return res.status(403).json({ message: "You don't have permission to do that" });
      })
      .catch(next);
  };
}

router.get("/", requireReadStudentPermission(), listStudents);
router.get("/summary", requireReadStudentPermission(), studentSummary);
// Must be registered before "/:id" so "transfer-targets" isn't swallowed as
// a student id.
router.get("/transfer-targets", requireActionPermission("transfer-lead"), listTransferTargets);
router.get("/:id", requireReadStudentPermission(), getStudent);
router.post("/", requireActionPermission("create-student"), createStudent);
router.post("/:id/payment-link", requireActionPermission("generate-payment-link"), generatePaymentLink);
router.post("/:id/payments", requireActionPermission("add-payment"), addPayment);
router.post("/:id/punch-order", requireActionPermission("punch-order"), punchOrder);
router.post("/:id/enroll", requireActionPermission("enroll-student"), enrollStudent);
router.post("/:id/cancel", requireActionPermission("cancel-student"), cancelStudent);
router.post("/:id/mis-approve", requireActionPermission("mis-approve"), misApprove);
router.post("/:id/mis-cancel", requireActionPermission("mis-escalate"), misCancel);
router.post("/:id/drop", requireActionPermission("drop-student"), dropStudent);
router.patch("/:id", requireActionPermission("edit-student"), editStudent);

// Lead Transfer — hierarchy-validated on the backend (see
// utils/hierarchy.js canAssignToUser). Reachable from both the Student row
// three-dot menu and the Student Details page on the frontend; both call
// this same endpoint, so there is exactly one place the rule is enforced.
router.post("/:id/transfer", requireActionPermission("transfer-lead"), transferStudent);

export default router;
