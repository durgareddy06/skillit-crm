import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, X } from "lucide-react";
import Topbar from "../components/Topbar";
import Button from "../components/Button";
import { Field, Input, PhoneInput, Select, formatPhoneDisplay, fromDateInputValue, todayDateInputValue } from "../components/Field";
import CustomFieldsForm from "../components/settings/CustomFieldsForm";
import { enrollStudent, getStudent, punchOrder, listAllUsers } from "../api/students";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";
import { useModuleConfig } from "../hooks/useModuleConfig";
import { useModuleActionFields } from "../hooks/useModuleActionFields";
import { findConfigSection, getOptionLabels } from "../config/settingsWorkspace";

// ─── Static dropdown options ──────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  "Fresher",
  "Working Professional",
  "Career Break",
  "Student",
  "Other",
];

const COURSE_OPTIONS = [
  "Data Science and Data Analytics (DADS)",
  "Full Stack Development (FSD)",
  "UI/UX Design",
  "Business Analytics",
  "Cloud Computing",
  "Digital Marketing",
  "Cyber Security",
  "Artificial Intelligence & ML",
];

const PROGRAM_OPTIONS = [
  "Data Science and Data Analytics",
  "Full Stack Development (FSD)",
  "UI/UX Design",
];

const BATCH_OPTIONS = [
  "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10",
  "B11", "B12", "B13", "B14", "B15", "B16", "B17", "B18", "B19", "B20",
];

const PAYMENT_MODE_OPTIONS = [
  "Not Yet Decided",
  "Cash",
  "Swipe",
  "Bank Transactions",
  "Shopee",
  "FEEMONK",
  "FullPayment",
  "2Shot Payment",
  "JODO Flex",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the billing cycle from a date string (YYYY-MM-DD or DD-MM-YYYY).
 *  - Days 1–15  → Cycle 1
 *  - Days 16–31 → Cycle 2
 * Falls back to cycle 1 when the date can't be parsed.
 */
function cycleFromDate(dateStr) {
  if (!dateStr) return 1;
  // Try YYYY-MM-DD (HTML date input format)
  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const day = parseInt(isoMatch[3], 10);
    return day >= 1 && day <= 15 ? 1 : 2;
  }
  // Try DD-MM-YYYY (legacy stored format)
  const legacyMatch = String(dateStr).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (legacyMatch) {
    const day = parseInt(legacyMatch[1], 10);
    return day >= 1 && day <= 15 ? 1 : 2;
  }
  return 1;
}

/** Month name from a date string, e.g. "JUL-26" */
function monthFromDate(dateStr) {
  if (!dateStr) return "";
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const month = parseInt(isoMatch[2], 10) - 1;
    const year = String(isoMatch[1]).slice(-2);
    return `${MONTHS[month]}-${year}`;
  }
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentPunchOrderPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const context = params.get("context");

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // All active users for "Demo Done By" dropdown
  const [allUsers, setAllUsers] = useState([]);

  // Selected date drives cycle & month auto-fill
  const today = todayDateInputValue(); // YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(today);
  const [cycle, setCycle] = useState(cycleFromDate(today));
  const [month, setMonth] = useState(monthFromDate(today));
  const { config: studentConfig } = useModuleConfig("student");
  const { fields: punchOrderFields, loading: punchOrderFieldsLoading } = useModuleActionFields("student", "punch-order");
  const [customFields, setCustomFields] = useState({});

  const refresh = useCallback(() => {
    setLoading(true);
    getStudent(id, context || "student").then(setStudent).finally(() => setLoading(false));
  }, [id, context]);

  useEffect(() => {
    refresh();
    listAllUsers().then(setAllUsers).catch(() => setAllUsers([]));
  }, [refresh]);

  // Initialise date/cycle/month once the student record arrives
  useEffect(() => {
    if (!student) return;
    // Default to today (SDE filling the form now)
    const initDate = today;
    setSelectedDate(initDate);
    setCycle(cycleFromDate(initDate));
    setMonth(monthFromDate(initDate));
    setCustomFields(student.customFields || {});
  }, [student, today]);

  const dropdownSections = studentConfig?.dropdowns || [];
  const categoryOptions = getOptionLabels(findConfigSection(dropdownSections, "Category"), CATEGORY_OPTIONS);
  const courseOptions = getOptionLabels(findConfigSection(dropdownSections, "Course"), COURSE_OPTIONS);
  const batchOptions = getOptionLabels(findConfigSection(dropdownSections, "Batch"), BATCH_OPTIONS);
  const paymentModeOptions = getOptionLabels(findConfigSection(dropdownSections, "Payment Mode"), PAYMENT_MODE_OPTIONS);
  const leadSourceOptions = getOptionLabels(findConfigSection(dropdownSections, "Lead Source"), [
    "Website",
    "Referral",
    "Social Media",
    "Walk-in",
    "Email Campaign",
    "Other",
  ]);

  const handleDateChange = (e) => {
    const val = e.target.value; // YYYY-MM-DD
    setSelectedDate(val);
    setCycle(cycleFromDate(val));
    setMonth(monthFromDate(val));
  };

  if (loading || !student) {
    return <p className="text-sm text-slate-400">Loading student...</p>;
  }

  const isEnrollmentAction = context === "pending";
  const contextKey = (context && context !== "detail") ? context : "student";
  const allowedHere = isEnrollmentAction
    ? hasPermission(user, "pending", "create")
    : hasPermission(user, contextKey, "create");

  // ── Duplicate-action guard ──────────────────────────────────────────────────
  // If order is already punched (for punch-order) or student is already
  // enrolled (for enrollment), show a read-only status badge instead of the form.
  const alreadyPunched = !isEnrollmentAction && student.orderPunched;
  const alreadyEnrolled = isEnrollmentAction && student.status === "Enrolled";

  if (alreadyPunched || alreadyEnrolled) {
    const statusLabel = alreadyEnrolled ? "Enrolled" : "Order Punched";
    const statusDate = alreadyEnrolled
      ? student.enrolledAt || student.date
      : student.orderPunchedAt || student.date;
    return (
      <div>
        <Topbar
          left={(
            <button
              type="button"
              onClick={() => navigate(`/student/${student.id}${context ? `?context=${context}` : ""}`)}
              className="mr-1 grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          title={student.customerName}
          subtitle={`Skillit Academy | ${formatPhoneDisplay(student.contactNumber)} | Program | ${student.program || student.course || "-"}`}
          subtitleExtras={(
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-white/90 data-font">
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" /> {formatPhoneDisplay(student.contactNumber)}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> {student.email || "-"}
              </span>
            </div>
          )}
        />
        <div className="mx-auto mt-8 max-w-[600px] rounded-2xl border border-slate-100 bg-white p-8 shadow-card text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50">
            <svg className="h-8 w-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white">
            {statusLabel}
          </span>
          <p className="mt-4 text-sm text-slate-500">
            {alreadyEnrolled
              ? `${student.customerName} has already been enrolled and cannot be enrolled again.`
              : `${student.customerName}'s order has already been punched and cannot be punched again.`}
          </p>
          {statusDate && (
            <p className="mt-1 text-xs text-slate-400">Completed on {statusDate}</p>
          )}
          <div className="mt-6">
            <Button
              variant="outline"
              onClick={() => navigate(`/student/${student.id}${context ? `?context=${context}` : ""}`)}
            >
              ← Back to Student
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!allowedHere) {
    return (
      <div>
        <Topbar
          title={student.customerName}
          subtitle={`Skillit Academy | ${formatPhoneDisplay(student.contactNumber)} | Program | ${student.program || student.course || "-"}`}
          subtitleExtras={(
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-white/90 data-font">
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" /> {formatPhoneDisplay(student.contactNumber)}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> {student.email || "-"}
              </span>
            </div>
          )}
        />
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          You don't have permission to {isEnrollmentAction ? "push students to enrollments" : "punch orders"} for this account.
        </div>
      </div>
    );
  }

  const goBack = () => {
    navigate(`/student/${student.id}${context ? `?context=${context}` : ""}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const managerValue = user?.reportingManagerName || student.manager || "";
    const sdeValue = user?.name || student.sdeName || "";
    const payload = {
      customerName: f.get("customerName"),
      primaryContactName: f.get("primaryContactName"),
      contactNumber: f.get("contactNumber"),
      altContactNumber: f.get("altContactNumber"),
      email: f.get("email"),
      category: f.get("category"),
      batch: f.get("batch"),
      date: fromDateInputValue(f.get("date")),
      cycle: Number(f.get("cycle")),
      program: f.get("course"),
      course: f.get("course"),
      quarter: f.get("quarter"),
      month: f.get("month"),
      sdeName: sdeValue,
      demoDoneBy: f.get("demoDoneBy"),
      salesType: f.get("salesType"),
      leadSource: f.get("leadSource"),
      leadLink: f.get("leadLink"),
      saleValue: f.get("saleValue"),
      paidAmount: f.get("paidAmount"),
      outstanding: f.get("outstanding"),
      officeVisit: f.get("officeVisit"),
      paymentMode: f.get("paymentMode"),
      customFields,
      manager: managerValue,
      reportedTo: managerValue,
    };
    setSaving(true);
    try {
      if (context === "pending") {
        await enrollStudent(student.id, payload);
        navigate("/pending");
      } else {
        await punchOrder(student.id, payload);
        navigate("/booked-orders");
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedCourse = student.course || student.program || "";
  const selectedBatch = student.batch || "";
  const selectedCategory = student.category || "";
  const isEnrollmentContext = context === "pending";
  const formTitle = isEnrollmentContext ? "Push to Enrollments Form" : "Punch an Order Form";
  const submitLabel = isEnrollmentContext ? "Enroll" : "Punch an order";
  const closeLabel = isEnrollmentContext ? "Close enrollments form" : "Close punch order form";

  // Logged-in user's name & manager (read-only, locked until team changes)
  const sdeName = user?.name || student.sdeName || "";
  const managerName = user?.reportingManagerName || student.manager || "";

  return (
    <div>
      <Topbar
        left={(
          <button
            type="button"
            onClick={goBack}
            className="mr-1 grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        title={student.customerName}
        subtitle={`Skillit Academy | ${formatPhoneDisplay(student.contactNumber)} | Program | ${student.program || student.course || "-"}`}
        subtitleExtras={(
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-white/90 data-font">
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> {formatPhoneDisplay(student.contactNumber)}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" /> {student.email || "-"}
            </span>
          </div>
        )}
      />

      <div className="mb-6 pt-4">
        <div className="mx-auto max-w-[1080px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[34px] border border-slate-100 bg-[#3C83C6] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] md:p-5"
          >
            <div className="rounded-[28px] bg-white px-5 py-5 md:px-8 md:py-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="mt-1.5 h-11 w-3 rounded-full bg-skillit" />
                  <h3 className="text-2xl font-semibold text-slate-800">{formTitle}</h3>
                </div>
                <button
                  type="button"
                  onClick={goBack}
                  className="grid h-8 w-8 place-items-center rounded-full bg-black text-white transition-colors hover:bg-slate-800"
                  aria-label={closeLabel}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">

                {/* ── Student Details ─────────────────────────────────────── */}
                <Field label="Customer Name" required>
                  <Input name="customerName" defaultValue={student.customerName || ""} placeholder="Enter Customer full name" required />
                </Field>
                <Field label="Primary Contact Name" required>
                  <Input name="primaryContactName" defaultValue={student.primaryContactName || student.customerName || ""} placeholder="Enter contact name" required />
                </Field>

                <Field label="Primary Contact Number" required>
                  <PhoneInput name="contactNumber" defaultValue={student.contactNumber || ""} placeholder="00000 00000" required />
                </Field>
                <Field label="Alternative Contact Number" required>
                  <PhoneInput name="altContactNumber" defaultValue={student.altContactNumber || ""} placeholder="00000 00000" required />
                </Field>

                {/* ── 1. Category — dropdown ───────────────────────────────── */}
                <Field label="Category">
                  <Select name="category" defaultValue={selectedCategory || categoryOptions[0] || ""}>
                    <option value="" disabled>Select Category</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Primary Contact Email" required>
                  <Input name="email" defaultValue={student.email || ""} placeholder="example@email.com" required />
                </Field>

                {/* ── 2. Batch — dropdown ──────────────────────────────────── */}
                <Field label="Batch" required>
                  <Select name="batch" defaultValue={selectedBatch || ""} required>
                    <option value="" disabled>Select Batch</option>
                    {batchOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </Select>
                </Field>

                {/* ── 2. Course — dropdown ─────────────────────────────────── */}
                <Field label="Course" required>
                  <Select name="course" defaultValue={selectedCourse || ""} required>
                    <option value="" disabled>Select Course</option>
                    {courseOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {/* Preserve any existing value not in the predefined list */}
                    {selectedCourse && !courseOptions.includes(selectedCourse) && (
                      <option value={selectedCourse}>{selectedCourse}</option>
                    )}
                  </Select>
                </Field>

                {/* ── 4. Date — default today (read by SDE right now) ─────── */}
                <Field label="DATE" required>
                  <Input
                    name="date"
                    type="date"
                    max={todayDateInputValue()}
                    value={selectedDate}
                    onChange={handleDateChange}
                    required
                  />
                </Field>
                <Field label="Quarter" required>
                  <Input name="quarter" type="number" defaultValue={student.quarter || 1} placeholder="1" required />
                </Field>

                {/* ── 5. Cycle — auto from date (1-15 → 1, 16-31 → 2) ───── */}
                <Field label="CYCLE" required>
                  <Input
                    name="cycle"
                    type="number"
                    value={cycle}
                    onChange={(e) => setCycle(Number(e.target.value))}
                    min={1}
                    max={2}
                    required
                  />
                </Field>

                {/* Month auto-fills from date */}
                <Field label="Month" required>
                  <Input
                    name="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    placeholder="JUL-26"
                    required
                  />
                </Field>

                {/* ── 6. SDE Name — locked to logged-in user ──────────────── */}
                <Field label="SDE Name" required>
                  <Input
                    name="sdeName"
                    value={sdeName}
                    readOnly
                    required
                    className="cursor-not-allowed bg-slate-100 text-slate-500"
                    title="Auto-filled from your profile. Change your team to update."
                  />
                </Field>

                {/* ── 6. Manager — locked (from user's reporting manager) ─── */}
                <Field label="MANAGER" required>
                  <Input
                    name="manager"
                    value={managerName}
                    readOnly
                    required
                    className="cursor-not-allowed bg-slate-100 text-slate-500"
                    title="Auto-filled from your team assignment. Change your team to update."
                  />
                </Field>

                {/* ── 7. Demo Done By — all users dropdown ────────────────── */}
                <Field label="Demo Done by" required>
                  <Select name="demoDoneBy" defaultValue={student.demoDoneBy || ""} required>
                    <option value="" disabled>Select who did the demo</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}{u.designation ? ` (${u.designation})` : ""}
                      </option>
                    ))}
                    {/* Fallback: preserve stored value if user no longer active */}
                    {student.demoDoneBy && !allUsers.find((u) => u.name === student.demoDoneBy) && (
                      <option value={student.demoDoneBy}>{student.demoDoneBy}</option>
                    )}
                  </Select>
                </Field>

                <Field label="SALES TYPE">
                  <Select name="salesType" defaultValue={student.salesType || "International"}>
                    <option value="International">International</option>
                    <option value="Domestic">Domestic</option>
                  </Select>
                </Field>

                {/* ── 3. Payment Mode — dropdown ──────────────────────────── */}
                <Field label="PAYMENT MODE" required>
                  <Select name="paymentMode" defaultValue={student.paymentMode || ""} required>
                    <option value="" disabled>Select Payment Mode</option>
                    {paymentModeOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Sale Value" required>
                  <Input name="saleValue" type="number" defaultValue={student.saleValue || 70000} placeholder="70,000.00" required />
                </Field>

                <Field label="Outstanding Amount" required>
                  <Input name="outstanding" type="number" defaultValue={student.outstanding || 0} placeholder="35,000.00" required />
                </Field>
                <Field label="Paid Amount" required>
                  <Input name="paidAmount" type="number" defaultValue={student.paidAmount || 0} placeholder="35,000.00" required />
                </Field>

                <Field label="LEAD SOURCE" required>
                  <Select name="leadSource" defaultValue={student.leadSource || leadSourceOptions[0] || ""} required>
                    <option value="" disabled>Select lead source</option>
                    {leadSourceOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="LEAD LINK" required>
                  <Input name="leadLink" defaultValue={student.leadLink || ""} placeholder="https://..." required />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Office Visit" required>
                    <div className="flex items-center gap-4 pt-1 text-sm text-slate-600">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="officeVisit" value="Yes" defaultChecked={student.officeVisit === "Yes"} />
                        Yes
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="officeVisit" value="No" defaultChecked={student.officeVisit !== "Yes"} />
                        No
                      </label>
                    </div>
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <CustomFieldsForm
                    fields={punchOrderFields}
                    value={customFields}
                    onChange={setCustomFields}
                    loading={punchOrderFieldsLoading}
                    title="Punch Order Fields"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={goBack} className="min-w-[110px] !bg-white">
                Cancel
              </Button>
              <Button type="submit" loading={saving} className="min-w-[150px]">
                {submitLabel}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
