import React, { useState } from "react";
import { X, Download, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatPaidAt(dateVal) {
  if (!dateVal) return "N/A";
  const raw = String(dateVal).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let dateObj = null;
  if (iso) {
    const [, year, month, day] = iso;
    dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  } else {
    const legacy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (legacy) {
      const [, day, month, year] = legacy;
      const fullYear = year.length === 2 ? `20${year}` : year;
      dateObj = new Date(Number(fullYear), Number(month) - 1, Number(day));
    } else {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
    }
  }
  if (!dateObj) return dateVal;
  return dateObj.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PaymentDetailsDrawer({ open, payment, onClose, onDownloadReceipt }) {
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);

  if (!open || !payment) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] cursor-default focus:outline-none"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="relative h-full w-full max-w-[430px] bg-slate-50 shadow-2xl border-l border-slate-200/80 flex flex-col z-10 transition-transform duration-300 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Payment Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Main Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
            
            <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full w-fit mx-auto mb-3">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Successful</span>
            </div>

            <div className="text-3xl font-display font-extrabold text-slate-900 leading-none">
              {money(payment.amount)}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4 flex flex-col gap-3 text-left text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Paid At</span>
                <span className="font-semibold text-slate-700">{formatPaidAt(payment.paymentDate)}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-400 whitespace-nowrap">Transaction ID</span>
                <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-150 break-all select-all text-right ml-4">
                  {payment.refId || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Action: Download Receipt */}
          {(() => {
            const prod = String(payment.product || "").trim().toLowerCase();
            const mode = String(payment.mode || "").trim().toLowerCase();
            const isPaymentLink = prod === "razorpay checkout" || mode === "payment link";
            return isPaymentLink ? (
              <button
                type="button"
                onClick={() => onDownloadReceipt(payment)}
                className="w-full py-3 px-4 bg-white border border-slate-200 rounded-xl text-slate-700 hover:text-slate-900 font-semibold text-sm shadow-sm hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Download className="h-4.5 w-4.5 text-blue-500" />
                <span>Download Receipt</span>
              </button>
            ) : null;
          })()}

          {/* Breakdown Section */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setBreakdownOpen(!breakdownOpen)}
              className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-xs uppercase tracking-wider text-slate-500 hover:bg-slate-50/50 transition-colors border-b border-slate-100"
            >
              <span>Breakdown</span>
              {breakdownOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {breakdownOpen && (
              <div className="px-5 py-4 space-y-3.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Course Fee</span>
                  <span className="font-semibold text-slate-800">{money(payment.amount)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                  <span className="text-slate-400 font-medium">Settlement Date</span>
                  <span className="font-semibold text-slate-800">{payment.settlementDate || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                  <span className="text-slate-400 font-medium">Settlement UTR</span>
                  <span className="font-semibold text-slate-800">{payment.statementId || "N/A"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setNotesOpen(!notesOpen)}
              className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-xs uppercase tracking-wider text-slate-500 hover:bg-slate-50/50 transition-colors border-b border-slate-100"
            >
              <span>Notes</span>
              {notesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {notesOpen && (
              <div className="px-5 py-4 text-sm text-slate-500 italic">
                {payment.notes || "No notes available"}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
