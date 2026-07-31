import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, ShieldCheck } from "lucide-react";
import Topbar from "../components/Topbar";
import Button from "../components/Button";
import { Field, Input, Select, Textarea, formatPhoneDisplay, todayDateInputValue } from "../components/Field";
import { getStudent, updateStudent } from "../api/students";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";
import { useModuleConfig } from "../hooks/useModuleConfig";
import { findConfigSection, getFieldItems, getOptionLabels } from "../config/settingsWorkspace";

const CATEGORY_OPTIONS = ["Domain Change", "Upskill", "Career Gap", "Fresher"];

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-display font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Section({ icon, title, children, required }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-skillit">{icon}</span>
        <h2 className="text-xl font-semibold text-slate-800">
          {title}
          {required && <span className="ml-1.5 text-sm font-normal text-red-500">* Required</span>}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function SupportDetailPage({ mode = "onboarding" }) {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Verification checkboxes
  const [checks, setChecks] = useState({});

  // Onboarding form state (so we can read values on submit)
  const [comments, setComments] = useState("");
  const [onboardingDate, setOnboardingDate] = useState("");

  // Orientation form state
  const [orientationDate, setOrientationDate] = useState("");
  const [orientationLink, setOrientationLink] = useState("");
  const [recordedLink, setRecordedLink] = useState("");
  const [internalRemarks, setInternalRemarks] = useState("");
  const [graduatedBranch, setGraduatedBranch] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [extraValues, setExtraValues] = useState({});
  const { config: moduleConfig } = useModuleConfig(mode === "orientation" ? "orientation" : "onboarding");
  const verificationItems = useMemo(() => {
    const section = findConfigSection(moduleConfig?.verifications || [], "Verification");
    return getOptionLabels(section, ["Course Duration Verified", "Payment Details Verified", "Job Assistance Opt-in"]);
  }, [moduleConfig]);

  const onboardingFields = useMemo(() => {
    const section = findConfigSection(moduleConfig?.forms || [], "Onboarding Details");
    return getFieldItems(section, []);
  }, [moduleConfig]);

  const orientationFields = useMemo(() => {
    const section = findConfigSection(moduleConfig?.forms || [], "Orientation Details");
    return getFieldItems(section, []);
  }, [moduleConfig]);

  const canPerformAction =
    mode === "onboarding"
      ? hasPermission(user, "onboarding", "create")
      : mode === "orientation"
        ? hasPermission(user, "orientation", "create")
        : hasPermission(user, "learners", "update");

  useEffect(() => {
    setLoading(true);
    getStudent(id, mode)
      .then((s) => {
        setStudent(s);
        // Pre-fill form with existing values if present
        setComments(s.onboardingComments || "");
        setOnboardingDate(s.onboardingDate || "");
        setOrientationDate(s.orientationDate || "");
        setOrientationLink(s.orientationLink || "");
        setRecordedLink(s.recordedLink || "");
        setInternalRemarks(s.internalRemarks || "");
        setGraduatedBranch(s.graduatedBranch || "");
        setGraduationYear(s.graduationYear || "");
        setExtraValues(s.customFields || {});
      })
      .finally(() => setLoading(false));
  }, [id, mode]);

  useEffect(() => {
    setChecks((current) => {
      const next = {};
      for (const item of verificationItems) {
        next[item] = Boolean(current[item]);
      }
      return next;
    });
  }, [verificationItems]);

  if (loading || !student) {
    return <p className="text-sm text-slate-400">Loading student...</p>;
  }

  const canViewDetails = hasPermission(user, mode, "details");
  if (!canViewDetails) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-6 rounded-2xl shadow-card max-w-md w-full">
          <p className="text-red-500 font-semibold text-lg">Access Denied</p>
          <p className="text-slate-500 text-sm mt-2">You don't have permission to view details for this module.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-4 py-2 bg-skillit text-white font-medium rounded-xl hover:bg-skillit-dark transition-all duration-150"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const subtitle = `Skillit Academy | ${student.contactNumber || "8639191169"} | Program | ${student.program || student.course || "-"}`;
  const showOnboardingSections = mode === "onboarding" || mode === "learners";
  const actionLabel =
    mode === "orientation"
      ? "Complete Orientation"
      : mode === "learners"
        ? "Save Learner Profile"
        : "Submit Onboarding Application";

  // ── Validation for the onboarding mode ──────────────────────────────────────
  function validateOnboardingForm() {
    // Student Details — all are read-only from the database; we just check
    // that the data is present (they should be, but guard anyway).
    const missingStudentDetail =
      !student.customerName ||
      !student.contactNumber ||
      !student.email;

    if (missingStudentDetail) {
      return "Student Details are incomplete. Please update the student record first.";
    }

    // Verification — all 3 checkboxes must be checked
    if (verificationItems.some((item) => !checks[item])) {
      return "Please check all verification items before submitting.";
    }

    // Verification Comments — required
    if (!comments.trim()) {
      return "Verification Comments are required.";
    }

    // Onboarding Date — required
    if (!onboardingDate) {
      return "Onboarding Date is required.";
    }

    return null; // no errors
  }

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setValidationError("");

    if (mode === "onboarding") {
      const error = validateOnboardingForm();
      if (error) {
        setValidationError(error);
        // Scroll to the error banner
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setSaving(true);
      try {
        await updateStudent(student.id, {
          onboardingSubmitted: true,
          onboardingComments: comments.trim(),
          onboardingDate,
          graduatedBranch: graduatedBranch.trim(),
          graduationYear: graduationYear.trim(),
          customFields: extraValues,
          // Persist orientation fields if already entered
          orientationLink: orientationLink.trim() || student.orientationLink || "",
          recordedLink: recordedLink.trim() || student.recordedLink || "",
          internalRemarks: internalRemarks.trim() || student.internalRemarks || "",
        }, mode);
        // After submit → student disappears from onboarding list (backend filter
        // now excludes onboardingSubmitted: true). Navigate back to the list.
        navigate("/onboarding");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === "orientation") {
      setSaving(true);
      try {
        await updateStudent(student.id, {
          orientationCompleted: true,
          orientationDate,
          orientationLink: orientationLink.trim(),
          recordedLink: recordedLink.trim(),
          internalRemarks: internalRemarks.trim(),
          customFields: extraValues,
        }, mode);
        navigate("/learners");
      } finally {
        setSaving(false);
      }
      return;
    }

    alert(`${actionLabel} (demo).`);
  };

  return (
    <div>
      <Topbar
        left={(
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mr-1 grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        title={student.customerName}
        subtitle={subtitle}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Net Payable" value={Number(student.saleValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          <Stat label="Paid Amount" value={Number(student.paidAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          <Stat label="Outstanding" value={Number(student.outstanding || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
        </div>
      </div>

      {/* Validation error banner */}
      {validationError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>⚠ Please fix the following:</strong> {validationError}
        </div>
      )}

      <div className="space-y-4" ref={formRef}>

        {/* ── 1. Student Details (required) ─────────────────────────────── */}
        <Section
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Student Details"
          required={mode === "onboarding"}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Full Name" required={mode === "onboarding"}>
              <Input value={student.customerName || ""} readOnly />
            </Field>
            <Field label="Phone Number" required={mode === "onboarding"}>
              <Input value={formatPhoneDisplay(student.contactNumber)} readOnly />
            </Field>
            <Field label="WhatsApp Number" required={mode === "onboarding"}>
              <Input value={formatPhoneDisplay(student.altContactNumber || student.contactNumber)} readOnly />
            </Field>
            <Field label="Email Address" required={mode === "onboarding"}>
              <Input value={student.email || ""} readOnly />
            </Field>
            <Field label="Graduated In / Branch" required={mode === "onboarding"}>
              <Input
                value={graduatedBranch}
                onChange={(e) => setGraduatedBranch(e.target.value)}
                placeholder="e.g. B.Tech – Computer Science"
                required={mode === "onboarding"}
              />
            </Field>
            <Field label="Graduation Year" required={mode === "onboarding"}>
              <Input
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                placeholder="e.g. 2023"
                inputMode="numeric"
                maxLength={4}
                required={mode === "onboarding"}
              />
            </Field>
            <Field label="Category" required={mode === "onboarding"}>
              <Select value={student.category || ""} disabled className="opacity-100">
                {[...new Set([...(CATEGORY_OPTIONS || []), student.category].filter(Boolean))].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Course" required={mode === "onboarding"}>
              <Input value={student.course || student.program || ""} readOnly />
            </Field>
            <Field label="Batch" required={mode === "onboarding"}>
              <Input value={student.batch || ""} readOnly />
            </Field>
          </div>
        </Section>

        {/* ── 2. Verification (required in onboarding mode) ─────────────── */}
        {showOnboardingSections && (
          <Section
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Verification"
            required={mode === "onboarding"}
          >
            <div className="space-y-4">
              {/* Checkboxes — all 3 must be ticked */}
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                {verificationItems.map((label) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(checks[label])}
                      onChange={(e) => setChecks((c) => ({ ...c, [label]: e.target.checked }))}
                      className="h-4 w-4 rounded accent-skillit"
                    />
                    <span>
                      {label}
                      {mode === "onboarding" && <span className="ml-1 text-red-500">*</span>}
                    </span>
                  </label>
                ))}
              </div>

              {mode === "onboarding" && verificationItems.some((label) => !checks[label]) && (
                <p className="text-xs text-amber-600">
                  All verification items must be checked before submission.
                </p>
              )}

              <Field label="Comments" required={mode === "onboarding"}>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter verification comments..."
                  required={mode === "onboarding"}
                />
              </Field>
            </div>
          </Section>
        )}

        {/* ── 3. Onboarding Details (required in onboarding mode) ───────── */}
        {showOnboardingSections && (
          <Section
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Onboarding Details"
            required={mode === "onboarding"}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Onboarding Date" required={mode === "onboarding"}>
                <Input
                  type="date"
                  max={todayDateInputValue()}
                  value={onboardingDate}
                  onChange={(e) => setOnboardingDate(e.target.value)}
                  required={mode === "onboarding"}
                />
              </Field>
              <Field label="Call Recording Upload">
                <input
                  type="file"
                  accept=".mp3,.wav"
                  className="text-sm text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-400">Optional · Accepted formats: .mp3, .wav</p>
              </Field>
            </div>
          </Section>
        )}

        {/* ── Orientation Details ───────────────────────────────────────── */}
        <Section icon={<ShieldCheck className="h-5 w-5" />} title="Orientation Details">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Orientation Date">
              <Input
                type="date"
                max={todayDateInputValue()}
                value={orientationDate}
                onChange={(e) => setOrientationDate(e.target.value)}
              />
            </Field>
            <Field label="Orientation Link">
              <Input
                type="url"
                placeholder="https://meeting-link.com"
                value={orientationLink}
                onChange={(e) => setOrientationLink(e.target.value)}
              />
            </Field>
            <Field label="Recorded Link">
              <Input
                type="url"
                placeholder="https://meeting-link.com"
                value={recordedLink}
                onChange={(e) => setRecordedLink(e.target.value)}
              />
            </Field>
            <div className="md:col-span-3">
              <Field label="Internal Remarks">
                <Textarea
                  placeholder="Add private notes for coordinators..."
                  value={internalRemarks}
                  onChange={(e) => setInternalRemarks(e.target.value)}
                />
              </Field>
            </div>
          </div>
          {orientationFields.length > 0 && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {orientationFields.map((field) => {
                const key = `orientation_${field.key}`;
                return (
                  <Field key={field.key} label={field.name} required={field.required}>
                    <Input
                      value={extraValues[key] || ""}
                      onChange={(e) => setExtraValues((current) => ({ ...current, [key]: e.target.value }))}
                      placeholder={field.name}
                    />
                  </Field>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          loading={saving}
          disabled={!canPerformAction}
          title={canPerformAction ? undefined : "Create access is disabled for this role"}
          onClick={handleSubmit}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
