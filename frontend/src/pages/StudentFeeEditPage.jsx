import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Pencil, Phone } from "lucide-react";
import Topbar from "../components/Topbar";
import Button from "../components/Button";
import { Input, formatPhoneDisplay } from "../components/Field";
import { getStudent, updateStudent } from "../api/students";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";

const money = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StudentFeeEditPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseFee, setCourseFee] = useState("");
  const [discount, setDiscount] = useState("");
  const context = params.get("context");
  const backTarget = `/student/${id}${context ? `?context=${context}` : ""}`;

  const refresh = useCallback(() => {
    setLoading(true);
    getStudent(id, context || "payments")
      .then((data) => {
        setStudent(data);
        setCourseFee(String(data.saleValue ?? 0));
        setDiscount(String(data.discount ?? 0));
      })
      .finally(() => setLoading(false));
  }, [id, context]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading || !student) {
    return <p className="text-sm text-slate-400">Loading student...</p>;
  }

  if (!hasPermission(user, "payments", "update")) {
    return (
      <div>
        <Topbar
          left={(
            <button
              type="button"
              onClick={() => navigate(backTarget)}
              className="mr-1 grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          title={student.customerName}
          subtitle={`Skillit Academy | ${student.contactNumber || "8639191169"} | Program | ${student.program || student.course || "-"}`}
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
          You don't have permission to edit fee components for this account.
        </div>
      </div>
    );
  }

  const feeAmount = Number(courseFee || 0);
  const discountAmount = Number(discount || 0);
  const netPayable = Math.max(0, feeAmount - discountAmount);
  const paidAmount = Number(student.paidAmount || 0);
  const outstanding = Math.max(0, netPayable - paidAmount);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateStudent(student.id, {
        saleValue: feeAmount,
        discount: discountAmount,
        outstanding,
      }, context || "payments");
      navigate(backTarget);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Topbar
        left={(
          <button
            type="button"
            onClick={() => navigate(backTarget)}
            className="mr-1 grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        title={student.customerName}
        subtitle={`Skillit Academy | ${student.contactNumber || "8639191169"} | Program | ${student.program || student.course || "-"}`}
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
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
          <h2 className="mb-6 text-xl font-semibold text-slate-800">Edit fee components</h2>

          <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr] items-start gap-4 border-b border-slate-100 pb-4 text-sm font-medium text-slate-500">
            <div>Component</div>
            <div>Fee Amount</div>
            <div>Discount</div>
            <div>Net Payable</div>
            <div>Paid</div>
            <div>Outstanding</div>
          </div>

          <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 border-b border-slate-100 py-6 text-slate-700">
            <div className="font-medium text-slate-700">Course Fee</div>
            <Input
              type="number"
              min="0"
              value={courseFee}
              onChange={(e) => setCourseFee(e.target.value)}
              className="max-w-[120px] bg-white text-base"
            />
            <Input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="Add Discount"
              className="max-w-[120px] bg-white text-base"
            />
            <div className="text-base font-semibold text-slate-800">{money(netPayable)}</div>
            <div className="text-base font-semibold text-slate-800">{money(paidAmount)}</div>
            <div className="text-base font-semibold text-slate-800">{money(outstanding)}</div>
          </div>

          <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 pt-5 text-sm">
            <div className="font-semibold text-slate-700">Total</div>
            <div className="font-semibold text-slate-800">{money(feeAmount)}</div>
            <div className="font-semibold text-slate-800">{money(discountAmount)}</div>
            <div className="font-semibold text-slate-800">{money(netPayable)}</div>
            <div className="font-semibold text-slate-800">{money(paidAmount)}</div>
            <div className="font-semibold text-slate-800">{money(outstanding)}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(backTarget)} className="min-w-[110px] !bg-white">
          Cancel
        </Button>
        <Button type="button" loading={saving} onClick={handleSave} className="min-w-[160px]">
          <Pencil className="h-4 w-4" /> Save Changes
        </Button>
      </div>
    </div>
  );
}
