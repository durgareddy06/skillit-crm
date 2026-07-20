import React, { useEffect, useMemo, useState } from "react";
import { Link2, UserPlus } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import { Field, Input, PhoneInput, Select } from "./Field";
import { createStudent, generatePaymentLink } from "../api/students";

const PROGRAMS = ["Data Science and Data Analytics", "Full Stack Development", "UI/UX Design"];
const BATCHES = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"];
const CATEGORY_OPTIONS = ["Domain Change", "Upskill", "Career Gap", "Fresher"];

export default function NewStudentModal({ open, onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [student, setStudent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setStep(1);
      setStudent(null);
      setError("");
      setSaving(false);
    }
  }, [open]);

  const reset = () => {
    setStep(1);
    setStudent(null);
    setError("");
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.target);
    try {
      const payload = Object.fromEntries(form.entries());
      const created = await createStudent({
        ...payload,
        saleValue: payload.saleValue || payload.courseFee,
        outstanding: Number(payload.outstanding || 0) || Math.max(0, Number(payload.saleValue || payload.courseFee || 0) - Number(payload.paidAmount || 0)),
      });
      setStudent(created);
      setStep(2);
    } catch {
      setError("Couldn't create the student. Make sure the backend server is running.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateLink = async (e) => {
    e.preventDefault();
    setSaving(true);
    const amount = new FormData(e.target).get("amount");
    try {
      await generatePaymentLink(student.id, amount);
      onCreated?.();
      close();
    } catch {
      setError("Couldn't generate the payment link.");
    } finally {
      setSaving(false);
    }
  };

  const initialLinkAmount = useMemo(() => student?.saleValue || 0, [student]);

  return (
    <Modal open={open} onClose={close} title={step === 1 ? "Create Student" : "Generate Payment Link"} wide>
      {step === 1 && (
        <form onSubmit={handleCreate} className="space-y-6">
          <Section title="Basic details" icon={<UserPlus className="h-4 w-4" />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Student Name" required>
                <Input name="customerName" required placeholder="Enter full name" />
              </Field>
              <Field label="Parent Name" required>
                <Input name="primaryContactName" required placeholder="Contact person name" />
              </Field>
              <Field label="Parent Email" required>
                <Input name="email" type="email" required placeholder="example@email.com" />
              </Field>
              <Field label="Parent Phone" required>
                <PhoneInput name="contactNumber" required placeholder="00000 00000" />
              </Field>
              <Field label="Alternative Phone" required>
                <PhoneInput name="altContactNumber" placeholder="00000 00000" required />
              </Field>
              <Field label="Batch" required>
                <Select name="batch" required defaultValue="">
                  <option value="" disabled>Select batch</option>
                  {BATCHES.map((batch) => <option key={batch}>{batch}</option>)}
                </Select>
              </Field>
              <Field label="Program" required>
                <Select name="program" required defaultValue="">
                  <option value="" disabled>Select program</option>
                  {PROGRAMS.map((program) => <option key={program}>{program}</option>)}
                </Select>
              </Field>
              <Field label="Category" required>
                <Select name="category" required defaultValue="Fresher">
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Course Fee" required>
                <Input name="courseFee" type="number" min="0" required placeholder="0" />
              </Field>
            </div>
          </Section>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Student</Button>
          </div>
        </form>
      )}

      {step === 2 && student && (
        <form onSubmit={handleGenerateLink} className="space-y-4">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{student.customerName}</span> was added successfully.
            Generate a payment link now, or skip and do it later from the Payment Link module.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Student Name">
              <Input value={student.customerName} disabled />
            </Field>
            <Field label="Program">
              <Input value={student.program} disabled />
            </Field>
          </div>
          <Field label="Amount" required>
            <Input name="amount" type="number" min="0" defaultValue={initialLinkAmount} required />
          </Field>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { onCreated?.(); close(); }}>
              Skip for now
            </Button>
            <Button type="submit" loading={saving}><Link2 className="h-4 w-4" /> Generate Link</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const Section = React.forwardRef(function Section({ title, icon, children, className = "" }, ref) {
  return (
    <section ref={ref} className={`rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center gap-2 text-blue-600">
        {icon}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
});

Section.displayName = "Section";
