import Student from "../models/Student.js";
import User from "../models/User.js";
import { nextStudentId } from "../models/Counter.js";
import { triggerStudentWebhook, triggerPaymentWebhook } from "../services/webhookService.js";
import {
  getReportingManagerId,
  getOwnershipFilter,
  canAccessOwner,
  canAssignToUser,
  getManagedUserIds,
} from "../utils/hierarchy.js";
import { isSrManagerDesignation } from "../utils/userHierarchy.js";

const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

function buildPaymentLinkUrl(req, studentId, linkId) {
  const origin = req.get("origin") || `${req.protocol}://${req.get("host")}`;
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
    case "enrollments":
      return { ...activeOnly, orderPunched: true, status: "Enrolled", misStatus: { $ne: "approved" } };
    case "enrolled":
      return { ...activeOnly, orderPunched: true, status: "Enrolled", misStatus: "approved" };
    case "cancelled":
      return { ...activeOnly, status: "Cancelled" };
    case "mis-approval":
      // ALL enrolled profiles, regardless of anything else, until MIS acts on them
      return { ...activeOnly, status: "Enrolled", misStatus: { $ne: "approved" } };
    case "approved":
    case "onboarding":
      return { ...activeOnly, status: "Enrolled", misStatus: "approved" };
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
  "orientationLink",
  "recordedLink",
  "internalRemarks",
  "dropped",
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
async function getAccessibleStudentFilter(req) {
  const viewFilter = buildViewFilter(req.query.view);
  const ownershipFilter = await getOwnershipFilter(req.user);
  return mergeFilters(viewFilter, ownershipFilter);
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
  return canAccessOwner(currentUser, student.createdById, student.createdBy);
}

export async function listStudents(req, res) {
  const filter = await getAccessibleStudentFilter(req);
  const rows = await Student.find(filter).select(STUDENT_LIST_FIELDS).sort({ _id: -1 }).lean();
  res.json(rows);
}

export async function studentSummary(req, res) {
  const [pending, enrolled, cancelled] = await Promise.all([
    Student.countDocuments(await getAccessibleViewFilter(req, "pending")),
    Student.countDocuments(await getAccessibleViewFilter(req, "enrolled")),
    Student.countDocuments(await getAccessibleViewFilter(req, "cancelled")),
  ]);

  res.json({ pending, enrolled, cancelled });
}

export async function getStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id }).lean();
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }
  res.json(student);
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
  const saleValue = Number(b.saleValue ?? b.courseFee) || 0;
  const discount = Number(b.discount) || 0;
  const paidAmount = Number(b.paidAmount) || 0;
  const outstanding = Number(b.outstanding) || Math.max(0, saleValue - discount - paidAmount);

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
    dropped: Boolean(b.dropped),

    createdAt: b.createdAt || new Date().toLocaleString("en-GB"),
    createdBy: currentUser?.name || req.user?.name || "System",
    createdById: currentUser?.id || null,
    reportedTo: b.reportedTo || reportingManagerName || currentUser?.name || req.user?.name || "System",
    department: b.department || (String(req.user?.designation || "").toLowerCase().includes("mis") ? "Operations" : "Sales"),
  });

  // Trigger outbound StudentWebhook to n8n asynchronously
  triggerStudentWebhook(student).catch((err) => {
    console.error("[Student Controller] Failed to trigger StudentWebhook:", err.message);
  });

  res.status(201).json(student);
}

export async function generatePaymentLink(req, res) {
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
      ? [{ amount: student.paymentLinkAmount || 0 }]
      : [];
  const reservedAmount = existingLinks.reduce((sum, link) => sum + (Number(link.amount) || 0), 0);
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
  const url = buildPaymentLinkUrl(req, student.id, linkId);
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

  // Trigger PaymentWebhook for link creation
  triggerPaymentWebhook({
    event: "payment.link_created",
    student,
    amount,
    link: url
  }).catch((err) => {
    console.error("[Student Controller] Failed to trigger PaymentWebhook for link creation:", err.message);
  });

  res.json(student);
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

  student.payments.push({
    paidDate: date || new Date().toLocaleDateString("en-GB").replaceAll("/", "-"),
    amount: amt,
    product: "Jobo Pay",
    mode: mode || "Payment Link",
    refId: loanId || `pay_${Date.now()}`,
    statementId: req.body?.statementId || "",
    settlementDate: req.body?.settlementDate || "",
  });
  student.paidAmount += amt;
  student.outstanding = Math.max(0, netPayable - student.paidAmount);
  student.paymentMode = mode || student.paymentMode;
  student.paymentLinkStatus = student.outstanding === 0 ? "Paid" : "Partial";

  await student.save();
  res.json(student);
}

export async function punchOrder(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
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
  student.status = "Pending";
  await student.save();
  res.json(student);
}

export async function enrollStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }

  const currentUser = await getCurrentUser(req);
  const reportingManagerName = await getReportingManagerName(currentUser);

  Object.assign(student, req.body || {});
  student.manager = req.body?.manager || reportingManagerName || student.manager || "";
  student.reportedTo = req.body?.reportedTo || reportingManagerName || currentUser?.name || student.reportedTo || "";
  student.orderPunched = true;
  student.status = "Enrolled";
  student.misStatus = null;
  await student.save();
  res.json(student);
}

export async function cancelStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }
  student.status = "Cancelled";
  await student.save();
  res.json(student);
}

export async function misApprove(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student))) {
    return res.status(404).json({ message: "Student not found" });
  }
  student.misStatus = "approved";
  await student.save();
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
  await student.save();
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
  await student.save();
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
  let users;
  if (isAdminUser) {
    users = await User.find({ status: "Active" }).select("name designation").lean();
  } else if (isSrManagerDesignation(currentUser.designation || currentUser.role)) {
    users = await User.find({
      status: "Active",
      designation: { $regex: /^sde$/i },
    })
      .select("name designation")
      .lean();
  } else {
    const managedUserIds = await getManagedUserIds(currentUser, { includeSelf: false });
    if (!managedUserIds || managedUserIds.length === 0) return res.json({ users: [] });
    users = await User.find({
      _id: { $in: managedUserIds },
      status: "Active",
      designation: { $regex: /^sde$/i },
    })
      .select("name designation")
      .lean();
  }

  res.json({
    users: users.map((u) => ({ id: u._id.toString(), name: u.name, designation: u.designation })),
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
  student.createdById = targetUser._id;
  student.createdBy = targetUser.name;
  student.sdeName = targetUser.name;

  await student.save();
  res.json(student);
}

export async function editStudent(req, res) {
  const student = await Student.findOne({ id: req.params.id });
  if (!student) return res.status(404).json({ message: "Student not found" });
  if (!(await canAccessStudent(req, student.toObject()))) {
    return res.status(404).json({ message: "Student not found" });
  }
  Object.assign(student, req.body || {});
  await student.save();
  res.json(student);
}
