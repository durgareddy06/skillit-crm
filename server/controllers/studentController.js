import mongoose from "mongoose";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Team from "../models/Team.js";
import { nextStudentId, nextInvoiceNumber } from "../models/Counter.js";
import { generateInvoicePDF } from "../services/invoiceService.js";
import * as emailService from "../services/emailService.js";
import {
  getReportingManagerId,
  getOwnershipFilter,
  canAccessOwner,
  canAssignToUser,
  getManagedUserIds,
  getOwnTeam,
  getLedTeams,
  getAncestorManagerIds,
  getDynamicHierarchyLevels,
} from "../utils/hierarchy.js";
import { userHasPermission } from "../utils/permissions.js";
import { isSdeDesignation, isManagerDesignation, isSrManagerDesignation } from "../utils/userHierarchy.js";
import { createRazorpayPaymentLink, cancelRazorpayPaymentLink } from "../services/paymentService.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { getAccessibleUserIds } from "../utils/authorization.js";

const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

function buildPaymentLinkUrl(req, studentId, linkId) {
  const origin = process.env.FRONTEND_URL || req.get("origin") || `${req.protocol}://${req.get("host")}`;
  const suffix = linkId ? `&link=${encodeURIComponent(linkId)}` : "";
  return `${origin}/student/${studentId}?context=payment-link${suffix}`;
}

function parseDateInput(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const legacyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (legacyMatch) {
    const [, day, month, year] = legacyMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(Number(fullYear), Number(month) - 1, Number(day));
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isFutureDate(value) {
  const parsed = parseDateInput(value);
  if (!parsed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed > today;
}

function normalizeCustomFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, fieldValue]) => [String(key), fieldValue]));
}

// Single source of truth for which students show up in which module.
function buildViewFilter(view) {
  const activeOnly = { dropped: { $ne: true } };

  switch (view) {
    case "payment-link":
      return { ...activeOnly, paymentLinkGenerated: true };
    case "payments":
      return { ...activeOnly, paidAmount: { $gt: 0 } };
    case "booked-orders":
      return { ...activeOnly, orderPunched: true };
    case "pending":
      return { ...activeOnly, orderPunched: true, status: "Pending" };
    case "enrolled":
      return { ...activeOnly, orderPunched: true, status: "Enrolled", misStatus: "approved" };
    case "cancelled":
      return { ...activeOnly, status: "Cancelled" };
    case "mis-approval":
      // ALL enrolled profiles, regardless of anything else, until MIS acts on them
      return { ...activeOnly, status: "Enrolled", misStatus: { $ne: "approved" } };
    case "approved":
    case "onboarding":
      // Show only students who have NOT yet had their onboarding submitted.
      // Once the onboarding form is submitted (onboardingSubmitted: true) the
      // student moves to the Orientation queue and must disappear from here.
      return { ...activeOnly, status: "Enrolled", misStatus: "approved", onboardingSubmitted: { $ne: true } };
    case "orientation":
      return { ...activeOnly, onboardingSubmitted: true, orientationCompleted: { $ne: true } };
    case "learners":
      return { ...activeOnly, orientationCompleted: true };
    default:
      return {};
  }
}

const STUDENT_LIST_FIELDS = [
  "id",
  "customerName",
  "primaryContactName",
  "contactNumber",
  "altContactNumber",
  "email",
  "category",
  "program",
  "course",
  "batch",
  "quarter",
  "month",
  "cycle",
  "date",
  "academicYear",
  "uniqueId",
  "graduatedBranch",
  "graduationYear",
  "sdeName",
  "manager",
  "demoDoneBy",
  "salesType",
  "leadSource",
  "leadLink",
  "officeVisit",
  "saleValue",
  "discount",
  "paidAmount",
  "outstanding",
  "paymentMode",
  "paymentLinkGenerated",
  "paymentLinkAmount",
  "paymentLinkStatus",
  "paymentLinkUrl",
  "paymentLinks",
  "payments",
  "orderPunched",
  "status",
  "misStatus",
  "onboardingSubmitted",
  "orientationCompleted",
  "onboardingComments",
  "onboardingDate",
  "orientationDate",
  "onboardingSubmittedAt",
  "orientationCompletedAt",
  "orientationLink",
  "recordedLink",
  "internalRemarks",
  "dropped",
  "droppedAt",
  "orderPunchedAt",
  "enrolledAt",
  "cancelledAt",
  "misApprovedAt",
  "transferHistory",
  "onboardingVerifications",
  "callRecordings",
  "createdAt",
  "createdBy",
  "reportedTo",
  "department",
  "updatedAt",
].join(" ");

async function getCurrentUser(req) {
  if (!req.user?.id) return null;
  return req.user;
}

// Reporting manager is derived ENTIRELY from Manage Teams (Team.manager /
// Team.members) — never from a manually-assigned field on the user, and
// never from the JWT. See utils/hierarchy.js.
async function getReportingManagerName(currentUser) {
  if (!currentUser?.id) return "";
  const reportingManagerId = await getReportingManagerId(currentUser.id);
  if (!reportingManagerId) return "";
  const manager = await User.findById(reportingManagerId).select("name").lean();
  return manager?.name || "";
}

function mergeFilters(a = {}, b = {}) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length === 0) return b;
  if (bKeys.length === 0) return a;
  return { $and: [a, b] };
}

// Hierarchy + ownership scoped list filter: Admin sees everything, Senior
// Manager sees the teams under them, Manager sees only their own team,
// SDE sees only records they created. Combined with the module's own view
// filter (payment-link/pending/etc.) so a restricted user's list is the
// intersection of "what stage this view shows" and "what they're allowed
// to see" — never just the former.
async function isLeafNode(userId) {
  const ledTeams = await Team.find({ manager: userId }).limit(1).lean();
  return ledTeams.length === 0;
}

async function getAccessibleStudentFilter(req) {
  const viewFilter = buildViewFilter(req.query.view);
  const ownershipFilter = await getOwnershipFilter(req.user);
  
  // Apply Hierarchical Filters from frontend
  const hierarchyFilter = {};
  const { seniorManagerId, managerId, sdeId, hierarchyUserId } = req.query;
  const targetId = hierarchyUserId || sdeId || managerId || seniorManagerId;

  if (targetId && mongoose.isValidObjectId(targetId)) {
    const tIdObj = new mongoose.Types.ObjectId(targetId);
    const isLeaf = await isLeafNode(targetId);
    if (isLeaf) {
      hierarchyFilter.createdById = tIdObj;
    } else {
      hierarchyFilter.$or = [
        { reportingHierarchyIds: tIdObj },
        { reportedToId: tIdObj },
        { createdById: tIdObj }
      ];
    }
  }

  return mergeFilters(mergeFilters(viewFilter, ownershipFilter), hierarchyFilter);
}

async function getAccessibleViewFilter(req, view) {
  const viewFilter = buildViewFilter(view);
  const ownershipFilter = await getOwnershipFilter(req.user);
  return mergeFilters(viewFilter, ownershipFilter);
}

// Real per-record hierarchy/ownership check, used by every write action
// below. `student` is the already-loaded record; without it this can only
// confirm the caller is authenticated (used for the list/summary paths,
// which rely on the query-level filter instead).
async function canAccessStudent(req, student = null) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return false;
  if (!student) return true;
  return canAccessOwner(currentUser, student.createdById, student.createdBy, student.reportedToId, student.reportingHierarchyIds);
}

function emitStudentUpdate(req, student) {
  const io = req.app?.get("io");
  if (!io) return;
  io.emit("student-updated", { studentId: student._id, student });
}

export async function listStudents(req, res) {
  const filter = await getAccessibleStudentFilter(req);
  const rows = await Student.find(filter)
    .select(STUDENT_LIST_FIELDS)
    .populate("transferHistory.fromUserId", "name")
    .populate("transferHistory.toUserId", "name")
    .populate("transferHistory.transferredBy", "name")
    .sort({ _id: -1 })
    .lean();
  res.json(rows);
}

export async function studentSummary(req, res) {
  const views = [
    "student",
    "payment-link",
    "payments",
    "booked-orders",
    "pending",
    "enrolled",
    "mis-approval",
    "approved",
    "cancelled",
    "onboarding",
    "orientation",
    "learners",
  ];

  const ownershipFilter = await getOwnershipFilter(req.user);
  
  // Apply Hierarchical Filters from query
  const hierarchyFilter = {};
  const { seniorManagerId, managerId, sdeId, hierarchyUserId } = req.query;
  const targetId = hierarchyUserId || sdeId || managerId || seniorManagerId;

  if (targetId && mongoose.isValidObjectId(targetId)) {
    const tIdObj = new mongoose.Types.ObjectId(targetId);
    const isLeaf = await isLeafNode(targetId);
    if (isLeaf) {
      hierarchyFilter.createdById = tIdObj;
    } else {
      hierarchyFilter.$or = [
        { reportingHierarchyIds: tIdObj },
        { reportedToId: tIdObj },
        { createdById: tIdObj }
      ];
    }
  }

  const mergedOwnership = mergeFilters(ownershipFilter, hierarchyFilter);

  const counts = {};
  await Promise.all(
    views.map(async (view) => {
      const viewFilter = buildViewFilter(view);
      const combined = mergeFilters(viewFilter, mergedOwnership);
      counts[view] = await Student.countDocuments(combined);
    })
  );

  res.json(counts);
}

export async function getStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id })
    .populate("transferHistory.fromUserId", "name")
    .populate("transferHistory.toUserId", "name")
    .populate("transferHistory.transferredBy", "name")
    .lean();
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }
  res.json(student);
}

export async function getPaymentHistory(req, res) {
  const student = await Student.findOne({ id: req.params.id }).lean();
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }

  const transactions = await PaymentTransaction.find({ studentId: student._id }).sort({ createdAt: 1 }).lean();

  res.json({
    student: {
      id: student.id,
      customerName: student.customerName,
      saleValue: student.saleValue,
      discount: student.discount,
      paidAmount: student.paidAmount,
      outstanding: student.outstanding,
      payments: student.payments || [],
      paymentLinks: student.paymentLinks || [],
      createdBy: student.createdBy,
      updatedAt: student.updatedAt,
    },
    transactions,
  });
}

export async function createStudent(req, res) {
  const b = req.body || {};
  if (!b.customerName) return res.status(400).json({ message: "Student name is required" });
  if (!String(b.altContactNumber || "").trim()) {
    return res.status(400).json({ message: "Alternative number is required" });
  }

  const id = await nextStudentId();
  const currentUser = await getCurrentUser(req);
  const reportingManagerName = await getReportingManagerName(currentUser);
  const reportingManagerId = currentUser?.id ? await getReportingManagerId(currentUser.id) : null;
  const saleValue = Number(b.saleValue ?? b.courseFee) || 0;
  const discount = Number(b.discount) || 0;
  const paidAmount = Number(b.paidAmount) || 0;
  const outstanding = Number(b.outstanding) || Math.max(0, saleValue - discount - paidAmount);

  const creatorId = currentUser?.id || req.user?.id || null;
  let reportingHierarchyIds = [];
  if (b.reportedToId) {
    const ancestors = await getAncestorManagerIds(b.reportedToId);
    reportingHierarchyIds = [new mongoose.Types.ObjectId(b.reportedToId), ...ancestors];
  } else if (creatorId) {
    reportingHierarchyIds = await getAncestorManagerIds(creatorId);
  }

  const student = await Student.create({
    id,
    customerName: b.customerName,
    primaryContactName: b.primaryContactName || b.customerName,
    contactNumber: b.contactNumber || "",
    altContactNumber: String(b.altContactNumber).trim(),
    email: b.email || "",
    category: b.category || "Fresher",

    program: b.program || "",
    course: b.course || b.program || "",
    batch: b.batch || "",
    quarter: Number(b.quarter) || 1,
    month: b.month || new Date().toLocaleString("en-US", { month: "short" }).toUpperCase() + "-26",
    cycle: Number(b.cycle) || 1,
    date: b.date || new Date().toLocaleDateString("en-GB").replaceAll("/", "-"),
    academicYear: b.academicYear || "2025-2026",
    uniqueId: String(Math.floor(200000000 + Math.random() * 90000000)),
    graduatedBranch: b.graduatedBranch || "",
    graduationYear: b.graduationYear || "",

    sdeName: b.sdeName || "",
    manager: b.manager || reportingManagerName || currentUser?.name || "",
    demoDoneBy: b.demoDoneBy || "",
    salesType: b.salesType || "",
    leadSource: b.leadSource || "",
    leadLink: b.leadLink || "",
    officeVisit: b.officeVisit || "",

    saleValue,
    discount,
    paidAmount,
    outstanding,
    paymentMode: b.paymentMode || "",

    paymentLinkGenerated: Boolean(b.paymentLinkGenerated),
    paymentLinkAmount: Number(b.paymentLinkAmount) || 0,
    paymentLinkStatus: b.paymentLinkStatus || "Not Generated",
    paymentLinkUrl: b.paymentLinkUrl || "",
    paymentLinks: Array.isArray(b.paymentLinks) ? b.paymentLinks : [],
    payments: Array.isArray(b.payments) ? b.payments : [],

    orderPunched: Boolean(b.orderPunched),
    status: b.status || "Active",
    misStatus: b.misStatus || null,
    onboardingSubmitted: Boolean(b.onboardingSubmitted),
    orientationCompleted: Boolean(b.orientationCompleted),
    onboardingComments: b.onboardingComments || "",
    onboardingDate: b.onboardingDate || "",
    orientationDate: b.orientationDate || "",
    orientationLink: b.orientationLink || "",
    recordedLink: b.recordedLink || "",
    internalRemarks: b.internalRemarks || "",
    customFields: normalizeCustomFields(b.customFields),
    dropped: Boolean(b.dropped),

    createdAt: b.createdAt || new Date().toLocaleString("en-GB"),
    createdBy: currentUser?.name || req.user?.name || "System",
    createdById: currentUser?.id || null,
    reportedTo: b.reportedTo || reportingManagerName || currentUser?.name || req.user?.name || "System",
    reportedToId: b.reportedToId || reportingManagerId || null,
    reportingHierarchyIds,
    department: b.department || (String(req.user?.designation || "").toLowerCase().includes("mis") ? "Operations" : "Sales"),
  });

  await student.save();
  emitStudentUpdate(req, student);

  res.status(201).json(student);
}

export async function generatePaymentLink(req, res) {
  try {
    const student = await Student.findOne({ id: req.params.id });
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (!(await canAccessStudent(req, student))) {
      return res.status(404).json({ message: "Student not found" });
    }

    const netPayable = Math.max(0, Number(student.saleValue || 0) - Number(student.discount || 0));
    const outstandingBeforePayment = Math.max(0, netPayable - Number(student.paidAmount || 0));
    const existingLinks = Array.isArray(student.paymentLinks) && student.paymentLinks.length > 0
      ? student.paymentLinks
      : student.paymentLinkGenerated
        ? [{ amount: student.paymentLinkAmount || 0, status: student.paymentLinkStatus || "Pending" }]
        : [];
    const pendingLinks = existingLinks.filter((link) => !link.status || link.status === "Pending");
    const reservedAmount = pendingLinks.reduce((sum, link) => sum + (Number(link.amount) || 0), 0);
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Payment link amount is required" });
    }
    if (reservedAmount + amount > outstandingBeforePayment) {
      return res.status(400).json({
        message: `Payment link amount cannot exceed the remaining available balance of ${outstandingBeforePayment - reservedAmount}`,
      });
    }

    const linkId = `plink_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Call Razorpay API to generate the hosted payment link
    const customer = {
      name: student.customerName,
      email: student.email,
      contact: student.contactNumber ? student.contactNumber.replace(/[^0-9+]/g, "") : undefined,
    };
    
    const razorpayLink = await createRazorpayPaymentLink(amount, linkId, customer, student.id);
    const url = razorpayLink.short_url;

    // Create the transaction log in our DB immediately
    await PaymentTransaction.create({
      studentId: student._id,
      studentUniqueId: student.id,
      paymentLinkId: linkId,
      razorpayPaymentLinkId: razorpayLink.id || undefined,
      orderId: razorpayLink.order_id || undefined,
      amount,
      currency: "INR",
      status: "created",
    });

    const createdAt = new Date().toLocaleString("en-GB");
    student.paymentLinks = Array.isArray(student.paymentLinks) ? student.paymentLinks : [];
    student.paymentLinks.push({
      linkId,
      amount,
      status: "Pending",
      url,
      createdAt,
    });
    student.paymentLinkGenerated = true;
    student.paymentLinkAmount = amount;
    student.paymentLinkStatus = "Pending";
    student.paymentLinkUrl = url;
    await student.save();
    emitStudentUpdate(req, student);

    res.json(student);
  } catch (error) {
    console.error("Error generating Razorpay payment link:", error);
    res.status(500).json({ message: error.message || "Failed to generate Razorpay payment link" });
  }
}

export async function cancelPaymentLink(req, res) {
  try {
    const student = await Student.findOne({ id: req.params.id });
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (!(await canAccessStudent(req, student))) {
      return res.status(404).json({ message: "Student not found" });
    }

    const { linkId } = req.params;

    // Find the link in student's array
    const links = student.paymentLinks || [];
    const linkIndex = links.findIndex((l) => l.linkId === linkId);

    if (linkIndex === -1) {
      return res.status(404).json({ message: "Payment link not found on student record" });
    }

    const link = links[linkIndex];
    if (link.status === "Cancelled") {
      return res.status(400).json({ message: "Payment link is already cancelled" });
    }
    if (link.status === "Paid") {
      return res.status(400).json({ message: "Paid payment links cannot be cancelled" });
    }

    // Find corresponding payment transaction in DB to fetch the Razorpay Payment Link ID
    const transaction = await PaymentTransaction.findOne({
      studentId: student._id,
      paymentLinkId: linkId
    });

    if (transaction && transaction.razorpayPaymentLinkId) {
      try {
        await cancelRazorpayPaymentLink(transaction.razorpayPaymentLinkId);
      } catch (rzpErr) {
        console.error("Razorpay API cancellation error:", rzpErr);
        // If it is a 404 error (not found or dummy ID), or if credentials are missing, we proceed with local cancellation.
        const isNotFound = rzpErr.message.includes("404") || rzpErr.message.toLowerCase().includes("not found");
        if (process.env.RAZORPAY_KEY_ID && !isNotFound) {
          return res.status(500).json({ message: `Failed to cancel payment link on gateway: ${rzpErr.message}` });
        }
        console.log("Proceeding with local cancellation due to gateway error or missing credentials.");
      }
    }

    // Update statuses in DB
    student.paymentLinks[linkIndex].status = "Cancelled";

    // If this link was the active one, update the top-level status
    if (student.paymentLinkUrl === link.url) {
      student.paymentLinkStatus = "Cancelled";
    }

    if (transaction) {
      transaction.status = "cancelled";
      await transaction.save();
    }

    await student.save();
    emitStudentUpdate(req, student);

    res.json(student);
  } catch (error) {
    console.error("Error cancelling payment link:", error);
    res.status(500).json({ message: error.message || "Failed to cancel payment link" });
  }
}

export async function addPayment(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }

  const { mode, amount, loanId, date } = req.body || {};
  const amt = Number(amount) || 0;
  const netPayable = Math.max(0, Number(student.saleValue || 0) - Number(student.discount || 0));
  const outstandingBeforePayment = Math.max(0, netPayable - Number(student.paidAmount || 0));

  if (date && isFutureDate(date)) {
    return res.status(400).json({ message: "Transaction date cannot be in the future" });
  }
  if (amt <= 0) {
    return res.status(400).json({ message: "Payment amount must be greater than zero" });
  }
  if (amt > outstandingBeforePayment) {
    return res.status(400).json({
      message: `Payment amount cannot exceed the outstanding balance of ${outstandingBeforePayment}`,
    });
  }

  const getPaidDateString = () => {
    if (!date) return new Date().toLocaleString("en-GB");
    const parts = date.split("-");
    if (parts.length === 3) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `${parts[2]}/${parts[1]}/${parts[0]}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
    return date;
  };
  const paidDateString = getPaidDateString();

  const paymentRecord = {
    paidDate: paidDateString,
    amount: amt,
    product: "Jobo Pay",
    mode: mode || "Payment Link",
    refId: loanId || `pay_${Date.now()}`,
    statementId: req.body?.statementId || "",
    settlementDate: req.body?.settlementDate || "",
  };

  student.payments.push(paymentRecord);
  student.paidAmount += amt;
  student.outstanding = Math.max(0, netPayable - student.paidAmount);
  student.paymentMode = mode || student.paymentMode;
  student.paymentLinkStatus = student.outstanding === 0 ? "Paid" : "Partial";

  await student.save();
  emitStudentUpdate(req, student);

  emailService.sendPaymentSuccessEmail(
    student,
    paymentRecord.refId,
    amt,
    paymentRecord.paidDate,
    student.course || student.program || "Course Fee"
  ).catch((err) => {
    console.error("[Student Controller] Failed to send payment success email:", err.message);
  });

  res.json(student);
}

export async function punchOrder(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }

  // Prevent duplicate order punching
  if (student.orderPunched) {
    return res.status(409).json({ message: "Order has already been punched for this student" });
  }

  const currentUser = await getCurrentUser(req);
  const reportingManagerName = await getReportingManagerName(currentUser);

  if (req.body?.date && isFutureDate(req.body.date)) {
    return res.status(400).json({ message: "Order date cannot be in the future" });
  }

  Object.assign(student, req.body || {});
  student.manager = req.body?.manager || reportingManagerName || student.manager || "";
  student.reportedTo = req.body?.reportedTo || reportingManagerName || currentUser?.name || student.reportedTo || "";
  student.orderPunched = true;
  student.orderPunchedAt = new Date().toLocaleString("en-GB");
  student.status = "Pending";
  const emailQueue = checkAndQueueStatusEmails(student);
  await student.save();
  emitStudentUpdate(req, student);

  emailQueue.forEach(fn => fn().catch(err => {
    console.error("[Student Controller] Status transition email failed:", err.message);
  }));

  res.json(student);
}

export async function enrollStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }

  // Prevent duplicate enrollment
  if (student.status === "Enrolled") {
    return res.status(409).json({ message: "This student is already enrolled" });
  }

  const currentUser = await getCurrentUser(req);
  const reportingManagerName = await getReportingManagerName(currentUser);

  Object.assign(student, req.body || {});
  student.manager = req.body?.manager || reportingManagerName || student.manager || "";
  student.reportedTo = req.body?.reportedTo || reportingManagerName || currentUser?.name || student.reportedTo || "";
  student.orderPunched = true;
  student.enrolledAt = new Date().toLocaleString("en-GB");
  student.status = "Enrolled";
  student.misStatus = null;
  await student.save();
  emitStudentUpdate(req, student);
  res.json(student);
}

export async function cancelStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }
  student.status = "Cancelled";
  student.cancelledAt = new Date().toLocaleString("en-GB");
  await student.save();
  emitStudentUpdate(req, student);
  res.json(student);
}

export async function misApprove(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }
  student.misStatus = "approved";
  student.misApprovedAt = new Date().toLocaleString("en-GB");
  const emailQueue = checkAndQueueStatusEmails(student);
  await student.save();
  emitStudentUpdate(req, student);

  emailQueue.forEach(fn => fn().catch(err => {
    console.error("[Student Controller] Status transition email failed:", err.message);
  }));

  res.json(student);
}

export async function misCancel(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }
  student.status = "Cancelled";
  student.misStatus = null;
  student.cancelledAt = new Date().toLocaleString("en-GB");
  await student.save();
  emitStudentUpdate(req, student);
  res.json(student);
}

export async function dropStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }
  student.dropped = true;
  student.status = "Dropped";
  student.droppedAt = new Date().toLocaleString("en-GB");
  await student.save();
  emitStudentUpdate(req, student);
  res.json(student);
}

// Lightweight, non-admin-only endpoint so Managers/Senior Managers (who
// have no access to /api/admin/users) can still see who they're allowed to
// transfer a lead to. Scope is computed the exact same way the transfer
// itself is validated (utils/hierarchy.js), so this list can never offer a
// target the transfer would then reject.
export async function listTransferTargets(req, res) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Not authenticated" });

  const isAdminUser = normalize(currentUser.role) === "admin";
  const hasUpdateAll = await userHasPermission(currentUser, "student", "updateAll");

  let users;
  if (isAdminUser || hasUpdateAll) {
    users = await User.find({
      _id: { $ne: currentUser.id },
      status: "Active"
    })
      .select("name designation role")
      .lean();
  } else {
    const managedUserIds = await getManagedUserIds(currentUser, { includeSelf: false });
    if (!managedUserIds || managedUserIds.length === 0) return res.json({ users: [] });
    users = await User.find({
      _id: { $in: managedUserIds },
      status: "Active"
    })
      .select("name designation role")
      .lean();
  }

  // Only SDE users are valid assignment targets
  const sdeUsers = users.filter((u) => isSdeDesignation(u.designation || u.role));

  res.json({
    users: sdeUsers.map((u) => ({ id: u._id.toString(), name: u.name, designation: u.designation })),
  });
}

// Lead Transfer. Backend-validated against the caller's hierarchy scope:
//  - Admin: can transfer to any user.
//  - Senior Manager: only to a user within the teams under them.
//  - Manager: only to a user within their own team.
//  - SDE: never reaches here (blocked by requireActionPermission upstream,
//    since Update is the only permission group Transfer maps to and SDEs
//    have no hierarchy scope to transfer within regardless).
// The current owner must ALSO be within the caller's scope (or the caller
// is Admin) — a Manager cannot reassign a lead they don't already have
// visibility into.
export async function transferStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });

  const currentUser = await getCurrentUser(req);
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }

  const { toUserId } = req.body || {};
  if (!toUserId) return res.status(400).json({ message: "Select a user to transfer this lead to" });

  const targetUser = await User.findById(toUserId).select("name status").lean();
  if (!targetUser || targetUser.status !== "Active") {
    return res.status(400).json({ message: "Selected user could not be found" });
  }

  const allowed = await canAssignToUser(currentUser, toUserId);
  if (!allowed) {
    return res.status(403).json({
      message: "You can only transfer leads to users within your own team hierarchy",
    });
  }

  const fromUserId = student.createdById || null;
  student.transferHistory = Array.isArray(student.transferHistory) ? student.transferHistory : [];
  student.transferHistory.push({
    fromUserId,
    toUserId: targetUser._id,
    transferredBy: currentUser.id,
    transferredAt: new Date(),
  });

  // Resolve team
  const team = (await getOwnTeam(targetUser._id)) || (await getLedTeams(targetUser._id))[0] || null;
  const teamName = team ? team.name : "";

  // Resolve reporting manager
  const reportingManagerId = await getReportingManagerId(targetUser._id);
  let reportingManagerName = "";
  if (reportingManagerId) {
    const mgr = await User.findById(reportingManagerId).select("name").lean();
    reportingManagerName = mgr?.name || "";
  }

  // Resolve reporting hierarchy
  let reportingHierarchyIds = [];
  if (reportingManagerId) {
    const ancestors = await getAncestorManagerIds(reportingManagerId);
    reportingHierarchyIds = [new mongoose.Types.ObjectId(String(reportingManagerId)), ...ancestors];
  } else {
    reportingHierarchyIds = await getAncestorManagerIds(targetUser._id);
  }

  // Update ownership fields
  student.createdById = targetUser._id;
  student.createdBy = targetUser.name;
  student.sdeName = targetUser.name;
  let studentDept = student.department;
  if (studentDept) {
    const isTeamName = await Team.exists({ name: new RegExp(`^${studentDept}$`, "i") });
    if (isTeamName) {
      studentDept = null;
    }
  }
  student.department = studentDept || targetUser.department || "Sales";
  student.reportedToId = reportingManagerId;
  student.reportedTo = reportingManagerName;
  student.manager = reportingManagerName;
  student.reportingHierarchyIds = reportingHierarchyIds;

  await student.save();
  emitStudentUpdate(req, student);
  res.json(student);
}

export async function editStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student.toObject()))) {
    return res.status(404).json({ message: "Student not found" });
  }

  const originalEmail = student.email || "";
  const originalName = student.customerName || "";
  const originalContact = student.contactNumber || "";
  const originalStatus = student.status || "";

  const originalOnboardingSubmitted = student.onboardingSubmitted;
  const originalOrientationCompleted = student.orientationCompleted;

  Object.assign(student, req.body || {});

  if (student.onboardingSubmitted && (!originalOnboardingSubmitted || !student.onboardingSubmittedAt)) {
    student.onboardingSubmittedAt = student.onboardingSubmittedAt || new Date().toLocaleString("en-GB");
  }
  if (student.orientationCompleted && (!originalOrientationCompleted || !student.orientationCompletedAt)) {
    student.orientationCompletedAt = student.orientationCompletedAt || new Date().toLocaleString("en-GB");
  }

  student.customFields = normalizeCustomFields(req.body?.customFields ?? student.customFields);
  const emailQueue = checkAndQueueStatusEmails(student);
  await student.save();
  emitStudentUpdate(req, student);

  emailQueue.forEach(fn => fn().catch(err => {
    console.error("[Student Controller] Status transition email failed:", err.message);
  }));

  // Determine if important profile details have been altered
  const emailChanged = req.body.email && req.body.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();
  const nameChanged = req.body.customerName && req.body.customerName.trim() !== originalName.trim();
  const contactChanged = req.body.contactNumber && req.body.contactNumber.trim() !== originalContact.trim();
  const statusChanged = req.body.status && req.body.status !== originalStatus;

  if (emailChanged || nameChanged || contactChanged || statusChanged) {
    const recipient = emailChanged ? originalEmail : student.email;
    const changes = [];
    if (nameChanged) changes.push(`Name changed from "${originalName}" to "${student.customerName}"`);
    if (emailChanged) changes.push(`Email changed from "${originalEmail}" to "${student.email}"`);
    if (contactChanged) changes.push(`Contact number changed from "${originalContact}" to "${student.contactNumber}"`);
    if (statusChanged) changes.push(`Status changed from "${originalStatus}" to "${student.status}"`);

    emailService.sendGeneralNotificationEmail(
      { email: recipient, customerName: originalName },
      "SkillIT Student Profile Update Notification",
      `Hello ${originalName},<br/><br/>This is to notify you that key details in your student profile were updated:<br/><br/><ul>${changes.map(c => `<li>${c}</li>`).join("")}</ul><br/>If you did not authorize these changes, please contact the academy support desk immediately.`
    ).catch((err) => {
      console.error("[Student Controller] Failed to send profile update email:", err.message);
    });
  }

  res.json(student);
}

// Returns all active users — used by the Punch Order form's "Demo Done By"
// dropdown. Any SDE (or higher) on the floor can perform a demo, so every
// active user must appear in the list regardless of the caller's hierarchy
// scope. No sensitive data is exposed: only name & designation.
export async function listAllUsers(req, res) {
  const users = await User.find({ status: "Active" })
    .select("name designation")
    .sort({ name: 1 })
    .lean();

  res.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      designation: u.designation || "",
    })),
  });
}

export async function getPaymentInvoice(req, res) {
  try {
    const student = await Student.findOne({ id: req.params.id });
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (!(await canAccessStudent(req, student))) {
      return res.status(404).json({ message: "Student not found" });
    }

    const paymentIndex = parseInt(req.params.paymentIndex, 10);
    if (isNaN(paymentIndex)) {
      return res.status(400).json({ message: "Invalid payment index" });
    }

    // Handle legacy fallback payment: if student has paidAmount > 0 but payments array is empty
    if (student.payments.length === 0 && student.paidAmount > 0) {
      student.payments.push({
        paidDate: student.date || student.createdAt || new Date().toLocaleDateString("en-GB").replaceAll("/", "-"),
        amount: student.paidAmount,
        product: "Jobo Pay",
        mode: student.paymentMode || "Payment Link",
        refId: `legacy_${student.id}`,
        statementId: "",
        settlementDate: "",
      });
      await student.save();
    }

    if (paymentIndex < 0 || paymentIndex >= student.payments.length) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    const payment = student.payments[paymentIndex];

    const prod = String(payment.product || "").trim().toLowerCase();
    const mode = String(payment.mode || "").trim().toLowerCase();
    const isPaymentLink = prod === "razorpay checkout" || mode === "payment link";

    if (!isPaymentLink) {
      return res.status(400).json({ message: "Invoice and fee receipt generation is restricted to Payment Link transactions." });
    }

    // Ensure invoice fields are generated & stored in the database
    let generatedInvoiceNumber = payment.invoiceNumber;
    let generatedInvoiceDate = payment.invoiceDate;

    if (!generatedInvoiceNumber) {
      generatedInvoiceNumber = await nextInvoiceNumber();
      generatedInvoiceDate = new Date().toLocaleDateString("en-GB").replaceAll("/", "-");
      
      // Update payment document in student payments array
      student.payments[paymentIndex].invoiceNumber = generatedInvoiceNumber;
      student.payments[paymentIndex].invoiceDate = generatedInvoiceDate;
      await student.save();
    }

    // Now, build the PDF data object matching all requirements
    const totalCourseFee = Number(student.saleValue || 0);
    const amountPaid = Number(payment.amount || 0);
    
    // Reproduce reference IDs
    const refInvoiceId = student.paymentLinkId || student.id || "N/A";
    const transactionId = payment.refId || "N/A";
    const studentName = student.customerName;
    const studentId = student.id;
    const programName = student.program || student.course || "SkillIT Program";
    const parentName = student.primaryContactName || student.customerName;
    const paymentDateTime = payment.paidDate || "N/A";
    
    // Calculate outstanding balance
    const outstandingBalance = student.outstanding;
    
    const paymentMethod = payment.mode || "N/A";
    const paymentStatus = student.paymentLinkStatus || "Paid";
    const generatedBy = req.user?.name || student.createdBy || "System";

    const pdfData = {
      invoiceNumber: generatedInvoiceNumber,
      invoiceDate: generatedInvoiceDate,
      refInvoiceId,
      transactionId,
      studentName,
      studentId,
      programName,
      parentName,
      paymentDateTime,
      totalCourseFee,
      amountPaid,
      outstandingBalance,
      paymentMethod,
      paymentStatus,
      generatedBy,
      academicYear: student.academicYear || "2025-2026",
      email: student.email || "N/A",
      contactNumber: student.contactNumber || "N/A",
      discount: Number(student.discount || 0),
    };

    // Generate the PDF
    const pdfBuffer = await generateInvoicePDF(pdfData);

    // Set headers for inline preview and download filename
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("x-invoice-number", generatedInvoiceNumber);
    res.setHeader("Content-Disposition", `inline; filename="Receipt_${generatedInvoiceNumber}.pdf"`);
    res.setHeader("Access-Control-Expose-Headers", "x-invoice-number, Content-Disposition");
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    res.status(500).json({ message: "Failed to generate receipt PDF" });
  }
}

export function checkAndQueueStatusEmails(student) {
  const queue = [];

  // 1. Order Punched Email
  if (student.orderPunched && !student.orderPunchedEmailSent) {
    student.orderPunchedEmailSent = true;
    queue.push(() => emailService.sendOrderPunchedEmail(student));
  }

  // 2. Approved -> Enrolled Email
  if (student.status === "Enrolled" && student.misStatus === "approved" && !student.misApprovedEmailSent) {
    student.misApprovedEmailSent = true;
    queue.push(() => emailService.sendAdmissionApprovedEmail(student));
  }

  // 3. Onboarding Email
  if (student.status === "Enrolled" && student.misStatus === "approved" && !student.onboardingSubmitted && student.batch && !student.onboardingEmailSent) {
    student.onboardingEmailSent = true;
    queue.push(() => emailService.sendOnboardingEmail(student));
  }

  // 4. Orientation Email
  if (student.onboardingSubmitted && !student.orientationCompleted && student.orientationDate && student.orientationLink && !student.orientationEmailSent) {
    student.orientationEmailSent = true;
    queue.push(() => emailService.sendOrientationEmail(student));
  }

  return queue;
}

export async function getHierarchyFilters(req, res) {
  try {
    const allUsersRaw = await User.find({ status: "Active" }).select("name role designation").lean();
    const teams = await Team.find().select("manager members").lean();

    const accessibleIds = await getAccessibleUserIds(req.user);
    const usersRaw = accessibleIds === null
      ? allUsersRaw
      : allUsersRaw.filter((u) => accessibleIds.includes(u._id.toString()));

    const reportingMap = {};
    for (const team of teams) {
      if (!team.manager) continue;
      const mgrId = team.manager.toString();
      for (const member of team.members || []) {
        reportingMap[member.toString()] = mgrId;
      }
    }

    const users = usersRaw.map((u) => {
      const uId = u._id.toString();
      return {
        id: uId,
        name: u.name,
        designation: u.designation || u.role || "",
        reportingTo: reportingMap[uId] || null,
      };
    });

    const levels = await getDynamicHierarchyLevels();

    // Preserve legacy fields for backward compatibility
    const seniorManagers = usersRaw
      .filter((u) => isSrManagerDesignation(u.designation || u.role))
      .map((u) => ({ id: u._id.toString(), name: u.name }));

    const managers = [];
    const managersRaw = usersRaw.filter((u) => isManagerDesignation(u.designation || u.role));
    for (const mgr of managersRaw) {
      const parentTeam = teams.find((t) => t.members.some((mId) => mId.toString() === mgr._id.toString()));
      const reportingTo = parentTeam ? parentTeam.manager.toString() : null;
      managers.push({ id: mgr._id.toString(), name: mgr.name, reportingTo });
    }

    const sdes = [];
    const sdesRaw = usersRaw.filter((u) => isSdeDesignation(u.designation || u.role));
    for (const sde of sdesRaw) {
      const parentTeam = teams.find((t) => t.members.some((mId) => mId.toString() === sde._id.toString()));
      const reportingTo = parentTeam ? parentTeam.manager.toString() : null;
      sdes.push({ id: sde._id.toString(), name: sde.name, reportingTo });
    }

    res.json({ levels, users, seniorManagers, managers, sdes });
  } catch (error) {
    console.error("Failed to load hierarchy filters:", error);
    res.status(500).json({ message: error.message || "Failed to load hierarchy filters" });
  }
}

export async function uploadRecording(req, res) {
  try {
    const { id } = req.params;
    const student = await Student.findOne({ id });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    if (!(await canAccessStudent(req, student))) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No call recording file provided" });
    }

    const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

    const recording = {
      fileName: req.file.originalname,
      url: fileUrl,
      uploadedBy: req.user?.name || "System",
      uploadedAt: new Date()
    };

    student.callRecordings = student.callRecordings || [];
    student.callRecordings.push(recording);
    await student.save();

    emitStudentUpdate(req, student);

    res.json({ success: true, url: fileUrl, recording });
  } catch (error) {
    console.error("Failed to upload call recording:", error);
    res.status(500).json({ message: "Failed to upload call recording file" });
  }
}
