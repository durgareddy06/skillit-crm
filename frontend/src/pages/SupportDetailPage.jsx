import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, ShieldCheck } from "lucide-react";
import Topbar from "../components/Topbar";
import Button from "../components/Button";
import { Field, Input, Select, Textarea, formatPhoneDisplay, todayDateInputValue } from "../components/Field";
import { getStudent, updateStudent } from "../api/students";

const CATEGORY_OPTIONS = ["Domain Change", "Upskill", "Career Gap", "Fresher"];

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-display font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-skillit">{icon}</span>
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function SupportDetailPage({ mode = "onboarding" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState({ duration: false, payment: false, jobAssist: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getStudent(id)
      .then(setStudent)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !student) {
    return <p className="text-sm text-slate-400">Loading student...</p>;
  }

  const subtitle = `Skillit Academy | ${student.contactNumber || "8639191169"} | Program | ${student.program || student.course || "-"}`;
  const showOnboardingSections = mode === "onboarding" || mode === "learners";
  const actionLabel =
    mode === "orientation"
      ? "Complete Orientation"
      : mode === "learners"
        ? "Save Learner Profile"
        : "Submit Onboarding Application";

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

      <div className="space-y-4">
        <Section icon={<ShieldCheck className="h-5 w-5" />} title="Student Details">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Full Name">
              <Input value={student.customerName || ""} readOnly />
            </Field>
            <Field label="Phone Number">
              <Input value={formatPhoneDisplay(student.contactNumber)} readOnly />
            </Field>
            <Field label="WhatsApp Number">
              <Input value={formatPhoneDisplay(student.altContactNumber || student.contactNumber)} readOnly />
            </Field>
            <Field label="Email Address">
              <Input value={student.email || ""} readOnly />
            </Field>
            <Field label="Graduated In / Branch">
              <Input value={student.graduatedBranch || ""} readOnly />
            </Field>
            <Field label="Graduation Year">
              <Input value={student.graduationYear || ""} readOnly />
            </Field>
            <Field label="Category">
              <Select value={student.category || ""} disabled className="opacity-100">
                {[...new Set([...(CATEGORY_OPTIONS || []), student.category].filter(Boolean))].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Course">
              <Input value={student.course || student.program || ""} readOnly />
            </Field>
            <Field label="Batch">
              <Input value={student.batch || ""} readOnly />
            </Field>
          </div>
        </Section>

        {showOnboardingSections && (
          <Section icon={<ShieldCheck className="h-5 w-5" />} title="Verification">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                {[
                  ["duration", "Course Duration Verified"],
                  ["payment", "Payment Details Verified"],
                  ["jobAssist", "Job Assistance Opt-in"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checks[key]}
                      onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
                      className="h-4 w-4 rounded accent-skillit"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <Field label="Comments" required>
                <Textarea placeholder="Enter verification comments..." required />
              </Field>
            </div>
          </Section>
        )}

        {showOnboardingSections && (
          <Section icon={<ShieldCheck className="h-5 w-5" />} title="Onboarding Details">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Onboarding Date">
                <Input type="date" max={todayDateInputValue()} />
              </Field>
              <Field label="Call Recording Upload">
                <input type="file" accept=".mp3,.wav" className="text-sm text-slate-500" />
              </Field>
            </div>
          </Section>
        )}

        <Section icon={<ShieldCheck className="h-5 w-5" />} title="Orientation Details">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Orientation Date">
              <Input type="date" max={todayDateInputValue()} />
            </Field>
            <Field label="Orientation Link">
              <Input type="url" placeholder="https://meeting-link.com" />
            </Field>
            <Field label="Recorded Link">
              <Input type="url" placeholder="https://meeting-link.com" />
            </Field>
            <div className="md:col-span-3">
              <Field label="Internal Remarks">
                <Textarea placeholder="Add private notes for coordinators..." />
              </Field>
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          loading={saving}
          onClick={async () => {
            if (mode === "onboarding") {
              setSaving(true);
              try {
                await updateStudent(student.id, {
                  onboardingSubmitted: true,
                  onboardingComments: student.onboardingComments || "",
                  onboardingDate: student.onboardingDate || "",
                  orientationLink: student.orientationLink || "",
                  recordedLink: student.recordedLink || "",
                  internalRemarks: student.internalRemarks || "",
                });
                navigate("/orientation");
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
                });
                navigate("/learners");
              } finally {
                setSaving(false);
              }
              return;
            }

            alert(`${actionLabel} (demo).`);
          }}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
