import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, X } from "lucide-react";
import Topbar from "../components/Topbar";
import Button from "../components/Button";
import { Field, Input, PhoneInput, Select, formatPhoneDisplay, fromDateInputValue, toDateInputValue, todayDateInputValue } from "../components/Field";
import { enrollStudent, getStudent, punchOrder } from "../api/students";
import { useAuth } from "../context/AuthContext";
import { hasPermission, hasActionPermission } from "../lib/permissions";

export default function StudentPunchOrderPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const context = params.get("context");

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    getStudent(id).then(setStudent).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading || !student) {
    return <p className="text-sm text-slate-400">Loading student...</p>;
  }

  const isEnrollmentAction = context === "pending";
  const allowedHere = isEnrollmentAction
    ? hasPermission(user, "enrollments", "update")
    : hasActionPermission(user, "punch-order");

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
    const managerValue = f.get("manager") || user?.reportingManagerName || "";
    const payload = {
      customerName: f.get("customerName"),
      primaryContactName: f.get("primaryContactName"),
      contactNumber: f.get("contactNumber"),
      altContactNumber: f.get("altContactNumber"),
      email: f.get("email"),
      category: f.get("category"),
      batch: f.get("batch"),
      date: fromDateInputValue(f.get("date")),
      cycle: f.get("cycle"),
      program: f.get("course"),
      course: f.get("course"),
      quarter: f.get("quarter"),
      month: f.get("month"),
      sdeName: f.get("sdeName"),
      demoDoneBy: f.get("demoDoneBy"),
      salesType: f.get("salesType"),
      leadSource: f.get("leadSource"),
      leadLink: f.get("leadLink"),
      saleValue: f.get("saleValue"),
      paidAmount: f.get("paidAmount"),
      outstanding: f.get("outstanding"),
      officeVisit: f.get("officeVisit"),
      paymentMode: f.get("paymentMode"),
      manager: managerValue,
      reportedTo: managerValue,
    };
    setSaving(true);
    try {
      if (context === "pending") {
        await enrollStudent(student.id, payload);
        navigate("/enrollments");
      } else {
        await punchOrder(student.id, payload);
        navigate("/booked-orders");
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedCourse = student.course || student.program || "";
  const isEnrollmentContext = context === "pending";
  const formTitle = isEnrollmentContext ? "Push to Enrollments Form" : "Punch an Order Form";
  const submitLabel = isEnrollmentContext ? "Enroll" : "Punch an order";
  const closeLabel = isEnrollmentContext ? "Close enrollments form" : "Close punch order form";

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

              <Field label="Category">
                <Input name="category" defaultValue={student.category || ""} placeholder="Enter Category" />
              </Field>
              <Field label="Primary Contact Email" required>
                <Input name="email" defaultValue={student.email || ""} placeholder="example@email.com" required />
              </Field>

              <Field label="Batch" required>
                <Input name="batch" defaultValue={student.batch || ""} placeholder="B8" required />
              </Field>
              <Field label="Course" required>
                <Select name="course" defaultValue={selectedCourse} required>
                  <option value="" disabled>Select Course</option>
                  <option value={selectedCourse}>{selectedCourse || "Course"}</option>
                </Select>
              </Field>

              <Field label="DATE" required>
                <Input name="date" type="date" max={todayDateInputValue()} defaultValue={toDateInputValue(student.date || "")} required />
              </Field>
              <Field label="Quarter" required>
                <Input name="quarter" type="number" defaultValue={student.quarter || 1} placeholder="1" required />
              </Field>

              <Field label="CYCLE" required>
                <Input name="cycle" type="number" defaultValue={student.cycle || 1} placeholder="1" required />
              </Field>
              <Field label="Month" required>
                <Input name="month" defaultValue={student.month || ""} placeholder="JUNE" required />
              </Field>

              <Field label="SDE Name" required>
                <Input name="sdeName" defaultValue={student.sdeName || ""} placeholder="Dhanusree" required />
              </Field>
              <Field label="MANAGER" required>
                <Input name="manager" defaultValue={student.manager || user?.reportingManagerName || ""} placeholder="Vieeth" required />
              </Field>

              <Field label="Demo Done by" required>
                <Select name="demoDoneBy" defaultValue={student.demoDoneBy || ""} required>
                  <option value="" disabled>Enter SDE full name</option>
                  <option value={student.sdeName || ""}>{student.sdeName || "SDE"}</option>
                </Select>
              </Field>
              <Field label="SALES TYPE">
                <Select name="salesType" defaultValue={student.salesType || "International"}>
                  <option value="International">International</option>
                  <option value="Domestic">Domestic</option>
                </Select>
              </Field>

              <Field label="PAYMENT MODE" required>
                <Select name="paymentMode" defaultValue={student.paymentMode || ""} required>
                  <option value="" disabled>Select Payment Mode</option>
                  <option>Payment Link</option>
                  <option>Cash</option>
                  <option>Bank Transfer</option>
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
                <Select name="leadSource" defaultValue={student.leadSource || "website"} required>
                  <option value="website">website</option>
                  <option value="referral">referral</option>
                  <option value="social">social</option>
                </Select>
              </Field>
              <Field label="LEAD LINK" required>
                <Input name="leadLink" defaultValue={student.leadLink || ""} placeholder="35,000.00" required />
              </Field>

              <div className="md:col-span-2">
                <Field label="Office Visit" required>
                  <div className="flex items-center gap-4 pt-1 text-sm text-slate-600">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="officeVisit" value="Yes" defaultChecked={student.officeVisit === "Yes"} />
                      Yes
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="officeVisit" value="No" defaultChecked={student.officeVisit === "No"} />
                      No
                    </label>
                  </div>
                </Field>
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
