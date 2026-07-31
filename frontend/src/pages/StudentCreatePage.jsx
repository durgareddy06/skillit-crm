import React, { useEffect, useState } from "react";
import { ChevronLeft, Link2, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import Button from "../components/Button";
import { Field, Input, PhoneInput, Select } from "../components/Field";
import { createStudent, generatePaymentLink, updateStudent } from "../api/students";
import { useAuth } from "../context/AuthContext";
import { canUsePermission } from "../lib/permissions";
import CustomFieldsForm from "../components/settings/CustomFieldsForm";
import { useModuleActionFields } from "../hooks/useModuleActionFields";
import { useModuleConfig } from "../hooks/useModuleConfig";
import { findConfigSection, getOptionLabels } from "../config/settingsWorkspace";

const PROGRAMS = ["Data Science and Data Analytics", "Full Stack Development", "UI/UX Design"];
const BATCHES = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"];
const CATEGORY_OPTIONS = ["Domain Change", "Upskill", "Career Gap", "Fresher"];

const EMPTY_FORM = {
  customerName: "",
  primaryContactName: "",
  email: "",
  contactNumber: "",
  altContactNumber: "",
  batch: "",
  program: "",
  category: "Fresher",
  courseFee: "",
};

export default function StudentCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [createdStudent, setCreatedStudent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [linkAmount, setLinkAmount] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [customFields, setCustomFields] = useState({});
  const { fields: customFieldDefs, loading: customFieldsLoading } = useModuleActionFields("student", "create-student");
  const { config: studentConfig } = useModuleConfig("student");
  const canCreateStudent = canUsePermission(user, "student", "create");
  const canUpdateStudent = canUsePermission(user, "student", "update");
  const canCreatePaymentLink = canUsePermission(user, "payment-link", "create");
  const isReadOnly = !canCreateStudent;

  useEffect(() => {
    setCustomFields((current) => {
      const next = { ...current };
      let changed = false;
      for (const field of customFieldDefs) {
        if (next[field.key] === undefined) {
          next[field.key] = field.type === "number" ? 0 : "";
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [customFieldDefs]);

  const dropdownSections = studentConfig?.dropdowns || [];
  const categoryOptions = getOptionLabels(findConfigSection(dropdownSections, "Category"), CATEGORY_OPTIONS);
  const programOptions = getOptionLabels(findConfigSection(dropdownSections, "Program"), PROGRAMS);
  const batchOptions = getOptionLabels(findConfigSection(dropdownSections, "Batch"), BATCHES);

  if (isReadOnly) {
    return (
      <div className="min-h-[calc(100vh-2rem)] flex flex-col">
        <Topbar
          title="Create Student"
          subtitle="Skillit Academy"
          left={(
            <button
              type="button"
              onClick={() => navigate("/student")}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        />

        <div className="flex-1 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Read-only access</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            This role cannot create students. The permissions in Manage Roles need to be turned on before this page can save changes.
          </p>
        </div>
      </div>
    );
  }

  const updateField = (key) => (e) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const handleSave = async (arg) => {
    if (arg?.preventDefault) arg.preventDefault();
    if (!createdStudent?.id && !canCreateStudent) return;
    if (createdStudent?.id && !canUpdateStudent) return;
    setSaving(true);
    setError("");
    try {
      const saleValue = Number(form.courseFee || 0);
      const payload = {
        ...form,
        customFields,
        saleValue,
      };
      if (createdStudent?.id) {
        const reservedLinkAmount = Array.isArray(createdStudent.paymentLinks) && createdStudent.paymentLinks.length > 0
          ? createdStudent.paymentLinks.reduce((sum, link) => sum + (Number(link.amount) || 0), 0)
          : createdStudent.paymentLinkGenerated
            ? Number(createdStudent.paymentLinkAmount || 0)
            : 0;
        payload.outstanding = Math.max(
          0,
          saleValue - Number(createdStudent.discount || 0) - Number(createdStudent.paidAmount || 0) - reservedLinkAmount
        );
        const updated = await updateStudent(createdStudent.id, payload, "student");
        setCreatedStudent(updated);
      } else {
        payload.paidAmount = 0;
        payload.outstanding = saleValue;
        const created = await createStudent(payload);
        setCreatedStudent(created);
        if (!linkAmount) {
          setLinkAmount(String(created.saleValue || form.courseFee || 0));
        }
      }
    } catch {
      setError("Couldn't save the student. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!createdStudent?.id) {
      setLinkError("Please save the student first.");
      return;
    }
    if (!canCreatePaymentLink) {
      setLinkError("Payment link access is disabled for this role.");
      return;
    }
    const maxAmount = Number(createdStudent.saleValue || form.courseFee || 0);
    const requestedAmount = Number(linkAmount || maxAmount);
    if (requestedAmount <= 0) {
      setLinkError("Payment link amount must be greater than zero.");
      return;
    }
    if (requestedAmount > maxAmount) {
      setLinkError("Payment link amount cannot exceed the net payable fee.");
      return;
    }
    setLinkSaving(true);
    setLinkError("");
    try {
      const updated = await generatePaymentLink(createdStudent.id, requestedAmount);
      navigate("/payment-link", { state: { generatedLink: updated.paymentLinkUrl || "" } });
    } catch {
      setLinkError("Couldn't generate the payment link.");
    } finally {
      setLinkSaving(false);
    }
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setCreatedStudent(null);
    setLinkAmount("");
    setError("");
    setLinkError("");
    setCustomFields({});
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] flex flex-col">
      <Topbar
        title="Create Student"
        subtitle="Skillit Academy"
        left={
          <button
            type="button"
            onClick={() => navigate("/student")}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        }
      />

      <div className="flex-1 space-y-4 pb-24">
        {createdStudent && (
          <p className="text-center text-lg font-semibold text-emerald-600">Successfully Added</p>
        )}
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-blue-600">
              <UserPlus className="h-4 w-4" />
              <h2 className="text-lg font-semibold">Basic details</h2>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Student Name" required>
                <Input value={form.customerName} onChange={updateField("customerName")} placeholder="Enter full name" required disabled={!!createdStudent} />
              </Field>
              <Field label="Parent Name" required>
                <Input value={form.primaryContactName} onChange={updateField("primaryContactName")} placeholder="Contact person name" required disabled={!!createdStudent} />
              </Field>
              <Field label="Student Email" required>
                <Input value={form.email} onChange={updateField("email")} type="email" placeholder="example@email.com" required disabled={!!createdStudent} />
              </Field>
              <Field label="Student Phone" required>
                <PhoneInput value={form.contactNumber} onChange={updateField("contactNumber")} placeholder="00000 00000" required disabled={!!createdStudent} />
              </Field>
              <Field label="Alternative Number" required>
                <PhoneInput value={form.altContactNumber} onChange={updateField("altContactNumber")} placeholder="00000 00000" required disabled={!!createdStudent} />
              </Field>
              <Field label="Program" required>
                <Select value={form.program} onChange={updateField("program")} required disabled={!!createdStudent}>
                  <option value="" disabled>
                    Select program
                  </option>
                  {programOptions.map((program) => (
                    <option key={program} value={program}>
                      {program}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Batch" required>
                <Select value={form.batch} onChange={updateField("batch")} required disabled={!!createdStudent}>
                  <option value="" disabled>
                    Select batch
                  </option>
                  {batchOptions.map((batch) => (
                    <option key={batch} value={batch}>
                      {batch}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category" required>
                <Select value={form.category} onChange={updateField("category")} required disabled={!!createdStudent}>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Course Fee" required>
                <Input value={form.courseFee} onChange={updateField("courseFee")} type="number" min="0" placeholder="0" required disabled={!!createdStudent} />
              </Field>
            </div>
            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}
            <div className="mt-6 flex justify-end">
              {!createdStudent && (
                <Button
                  type="submit"
                  loading={saving}
                  className="min-w-[120px]"
                  disabled={!canCreateStudent}
                >
                  Add Student
                </Button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-slate-800">Generate Payment Link</h2>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:max-w-2xl">
            <Field label="Amount" required>
              <Input
                value={linkAmount}
                onChange={(e) => setLinkAmount(e.target.value)}
                type="number"
                min="0"
                max={Number(createdStudent?.saleValue || form.courseFee || 0) || undefined}
                placeholder="Amount"
                disabled={!createdStudent}
              />
            </Field>
            <Button
              type="button"
              onClick={handleGenerate}
              loading={linkSaving}
              className="md:min-w-[132px]"
              disabled={!createdStudent || !canCreatePaymentLink}
            >
              <Link2 className="h-4 w-4" /> Generate
            </Button>
          </div>
          {linkError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{linkError}</p>}
          {createdStudent && <p className="mt-4 text-sm text-emerald-700">Student saved. Generate the payment link now.</p>}
        </section>

        <CustomFieldsForm
          fields={customFieldDefs}
          value={customFields}
          onChange={setCustomFields}
          disabled={!!createdStudent}
          title="Custom Fields"
          loading={customFieldsLoading}
        />
      </div>

      <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              navigate("/student");
            }}
            className="min-w-[150px]"
          >
            Discard Student
          </Button>
        </div>
      </div>

    </div>
  );
}
