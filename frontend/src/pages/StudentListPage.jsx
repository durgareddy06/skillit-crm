import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Zap,
  FileText,
  Mail,
} from "lucide-react";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import FilterBar from "../components/FilterBar";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { Field, Input, PhoneInput, Select, formatPhoneDisplay, todayDateInputValue } from "../components/Field";
import { listStudents, dropStudent, generatePaymentLink, updateStudent, getPaymentInvoice, getHierarchyFilters, cancelPaymentLink } from "../api/students";
import { useAuth } from "../context/AuthContext";
import { canUsePermission, hasActionPermission, hasPermission } from "../lib/permissions";
import { canTransferLead, isSdeDesignation, isManagerDesignation, isSrManagerDesignation } from "../lib/userHierarchy";
import TransferLeadModal from "../components/TransferLeadModal";
import PaymentDetailsDrawer from "../components/PaymentDetailsDrawer";

const money = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN")}`;
const PAGE_SIZE = 25;
const CATEGORY_OPTIONS = ["Domain Change", "Upskill", "Career Gap", "Fresher"];

function parseFlexibleDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const legacy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (legacy) {
    const [, day, month, year] = legacy;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(Number(fullYear), Number(month) - 1, Number(day));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRangeLabel(value) {
  if (!value) return "";
  const parsed = parseFlexibleDate(value);
  if (!parsed) return "";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function getPaymentLinkUrl(row) {
  const raw = row.paymentLinkUrl || row.linkUrl || (row.studentId || row.id ? `/student/${row.studentId || row.id}?context=payment-link` : "");
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window !== "undefined") return new URL(raw, window.location.origin).toString();
  return raw;
}

function getPaymentLinkRows(student) {
  const links = Array.isArray(student.paymentLinks) && student.paymentLinks.length > 0
    ? student.paymentLinks
    : student.paymentLinkGenerated
      ? [{
          linkId: student.paymentLinkId || student.id,
          amount: student.paymentLinkAmount,
          status: student.paymentLinkStatus,
          url: student.paymentLinkUrl,
          createdAt: student.paymentLinkCreatedAt || student.createdAt,
        }]
      : [];

  return links.map((link, index) => ({
    ...student,
    id: `${student.id}-link-${link.linkId || index}`,
    studentId: student.id,
    paymentLinkId: link.linkId || `${student.id}-link-${index}`,
    paymentLinkAmount: Number(link.amount) || 0,
    paymentLinkStatus: link.status || student.paymentLinkStatus || "Not Generated",
    paymentLinkUrl: link.url || student.paymentLinkUrl || "",
    paymentLinkCreatedAt: link.createdAt || student.paymentLinkCreatedAt || student.createdAt || "",
  }));
}

function getReservedPaymentLinkAmount(student) {
  if (Array.isArray(student.paymentLinks) && student.paymentLinks.length > 0) {
    return student.paymentLinks.reduce((sum, link) => sum + (Number(link.amount) || 0), 0);
  }
  return student.paymentLinkGenerated ? Number(student.paymentLinkAmount || 0) : 0;
}

function getPaymentLinkTone(status) {
  switch (status) {
    case "Paid":
      return "green";
    case "Partial":
      return "blue";
    case "Pending":
      return "blue";
    case "Not Generated":
    default:
      return "slate";
  }
}

function useStudentList(view, hierarchyParams = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const paramsKey = JSON.stringify(hierarchyParams);

  const refresh = useCallback(() => {
    setLoading(true);
    listStudents(view, hierarchyParams)
      .then((data) => {
        setRows(data);
        setErr("");
      })
      .catch(() => setErr("Couldn't reach the backend. Is `npm run dev` running inside /server?"))
      .finally(() => setLoading(false));
  }, [view, paramsKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, err, refresh };
}

function Badge({ children, tone = "green" }) {
  const tones = {
    green: "bg-emerald-500 text-white",
    red: "bg-red-500 text-white",
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function ExpandField({ label, children }) {
  return (
    <Field label={label}>
      {children}
    </Field>
  );
}


function getModuleFilters(view, rows) {
  const getOptions = (field) => [...new Set(rows.map(r => r[field]).filter(Boolean))].sort();

  const courses = getOptions("course");
  const batches = getOptions("batch");
  const sdes = getOptions("sdeName");
  const demoDoneBys = getOptions("demoDoneBy");
  const intakeCycles = [...new Set(rows.flatMap(r => [r.cycle, r.month]).filter(Boolean))].sort();

  if (!view || view === "student") {
    return [
      { key: "studentId", label: "Student ID", type: "text" },
      { key: "studentName", label: "Student Name", type: "text" },
      { key: "course", label: "Course", type: "select", options: courses },
      { key: "batch", label: "Batch", type: "select", options: batches },
      { key: "intakeCycle", label: "Intake/Cycle", type: "select", options: intakeCycles },
      { key: "studentStatus", label: "Student Status", type: "select", options: ["Active", "Pending", "Enrolled", "Cancelled", "Dropped"] },
      { key: "counsellorSde", label: "Counsellor/SDE", type: "select", options: sdes },
    ];
  }

  switch (view) {
    case "payment-link":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "paymentStatus", label: "Payment Status", type: "select", options: ["Not Generated", "Pending", "Partial", "Paid"] },
        { key: "paymentMode", label: "Payment Mode", type: "select", options: ["Not Yet Decided", "Cash", "Swipe", "Bank Transactions", "Shopee", "FEEMONK", "FullPayment", "2Shot Payment", "JODO Flex"] },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
      ];
    case "payments":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "paymentStatus", label: "Payment Status", type: "select", options: ["Not Generated", "Pending", "Partial", "Paid"] },
        { key: "paymentMode", label: "Payment Mode", type: "select", options: ["Not Yet Decided", "Cash", "Swipe", "Bank Transactions", "Shopee", "FEEMONK", "FullPayment", "2Shot Payment", "JODO Flex"] },
        { key: "transactionId", label: "Transaction ID", type: "text" },
        { key: "paymentDate", label: "Payment Date", type: "text" },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
      ];
    case "booked-orders":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "intakeCycle", label: "Intake/Cycle", type: "select", options: intakeCycles },
        { key: "orderStatus", label: "Order Status", type: "select", options: ["Active", "Pending", "Enrolled", "Cancelled", "Dropped"] },
        { key: "bookingDate", label: "Booking Date", type: "text" },
      ];
    case "pending":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "pendingReason", label: "Pending Reason", type: "text" },
        { key: "demoDoneBy", label: "Demo Done By", type: "select", options: demoDoneBys },
      ];
    case "enrolled":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "enrollmentDate", label: "Enrollment Date", type: "text" },
        { key: "intakeCycle", label: "Intake/Cycle", type: "select", options: intakeCycles },
      ];
    case "mis-approval":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "misStatus", label: "MIS Status", type: "select", options: ["approved", "pending"] },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "approvalDate", label: "Approval Date", type: "text" },
      ];
    case "approved":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "approvalStatus", label: "Approval Status", type: "select", options: ["approved", "pending"] },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "approvedDate", label: "Approved Date", type: "text" },
      ];
    case "cancelled":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "cancellationDate", label: "Cancellation Date", type: "text" },
      ];
    case "onboarding":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "verificationStatus", label: "Verification Status", type: "select", options: ["Verified", "Unverified"] },
        { key: "onboardingStatus", label: "Onboarding Status", type: "select", options: ["Submitted", "Pending"] },
      ];
    case "orientation":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "orientationDate", label: "Orientation Date", type: "text" },
        { key: "orientationStatus", label: "Orientation Status", type: "select", options: ["Completed", "Pending"] },
      ];
    case "learners":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "learnerStatus", label: "Learner Status", type: "select", options: ["Active", "Pending", "Enrolled", "Cancelled", "Dropped"] },
      ];
    case "tokens":
      return [
        { key: "studentName", label: "Student Name", type: "text" },
        { key: "tokenStatus", label: "Token Status", type: "select", options: ["Active", "Pending", "Enrolled", "Cancelled", "Dropped"] },
        { key: "course", label: "Course", type: "select", options: courses },
        { key: "batch", label: "Batch", type: "select", options: batches },
        { key: "tokenDate", label: "Token Date", type: "text" },
      ];
    default:
      return [];
  }
}

const isAdminRole = (v) => String(v).trim().toLowerCase().replace(/[\s._-]+/g, "") === "admin";

export default function StudentListPage({ title, subtitle = "Skillit Academy | 8639191169", view, emptyText }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [hierarchyData, setHierarchyData] = useState({ levels: [], users: [], seniorManagers: [], managers: [], sdes: [] });
  
  const [selectedSrManager, setSelectedSrManager] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [selectedSde, setSelectedSde] = useState("");

  useEffect(() => {
    getHierarchyFilters()
      .then(setHierarchyData)
      .catch((err) => console.error("Failed to load hierarchy filters", err));
  }, []);

  // Reset hierarchy filters when the view/module changes
  useEffect(() => {
    setSelectedSrManager("");
    setSelectedManager("");
    setSelectedSde("");
  }, [view]);

  // Recursively gets all descendant user IDs of a given manager user
  const getDescendantIds = useCallback((parentId, usersList) => {
    if (!parentId) return [];
    const descendants = [];
    const queue = [parentId];
    const visited = new Set([parentId]);
    
    while (queue.length > 0) {
      const currId = queue.shift();
      const children = usersList.filter(u => String(u.reportingTo) === String(currId));
      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          descendants.push(child.id);
          queue.push(child.id);
        }
      }
    }
    return descendants;
  }, []);

  // Memoized selectors for filtered lists based on chained selections
  const filteredManagersForAdmin = useMemo(() => {
    const allUsers = hierarchyData.users || [];
    const managers = hierarchyData.managers || [];
    if (!selectedSrManager) return managers;
    
    const descendants = getDescendantIds(selectedSrManager, allUsers);
    return managers.filter(m => descendants.includes(m.id));
  }, [hierarchyData.users, hierarchyData.managers, selectedSrManager, getDescendantIds]);

  const filteredSdesForAdmin = useMemo(() => {
    const sdes = hierarchyData.sdes || [];
    
    if (selectedManager) {
      // Show SDs reporting to the selected manager
      return sdes.filter(s => String(s.reportingTo) === String(selectedManager));
    }
    if (selectedSrManager) {
      // Show SDs reporting to any manager in selected Sr. Manager's hierarchy
      const managerIds = filteredManagersForAdmin.map(m => m.id);
      return sdes.filter(s => managerIds.includes(s.reportingTo));
    }
    return sdes;
  }, [hierarchyData.sdes, selectedSrManager, selectedManager, filteredManagersForAdmin]);

  const filteredSdesForSrManager = useMemo(() => {
    const sdes = hierarchyData.sdes || [];
    if (!selectedManager) return sdes;
    return sdes.filter(s => String(s.reportingTo) === String(selectedManager));
  }, [hierarchyData.sdes, selectedManager]);

  const hierarchyParams = useMemo(() => {
    const params = {};
    const activeSelection = selectedSde || selectedManager || selectedSrManager;
    if (activeSelection) {
      params.hierarchyUserId = activeSelection;
      
      // Preserve backward compatibility params
      if (selectedSde) params.sdeId = selectedSde;
      else if (selectedManager) params.managerId = selectedManager;
      else if (selectedSrManager) params.seniorManagerId = selectedSrManager;
    }
    return params;
  }, [selectedSrManager, selectedManager, selectedSde]);

  const { rows, loading, err, refresh } = useStudentList(view, hierarchyParams);

  const handleDownloadReceipt = async (payment) => {
    if (!payment) return;
    try {
      const response = await getPaymentInvoice(payment.studentId, payment.paymentIndex ?? 0);
      const contentDisposition = response.headers?.["content-disposition"] || "";
      let filename = `Receipt_${payment.uniqueId || payment.studentId}.pdf`;
      const matches = contentDisposition.match(/filename="?([^";]+)"?/);
      if (matches && matches[1]) {
        filename = matches[1];
      }

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download receipt:", err);
      alert("Failed to download receipt");
    }
  };

  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [expandedId, setExpandedId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [showPaymentLink, setShowPaymentLink] = useState(false);
  const [paymentLinkAmount, setPaymentLinkAmount] = useState("");
  const [paymentLinkStudent, setPaymentLinkStudent] = useState(null);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [dropTarget, setDropTarget] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showToolbarActions, setShowToolbarActions] = useState(false);
  const [showDownloadsMenu, setShowDownloadsMenu] = useState(false);
  const [selectedDrawerPayment, setSelectedDrawerPayment] = useState(null);

  const isStudentModule = !view;
  const isPaymentLinkModule = view === "payment-link";
  const isPaymentsModule = view === "payments";
  const isOrderStageModule = ["booked-orders", "pending", "enrollments", "enrolled", "cancelled"].includes(view);
  const isBookedOrdersModule = view === "booked-orders";
  const isEnrolledModule = view === "enrolled";
  const isMisApprovalModule = view === "mis-approval";
  const isApprovedModule = view === "approved";
  const showFilters = isStudentModule || isPaymentLinkModule || isPaymentsModule || isOrderStageModule || isMisApprovalModule || isApprovedModule;
  const showPagedTable = isStudentModule || isPaymentLinkModule || isPaymentsModule || isOrderStageModule || isMisApprovalModule || isApprovedModule;
  const deferredQuery = useDeferredValue(query);
  const canCreateStudent = canUsePermission(user, "student", "create");
  const canUpdateStudent = canUsePermission(user, "student", "update");
  const canDeleteStudent = canUsePermission(user, "student", "delete");
  const canCreatePaymentLink = hasActionPermission(user, "generate-payment-link");
  const canTransferStudent = canTransferLead(user) && canUpdateStudent;

  const getContextKey = () => {
    if (view === "pending") return "pending";
    if (view === "payment-link") return "payment-link";
    if (view === "payments") return "payments";
    if (view === "booked-orders") return "booked-orders";
    if (view === "enrolled") return "enrolled";
    if (view === "cancelled") return "cancelled";
    if (view === "mis-approval") return "mis-approval";
    if (view === "approved") return "approved";
    return "student";
  };
  const contextKey = getContextKey();
  const canViewDetails = hasPermission(user, contextKey, "details");

  useEffect(() => {
    if (!isPaymentLinkModule) return;
    const link = location.state?.generatedLink;
    if (!link) return;
    setGeneratedLink(link);
    setCopiedLink(false);
    navigate(location.pathname, { replace: true, state: null });
  }, [isPaymentLinkModule, location.pathname, location.state, navigate]);

  const displayRows = useMemo(() => {
    if (isPaymentLinkModule) {
      return rows.flatMap((student) => getPaymentLinkRows(student));
    }
    if (!isPaymentsModule) return rows;

    return rows.flatMap((student) => {
      const payments = Array.isArray(student.payments) && student.payments.length > 0
        ? student.payments
        : student.paidAmount > 0
          ? [{
              paidDate: student.date || student.createdAt || "",
              amount: student.paidAmount,
              product: "Jobo Pay",
              mode: student.paymentMode || "Payment Link",
              refId: "",
              statementId: "",
              settlementDate: "",
            }]
          : [];

      return payments.map((payment, index) => ({
        ...student,
        ...payment,
        id: `${student.id}-payment-${index}`,
        studentId: student.id,
        paymentIndex: index,
        paymentDate: payment.paidDate || payment.paymentDate || "",
        amount: Number(payment.amount) || 0,
        product: payment.product || "",
        mode: payment.mode || "",
        refId: payment.refId || "",
        statementId: payment.statementId || "",
        settlementDate: payment.settlementDate || "",
      }));
    });
  }, [rows, isPaymentLinkModule, isPaymentsModule]);

  const getDetailRoute = useCallback((row) => {
    if (isPaymentLinkModule) return `/student/${row.studentId || row.id}?context=payment-link`;
    if (isPaymentsModule) return `/student/${row.studentId}?context=payments`;
    if (view) return `/student/${row.id}?context=${view}`;
    return `/student/${row.id}`;
  }, [isPaymentLinkModule, isPaymentsModule, view]);

  const filtered = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    let dateField = "date";
    if (view === "payments") dateField = "paymentDate";
    else if (view === "payment-link") dateField = "paymentLinkCreatedAt";
    else if (view === "booked-orders") dateField = "orderPunchedAt";
    else if (view === "enrolled") dateField = "enrolledAt";
    else if (view === "mis-approval" || view === "approved") dateField = "misApprovedAt";
    else if (view === "cancelled") dateField = "cancelledAt";
    else if (view === "onboarding") dateField = "onboardingSubmittedAt";
    else if (view === "orientation") dateField = "orientationCompletedAt";

    return displayRows.filter((s) => {
      if (search) {
        const haystack = [
          s.customerName,
          s.uniqueId,
          s.id,
          s.email,
          s.contactNumber,
          s.altContactNumber,
          s.primaryContactName,
          s.refId,
          s.statementId,
          s.paymentLinkUrl,
          s.paymentLinkAmount,
          s.paymentLinkCreatedAt,
          s.leadLink,
          s.product,
          s.mode,
          s.sdeName,
          s.manager,
          s.course,
          s.program,
          s.batch,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      // Student ID
      if (filterValues.studentId && !String(s.id || s.uniqueId || "").toLowerCase().includes(filterValues.studentId.toLowerCase())) {
        return false;
      }
      // Student Name
      if (filterValues.studentName && !String(s.customerName || "").toLowerCase().includes(filterValues.studentName.toLowerCase())) {
        return false;
      }
      // Course
      if (filterValues.course && s.course !== filterValues.course) return false;
      // Batch
      if (filterValues.batch && s.batch !== filterValues.batch) return false;
      // Intake/Cycle
      if (filterValues.intakeCycle && s.cycle !== Number(filterValues.intakeCycle) && s.month !== filterValues.intakeCycle) return false;
      // Student Status
      if (filterValues.studentStatus && s.status !== filterValues.studentStatus) return false;
      // Counsellor/SDE
      if (filterValues.counsellorSde && s.sdeName !== filterValues.counsellorSde && s.createdBy !== filterValues.counsellorSde) return false;
      // Payment Status
      if (filterValues.paymentStatus && s.paymentLinkStatus !== filterValues.paymentStatus) return false;
      // Payment Mode
      if (filterValues.paymentMode && s.paymentMode !== filterValues.paymentMode && s.mode !== filterValues.paymentMode) return false;
      // Transaction ID
      if (filterValues.transactionId && !String(s.refId || s.statementId || "").toLowerCase().includes(filterValues.transactionId.toLowerCase())) {
        return false;
      }
      // Payment Date
      if (filterValues.paymentDate && !String(s.paidDate || s.paymentDate || s.date || "").toLowerCase().includes(filterValues.paymentDate.toLowerCase())) {
        return false;
      }
      // Order Status
      if (filterValues.orderStatus && s.status !== filterValues.orderStatus) return false;
      // Booking Date
      if (filterValues.bookingDate && !String(s.orderPunchedAt || s.date || "").toLowerCase().includes(filterValues.bookingDate.toLowerCase())) {
        return false;
      }
      // Pending Reason
      if (filterValues.pendingReason && !String(s.internalRemarks || "").toLowerCase().includes(filterValues.pendingReason.toLowerCase())) {
        return false;
      }
      // Demo Done By
      if (filterValues.demoDoneBy && s.demoDoneBy !== filterValues.demoDoneBy) return false;
      // Enrollment Date
      if (filterValues.enrollmentDate && !String(s.enrolledAt || s.date || "").toLowerCase().includes(filterValues.enrollmentDate.toLowerCase())) {
        return false;
      }
      // MIS Status
      if (filterValues.misStatus && s.misStatus !== filterValues.misStatus) return false;
      // Approval Date
      if (filterValues.approvalDate && !String(s.misApprovedAt || s.date || "").toLowerCase().includes(filterValues.approvalDate.toLowerCase())) {
        return false;
      }
      // Approval Status / Approved Date
      if (filterValues.approvalStatus && s.misStatus !== filterValues.approvalStatus) return false;
      if (filterValues.approvedDate && !String(s.misApprovedAt || s.date || "").toLowerCase().includes(filterValues.approvedDate.toLowerCase())) {
        return false;
      }
      // Cancellation Date
      if (filterValues.cancellationDate && !String(s.cancelledAt || s.date || "").toLowerCase().includes(filterValues.cancellationDate.toLowerCase())) {
        return false;
      }
      // Verification Status
      if (filterValues.verificationStatus) {
        const isVerified = filterValues.verificationStatus === "Verified";
        if (s.isVerified !== isVerified) return false;
      }
      // Onboarding Status
      if (filterValues.onboardingStatus) {
        const isSub = filterValues.onboardingStatus === "Submitted";
        if (s.onboardingSubmitted !== isSub) return false;
      }
      // Orientation Date / Orientation Status
      if (filterValues.orientationDate && !String(s.orientationDate || s.orientationCompletedAt || "").toLowerCase().includes(filterValues.orientationDate.toLowerCase())) {
        return false;
      }
      if (filterValues.orientationStatus) {
        const isComp = filterValues.orientationStatus === "Completed";
        if (s.orientationCompleted !== isComp) return false;
      }
      // Learner Status
      if (filterValues.learnerStatus && s.status !== filterValues.learnerStatus) return false;
      // Token Status / Token Date
      if (filterValues.tokenStatus && s.status !== filterValues.tokenStatus) return false;
      if (filterValues.tokenDate && !String(s.date || "").toLowerCase().includes(filterValues.tokenDate.toLowerCase())) {
        return false;
      }

      if (dateRange.from || dateRange.to) {
        const rowDate = parseFlexibleDate(s[dateField]);
        if (!rowDate) return false;
        if (dateRange.from) {
          const from = parseFlexibleDate(dateRange.from);
          if (from && rowDate < from) return false;
        }
        if (dateRange.to) {
          const to = parseFlexibleDate(dateRange.to);
          if (to) {
            to.setHours(23, 59, 59, 999);
            if (rowDate > to) return false;
          }
        }
      }
      return true;
    });
  }, [displayRows, deferredQuery, filterValues, dateRange, view]);

  const filterDefs = useMemo(() => {
    return getModuleFilters(view, displayRows).filter((f) => f.type !== "text");
  }, [view, displayRows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [query, filterValues, dateRange, showAdvanced, view]);
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleSave = async (row) => {
    if (!canUpdateStudent) return;
    setSavingEdit(true);
    try {
      await updateStudent(row.id, editDraft);
      await refresh();
      setExpandedId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const openPaymentLink = (row) => {
    if (!canCreatePaymentLink) return;
    setPaymentLinkStudent(row);
    const availableBalance = Math.max(
      0,
      Number(row.saleValue || 0) - Number(row.discount || 0) - Number(row.paidAmount || 0) - getReservedPaymentLinkAmount(row)
    );
    setPaymentLinkAmount(String(availableBalance));
    setShowPaymentLink(true);
  };

  const confirmPaymentLink = async () => {
    if (!paymentLinkStudent || !canCreatePaymentLink) return;
    setBusy(true);
    try {
      const amount = Number(paymentLinkAmount || 0);
      if (amount <= 0) {
        return;
      }
      if (amount > paymentLinkAvailableBalance) {
        return;
      }
      await generatePaymentLink(paymentLinkStudent.id, amount);
      setShowPaymentLink(false);
      setPaymentLinkStudent(null);
      await refresh();
      navigate("/payment-link");
    } finally {
      setBusy(false);
    }
  };

  const paymentLinkAvailableBalance = paymentLinkStudent
    ? Math.max(
        0,
        Number(paymentLinkStudent.saleValue || 0)
          - Number(paymentLinkStudent.discount || 0)
          - Number(paymentLinkStudent.paidAmount || 0)
          - getReservedPaymentLinkAmount(paymentLinkStudent)
      )
    : 0;

  const copyGeneratedLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopiedLink(true);
    } catch {
      setCopiedLink(false);
    }
  };

  const confirmDrop = async () => {
    if (!dropTarget || !canDeleteStudent) return;
    setBusy(true);
    try {
      await dropStudent(dropTarget.id);
      setDropTarget(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPaymentLink = async (row) => {
    if (!row || !row.studentId || !row.paymentLinkId) return;
    if (!window.confirm("Are you sure you want to cancel this payment link? This will invalidate it in both the CRM and Razorpay gateway, ensuring it can never accept payments again.")) {
      return;
    }
    setBusy(true);
    try {
      await cancelPaymentLink(row.studentId, row.paymentLinkId);
      await refresh();
    } catch (err) {
      console.error("Failed to cancel payment link:", err);
      alert(err.response?.data?.message || "Failed to cancel payment link");
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo(() => {
    if (isPaymentLinkModule) {
      return [
        {
          key: "customerName",
          label: "Student Name",
          width: "220px",
          cellClassName: "whitespace-nowrap",
              render: (r) => (
                canViewDetails ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/student/${r.studentId || r.id}?context=payment-link`);
                    }}
                    className="inline-flex items-center rounded-full px-2 py-1 font-medium text-skillit transition-colors hover:bg-blue-50 max-w-full"
                    title={r.customerName}
                  >
                    <span className="truncate">{r.customerName}</span>
                  </button>
                ) : (
                  <span className="font-medium text-slate-700 px-2 py-1 truncate block" title={r.customerName}>{r.customerName}</span>
                )
              ),
        },
        { key: "program", label: "Program", width: "220px", cellClassName: "whitespace-nowrap" },
        { key: "uniqueId", label: "Unique ID", width: "140px", cellClassName: "whitespace-nowrap" },
        { key: "paymentLinkAmount", label: "Link Amount", width: "140px", cellClassName: "whitespace-nowrap", render: (r) => money(r.paymentLinkAmount) },
        {
          key: "paymentLinkUrl",
          label: "Link",
          width: "420px",
          cellClassName: "whitespace-nowrap",
          render: (r) => {
            const url = getPaymentLinkUrl(r);
            return url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block truncate text-skillit hover:underline max-w-full"
                title={url}
              >
                {url}
              </a>
            ) : (
              <span className="text-slate-400">-</span>
            );
          },
        },
        {
          key: "paymentLinkStatus",
          label: "Status",
          width: "120px",
          cellClassName: "whitespace-nowrap",
          render: (r) => <Badge tone={getPaymentLinkTone(r.paymentLinkStatus)}>{r.paymentLinkStatus || "Not Generated"}</Badge>,
        },
        { key: "paymentLinkCreatedAt", label: "Generated On", width: "180px", cellClassName: "whitespace-nowrap" },
        { key: "primaryContactName", label: "Parent Name", width: "220px", cellClassName: "whitespace-nowrap" },
        { key: "contactNumber", label: "Phone", width: "160px", cellClassName: "whitespace-nowrap", render: (r) => formatPhoneDisplay(r.contactNumber) },
        { key: "email", label: "Email", width: "220px", cellClassName: "whitespace-nowrap" },
      ];
    }

    if (isPaymentsModule) {
      return [
        {
          key: "customerName",
          label: "Student Name",
          width: "260px",
          cellClassName: "whitespace-nowrap",
          render: (r) => (
            <div className="flex items-center gap-2 max-w-full min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDrawerPayment(r);
                }}
                className="inline-flex items-center justify-center p-1 rounded-lg text-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all shrink-0"
                title="View Payment Details"
              >
                <FileText className="h-4 w-4" />
              </button>
              {canViewDetails ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/student/${r.studentId}?context=payments`);
                  }}
                  className="inline-flex items-center font-medium text-skillit transition-colors hover:underline truncate text-left"
                  title={r.customerName}
                >
                  {r.customerName}
                </button>
              ) : (
                <span className="font-medium text-slate-700 truncate" title={r.customerName}>{r.customerName}</span>
              )}
            </div>
          ),
        },
        { key: "program", label: "Program", width: "220px", cellClassName: "whitespace-nowrap" },
        { key: "uniqueId", label: "Unique ID", width: "140px", cellClassName: "whitespace-nowrap" },
        { key: "paymentDate", label: "Paid Date", width: "140px", cellClassName: "whitespace-nowrap" },
        { key: "amount", label: "Amount", width: "140px", cellClassName: "whitespace-nowrap", render: (r) => money(r.amount) },
        { key: "product", label: "Product", width: "180px", cellClassName: "whitespace-nowrap" },
        { key: "mode", label: "Mode", width: "160px", cellClassName: "whitespace-nowrap" },
        { key: "refId", label: "Payment Reference ID", width: "220px", cellClassName: "whitespace-nowrap" },
        { key: "statementId", label: "Statement ID", width: "180px", cellClassName: "whitespace-nowrap" },
        { key: "settlementDate", label: "Settlement Date", width: "170px", cellClassName: "whitespace-nowrap" },
      ];
    }

    if (isOrderStageModule || isMisApprovalModule || isApprovedModule) {
      return [
        {
          key: "customerName",
          label: "Customer Name",
          width: "220px",
          cellClassName: "whitespace-nowrap",
          render: (r) => (
            isBookedOrdersModule || isEnrolledModule || !canViewDetails ? (
              <span className="font-medium text-slate-700 px-2 py-1 truncate block" title={r.customerName}>{r.customerName}</span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/student/${r.id}?context=${view}`);
                }}
                className="inline-flex items-center rounded-full px-2 py-1 font-medium text-skillit transition-colors hover:bg-blue-50 max-w-full"
                title={r.customerName}
              >
                <span className="truncate">{r.customerName}</span>
              </button>
            )
          ),
        },
        { key: "date", label: "Date", width: "120px", cellClassName: "whitespace-nowrap" },
        { key: "month", label: "Month", width: "110px", cellClassName: "whitespace-nowrap" },
        { key: "cycle", label: "Cycle", width: "90px", cellClassName: "whitespace-nowrap" },
        { key: "course", label: "Course", width: "220px", cellClassName: "whitespace-nowrap" },
        { key: "primaryContactName", label: "Customer Contact Name", width: "220px", cellClassName: "whitespace-nowrap" },
        { key: "sdeName", label: "SDE Name", width: "160px", cellClassName: "whitespace-nowrap" },
        { key: "manager", label: "Manager", width: "160px", cellClassName: "whitespace-nowrap" },
        { key: "demoDoneBy", label: "Demo By", width: "150px", cellClassName: "whitespace-nowrap" },
        {
          key: "status",
          label: "Status",
          width: "120px",
          cellClassName: "whitespace-nowrap",
          render: (r) => <Badge tone={r.status === "Cancelled" ? "red" : r.status === "Enrolled" ? "green" : "blue"}>{r.status || "Pending"}</Badge>,
        },
        { key: "paymentMode", label: "Payment Mode", width: "160px", cellClassName: "whitespace-nowrap" },
        { key: "saleValue", label: "Sale Value", width: "140px", cellClassName: "whitespace-nowrap", render: (r) => money(r.saleValue) },
        { key: "paidAmount", label: "Paid Amount", width: "140px", cellClassName: "whitespace-nowrap", render: (r) => money(r.paidAmount) },
        { key: "outstanding", label: "Outstanding Amount", width: "170px", cellClassName: "whitespace-nowrap", render: (r) => money(r.outstanding) },
        { key: "altContactNumber", label: "Alternative Phone Number", width: "220px", cellClassName: "whitespace-nowrap", render: (r) => formatPhoneDisplay(r.altContactNumber) },
      ];
    }

    if (!isStudentModule) {
      return [
        {
          key: "customerName",
          label: "Customer Name",
          width: "220px",
          render: (r) => (
            <span
              className={canViewDetails ? "font-medium text-skillit truncate block" : "font-medium text-slate-700 truncate block"}
              title={r.customerName}
            >
              {r.customerName}
            </span>
          )
        },
        { key: "date", label: "Date", width: "120px" },
        { key: "month", label: "Month", width: "110px" },
        { key: "cycle", label: "Cycle", width: "90px" },
        { key: "course", label: "Course", width: "220px" },
        { key: "contactNumber", label: "Customer Contact", width: "160px", render: (r) => formatPhoneDisplay(r.contactNumber) },
        { key: "sdeName", label: "SDE", width: "160px" },
      ];
    }

    return [
      {
        key: "customerName",
        label: "Student Name",
        width: "220px",
        render: (r) => (
          <span
            className={canViewDetails ? "font-medium text-skillit truncate block" : "font-medium text-slate-700 truncate block"}
            title={r.customerName}
          >
            {r.customerName}
          </span>
        ),
      },
      { key: "program", label: "Program", width: "220px" },
      { key: "uniqueId", label: "Unique ID", width: "140px" },
      { key: "saleValue", label: "Total Amount", width: "140px", render: (r) => money(r.saleValue) },
      {
        key: "paymentLinkAmount",
        label: (
          <span className="inline-block leading-tight">
            Amount
            <br />
            generated
          </span>
        ),
        width: "140px",
        render: (r) => money(r.paymentLinkAmount),
      },
      { key: "createdAt", label: "Created At", width: "160px" },
      { key: "createdBy", label: "Created By", width: "160px" },
      { key: "reportedTo", label: "Reported To", width: "160px" },
      { key: "department", label: "Department", width: "140px" },
      {
        key: "status",
        label: "Status",
        width: "120px",
        render: (r) => <Badge tone={r.status === "Dropped" ? "red" : "green"}>{r.status === "Dropped" ? "Dropped" : "Active"}</Badge>,
      },
    ];
  }, [isApprovedModule, isMisApprovalModule, isOrderStageModule, isPaymentLinkModule, isPaymentsModule, isStudentModule, navigate, view]);



  return (
    <div>
      <Topbar
        title={title}
        subtitle={subtitle}
        right={
          isStudentModule ? (
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white px-3 py-1.5 text-skillit shadow-sm">
                <span className="text-xs font-medium">No:of Students</span>
                <span className="ml-2 text-lg font-bold leading-none">{rows.length}</span>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/student/new")}
                disabled={!canCreateStudent}
                className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white"
                title={canCreateStudent ? undefined : "Create access is disabled for this role"}
              >
                <Plus className="h-4 w-4" /> New Student
              </Button>
            </div>
          ) : null
        }
      />

      {showFilters && (
        <>
          {/* Row 1: Hierarchy (if any), Universal Search, and Date filter */}
          <div className="flex flex-wrap items-center gap-3 mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            {/* Chained Hierarchy Filters based on logged-in User Role */}
            {(() => {
              const isUserAdmin = isAdminRole(user.role);
              const isUserSrManager = isSrManagerDesignation(user.designation || user.role);
              const isUserManager = isManagerDesignation(user.designation || user.role);

              if (isUserAdmin) {
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">Reportees:</span>
                    <Select
                      value={selectedSrManager}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSrManager(val);
                        setSelectedManager("");
                        setSelectedSde("");
                      }}
                      className="!w-[150px] !h-8 !px-2.5 !py-1.5 shrink-0 bg-white text-[11px]"
                    >
                      <option value="">Select Senior Manager</option>
                      {(hierarchyData.seniorManagers || []).map((sm) => (
                        <option key={sm.id} value={sm.id}>
                          {sm.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={selectedManager}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedManager(val);
                        setSelectedSde("");
                      }}
                      className="!w-[150px] !h-8 !px-2.5 !py-1.5 shrink-0 bg-white text-[11px]"
                    >
                      <option value="">Select Reporting Manager</option>
                      {filteredManagersForAdmin.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={selectedSde}
                      onChange={(e) => setSelectedSde(e.target.value)}
                      className="!w-[150px] !h-8 !px-2.5 !py-1.5 shrink-0 bg-white text-[11px]"
                    >
                      <option value="">Select SD</option>
                      {filteredSdesForAdmin.map((sde) => (
                        <option key={sde.id} value={sde.id}>
                          {sde.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              }

              if (isUserSrManager) {
                return (
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedManager}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedManager(val);
                        setSelectedSde("");
                      }}
                      className="!w-[150px] !h-8 !px-2.5 !py-1.5 shrink-0 bg-white text-[11px]"
                    >
                      <option value="">Select Reporting Manager</option>
                      {(hierarchyData.managers || []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={selectedSde}
                      onChange={(e) => setSelectedSde(e.target.value)}
                      className="!w-[150px] !h-8 !px-2.5 !py-1.5 shrink-0 bg-white text-[11px]"
                    >
                      <option value="">Select SD</option>
                      {filteredSdesForSrManager.map((sde) => (
                        <option key={sde.id} value={sde.id}>
                          {sde.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              }

              if (isUserManager) {
                return (
                  <Select
                    value={selectedSde}
                    onChange={(e) => setSelectedSde(e.target.value)}
                    className="!w-[150px] !h-8 !px-2.5 !py-1.5 shrink-0 bg-white text-[11px]"
                  >
                    <option value="">Select SD</option>
                    {(hierarchyData.sdes || []).map((sde) => (
                      <option key={sde.id} value={sde.id}>
                        {sde.name}
                      </option>
                    ))}
                  </Select>
                );
              }

              return null;
            })()}

            {/* Universal Search Box */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 !h-8 shrink-0 w-[260px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Universal Search..."
                className="w-full border-0 bg-transparent text-[11px] outline-none placeholder:text-slate-400 font-medium text-slate-700"
              />
            </div>

            {/* Date range filter button */}
            {(isPaymentsModule || isPaymentLinkModule || isOrderStageModule) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowDateMenu((v) => !v);
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <span className="text-blue-500 font-semibold">{isPaymentsModule ? "Paid Date" : "Date"}</span>
                  <span className="font-semibold text-slate-900">
                    {dateRange.from || dateRange.to
                      ? `${formatRangeLabel(dateRange.from) || "Start"} - ${formatRangeLabel(dateRange.to) || "End"}`
                      : isPaymentsModule
                        ? "Select range"
                        : "Select date"}
                  </span>
                </button>
                {(dateRange.from || dateRange.to) && (
                  <button
                    type="button"
                    onClick={() => setDateRange({ from: "", to: "" })}
                    className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-300"
                    aria-label="Clear date filter"
                  >
                    ×
                  </button>
                )}
                {showDateMenu && (
                  <div className="absolute left-0 top-10 z-50 w-[340px] rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="From">
                        <Input
                          type="date"
                          max={todayDateInputValue()}
                          value={dateRange.from}
                          onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
                        />
                      </Field>
                      <Field label="To">
                        <Input
                          type="date"
                          max={todayDateInputValue()}
                          value={dateRange.to}
                          onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
                        />
                      </Field>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setDateRange({ from: "", to: "" })} className="!text-skillit">
                        Clear
                      </Button>
                      <Button type="button" onClick={() => setShowDateMenu(false)} className="min-w-[90px]">
                        Apply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <FilterBar
            filters={filterDefs}
            values={filterValues}
            onChange={(k, v) => setFilterValues((f) => ({ ...f, [k]: v }))}
            onAdvanced={() => setShowAdvanced((v) => !v)}
            advancedLabel="Advanced Filters"
          />

          {showAdvanced && (
            <div className="mb-4 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-100">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Status">
                  <Select
                    value={filterValues.status || ""}
                    onChange={(e) => setFilterValues((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="">All</option>
                    <option value="Active">Active</option>
                    <option value="Dropped">Dropped</option>
                  </Select>
                </Field>
                <Field label="Created By">
                  <Input
                    value={filterValues.createdBy || ""}
                    onChange={(e) => setFilterValues((f) => ({ ...f, createdBy: e.target.value }))}
                  />
                </Field>
                <Field label="Payment Status">
                  <Select
                    value={filterValues.paymentStatus || ""}
                    onChange={(e) => setFilterValues((f) => ({ ...f, paymentStatus: e.target.value }))}
                  >
                    <option value="">All</option>
                    <option value="Not Generated">Not Generated</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid">Paid</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}
        </>
      )}

      {(isStudentModule || isPaymentLinkModule) && (
        <div className="relative z-30 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {isStudentModule && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowDownloadsMenu(false);
                    setShowToolbarActions((v) => !v);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-400 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-colors hover:bg-slate-50"
                >
                  <Zap className="h-3.5 w-3.5" /> Actions <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {showToolbarActions && (
                  <div className="absolute left-0 top-12 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]">
                    <button
                      type="button"
                      disabled={!canCreateStudent}
                      onClick={() => {
                        if (!canCreateStudent) return;
                        setShowToolbarActions(false);
                        navigate("/student/new");
                      }}
                      className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white"
                      title={canCreateStudent ? undefined : "Create access is disabled for this role"}
                    >
                      New Student
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowToolbarActions(false);
                        refresh();
                      }}
                      className="block w-full border-t border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowToolbarActions(false);
                  setShowDownloadsMenu((v) => !v);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-400 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-colors hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" /> Downloads <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {showDownloadsMenu && (
                <div className="absolute left-0 top-12 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]">
                  <button
                    type="button"
                    onClick={() => setShowDownloadsMenu(false)}
                    className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDownloadsMenu(false)}
                    className="block w-full border-t border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Download PDF
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-400 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-colors hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 text-slate-500 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="grid h-8 w-8 place-items-center rounded-lg border border-blue-500 text-blue-600 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-1 text-sm text-slate-700">
              {filtered.length === 0 ? "0-0" : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filtered.length)}`} of {filtered.length}
            </span>
          </div>
        </div>
      )}

      {err && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{err}</p>}

        <DataTable
          columns={columns}
          rows={showPagedTable ? pageRows : filtered}
          onRowClick={
            !canViewDetails || isBookedOrdersModule || isEnrolledModule
              ? undefined
              : isStudentModule
                ? (row) => navigate(`/student/${row.id}`)
                : (row) => navigate(getDetailRoute(row))
          }
          emptyText={loading ? "Loading..." : emptyText}
          tableLayout={(isPaymentLinkModule || isPaymentsModule || isOrderStageModule || isMisApprovalModule || isApprovedModule) ? "auto" : "fixed"}
          tableClassName={
            isPaymentLinkModule
              ? "min-w-[2200px]"
              : isPaymentsModule
                ? "min-w-[2200px]"
                : (isOrderStageModule || isMisApprovalModule || isApprovedModule)
                  ? "min-w-[2600px]"
                  : ""
          }
        expandedId={isStudentModule && canUpdateStudent ? expandedId : null}
        rowMenu={
          isStudentModule
            ? (row) => ([
                {
                  label: "Drop student",
                  icon: <Trash2 className="h-4 w-4" />,
                  disabled: !canDeleteStudent,
                  title: canDeleteStudent ? undefined : "Delete access is disabled for this role",
                  onClick: () => setDropTarget(row),
                },
                {
                  label: "Create payment link",
                  icon: <Link2 className="h-4 w-4" />,
                  disabled: !canCreatePaymentLink,
                  title: canCreatePaymentLink ? undefined : "Create access is disabled for this role",
                  onClick: () => openPaymentLink(row),
                },
                canTransferStudent ? {
                  label: "Transfer lead",
                  icon: <RefreshCw className="h-4 w-4" />,
                  disabled: !canUpdateStudent,
                  title: canUpdateStudent ? undefined : "Update access is disabled for this role",
                  onClick: () => setTransferTarget(row),
                } : null,
              ].filter(Boolean))
            : isPaymentLinkModule
              ? (row) => ([
                  {
                    label: "Send Reminder",
                    icon: <Mail className="h-4 w-4" />,
                    disabled: row.paymentLinkStatus === "Paid" || row.paymentLinkStatus === "Cancelled",
                    onClick: () => {
                      alert("Reminder functionality is a placeholder and will be integrated in the next stage.");
                    },
                  },
                  {
                    label: "Cancel Link",
                    icon: <Trash2 className="h-4 w-4" />,
                    disabled: row.paymentLinkStatus === "Paid" || row.paymentLinkStatus === "Cancelled" || !canCreatePaymentLink,
                    title: !canCreatePaymentLink ? "Generate/Cancel payment link access is disabled for this role" : undefined,
                    onClick: () => handleCancelPaymentLink(row),
                  },
                ].filter(Boolean))
              : undefined
        }
        renderExpanded={isStudentModule && canUpdateStudent ? (row) => (
          <div className="border-t border-slate-100 bg-[#FAFBFE] px-4 py-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Student Details</h3>
                <button
                  type="button"
                  onClick={() => setExpandedId(null)}
                  className="text-sm text-slate-400 hover:text-slate-700"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <ExpandField label="Parent Name">
                  <Input
                    value={editDraft.primaryContactName || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, primaryContactName: e.target.value }))}
                  />
                </ExpandField>
                <ExpandField label="Contact Number">
                  <PhoneInput
                    value={editDraft.contactNumber || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, contactNumber: e.target.value }))}
                  />
                </ExpandField>
                <ExpandField label="Email">
                  <Input
                    value={editDraft.email || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                  />
                </ExpandField>
                <ExpandField label="Graduated Branch">
                  <Input
                    value={editDraft.graduatedBranch || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, graduatedBranch: e.target.value }))}
                  />
                </ExpandField>
                <ExpandField label="Graduation Year">
                  <Input
                    value={editDraft.graduationYear || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, graduationYear: e.target.value }))}
                  />
                </ExpandField>
                <ExpandField label="Category">
                  <Select
                    value={editDraft.category || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                  >
                    {[...new Set([...(CATEGORY_OPTIONS || []), editDraft.category].filter(Boolean))].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </ExpandField>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={!canCreatePaymentLink}
                  onClick={() => {
                    if (!canCreatePaymentLink) return;
                    openPaymentLink(row);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:bg-blue-300"
                  title={canCreatePaymentLink ? undefined : "Create access is disabled for this role"}
                >
                  <Link2 className="h-4 w-4 text-white" />
                  Create Payment Link
                </button>
                <button
                  type="button"
                  disabled={!canDeleteStudent}
                  onClick={() => {
                    if (!canDeleteStudent) return;
                    setDropTarget(row);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-red-500 bg-white px-5 py-3 text-sm font-semibold text-red-500 transition-all hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white disabled:hover:text-red-500"
                  title={canDeleteStudent ? undefined : "Delete access is disabled for this role"}
                >
                  <Trash2 className="h-4 w-4" />
                  Drop Student
                </button>
                <Button
                  loading={savingEdit}
                  onClick={() => handleSave(row)}
                  disabled={!canUpdateStudent}
                  title={canUpdateStudent ? undefined : "Update access is disabled for this role"}
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        ) : undefined}
      />

      <Modal open={showPaymentLink} onClose={() => setShowPaymentLink(false)} title="Create Payment Link">
        <div className="space-y-4">
          {paymentLinkStudent && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <Info label="Student" value={paymentLinkStudent.customerName} />
              <Info label="Program" value={paymentLinkStudent.program} />
              <Info label="Unique ID" value={paymentLinkStudent.uniqueId} />
              <Info label="Available" value={money(paymentLinkAvailableBalance)} />
            </div>
          )}
          <Field label="Amount" required>
            <Input value={paymentLinkAmount} onChange={(e) => setPaymentLinkAmount(e.target.value)} type="number" min="0" max={paymentLinkAvailableBalance} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowPaymentLink(false)}>Cancel</Button>
            <Button loading={busy} onClick={confirmPaymentLink} disabled={!canCreatePaymentLink}>
              Generate Link
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(generatedLink)} onClose={() => setGeneratedLink("")} title="Payment Link Ready">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">The payment link is ready. Copy it from here.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input value={generatedLink} readOnly />
            <Button type="button" variant="outline" onClick={copyGeneratedLink} className="sm:min-w-[120px]">
              {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedLink ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setGeneratedLink("")} className="!text-skillit">
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!dropTarget} onClose={() => setDropTarget(null)} title="Drop Student">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This will mark <span className="font-semibold text-slate-800">{dropTarget?.customerName}</span> as dropped.
            The record will stay in MongoDB and remain searchable.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDropTarget(null)}>Cancel</Button>
            <Button loading={busy} variant="danger" onClick={confirmDrop} disabled={!canDeleteStudent}>
              Confirm Drop
            </Button>
          </div>
        </div>
      </Modal>

      <TransferLeadModal
        open={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        student={transferTarget}
        onTransferred={refresh}
      />

      <PaymentDetailsDrawer
        open={!!selectedDrawerPayment}
        payment={selectedDrawerPayment}
        onClose={() => setSelectedDrawerPayment(null)}
        onDownloadReceipt={handleDownloadReceipt}
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value || "—"}</p>
    </div>
  );
}
