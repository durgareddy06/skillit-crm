import React, { useEffect, useState, useMemo } from "react";
import { X, CreditCard, Clock, CheckCircle2, XCircle, AlertCircle, Link, Download, ChevronDown, ChevronUp, FileText, User, Calendar, DollarSign } from "lucide-react";
import { getPaymentHistory, getPaymentInvoice } from "../api/students";
import Button from "./Button";
import { formatPhoneDisplay } from "./Field";

const STATUS_CONFIGS = {
  captured: { label: "Success", bg: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2, color: "text-emerald-500" },
  paid: { label: "Paid", bg: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2, color: "text-emerald-500" },
  success: { label: "Success", bg: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2, color: "text-emerald-500" },
  created: { label: "Link Created", bg: "bg-blue-50 text-blue-700 border-blue-100", icon: Link, color: "text-blue-500" },
  pending: { label: "Pending", bg: "bg-amber-50 text-amber-700 border-amber-100", icon: Clock, color: "text-amber-500" },
  failed: { label: "Failed", bg: "bg-rose-50 text-rose-700 border-rose-100", icon: XCircle, color: "text-rose-500" },
  refunded: { label: "Refunded", bg: "bg-purple-50 text-purple-700 border-purple-100", icon: AlertCircle, color: "text-purple-500" },
  cancelled: { label: "Cancelled", bg: "bg-slate-50 text-slate-700 border-slate-100", icon: XCircle, color: "text-slate-500" },
};

function formatCurrency(value = 0) {
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function SummaryCard({ title, amount, className = "", icon: Icon }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex items-center justify-between ${className}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <p className="mt-1 text-lg font-bold text-slate-800">{amount}</p>
      </div>
      {Icon && (
        <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

export default function PaymentHistoryDrawer({ open, studentId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTxs, setExpandedTxs] = useState({});
  const [downloadingInvoiceIdx, setDownloadingInvoiceIdx] = useState(null);

  useEffect(() => {
    if (!open || !studentId) return;

    setLoading(true);
    setError(null);
    getPaymentHistory(studentId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error("Failed to load payment history:", err);
        setError("Failed to fetch payment history. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [open, studentId]);

  const toggleTxExpand = (txId) => {
    setExpandedTxs((prev) => ({
      ...prev,
      [txId]: !prev[txId],
    }));
  };

  const handleDownloadInvoice = async (paymentIndex, uniqueId) => {
    setDownloadingInvoiceIdx(paymentIndex);
    try {
      const response = await getPaymentInvoice(studentId, paymentIndex);
      const contentDisposition = response.headers?.["content-disposition"] || "";
      let filename = `Invoice_${uniqueId || studentId}_${paymentIndex}.pdf`;
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
    } catch (err) {
      console.error("Failed to download invoice:", err);
      alert("Failed to download invoice pdf. Please try again.");
    } finally {
      setDownloadingInvoiceIdx(null);
    }
  };

  const timelineEvents = useMemo(() => {
    if (!data || !data.student) return [];

    const { student, transactions } = data;
    const list = [];

    // 1. Add manual/direct payments
    if (Array.isArray(student.payments)) {
      student.payments.forEach((pay, index) => {
        const time = pay.paidDate ? new Date(pay.paidDate).getTime() : 0;
        list.push({
          id: `manual_${index}_${time}`,
          type: "manual_payment",
          timestamp: time || 0,
          date: pay.paidDate,
          title: `Direct Payment Logged (${pay.mode || "Other"})`,
          amount: pay.amount,
          status: "paid",
          gateway: "Manual Entry",
          details: {
            refId: pay.refId,
            statementId: pay.statementId,
            product: pay.product,
            invoiceNumber: pay.invoiceNumber,
            invoiceDate: pay.invoiceDate,
            paymentIndex: index,
          },
        });
      });
    }

    // 2. Add payment links
    if (Array.isArray(student.paymentLinks)) {
      student.paymentLinks.forEach((link, index) => {
        const time = link.createdAt ? new Date(link.createdAt).getTime() : 0;
        list.push({
          id: `link_${index}_${time}`,
          type: "link_created",
          timestamp: time || 0,
          date: link.createdAt,
          title: "Payment Link Created",
          amount: link.amount,
          status: link.status ? link.status.toLowerCase() : "created",
          gateway: "Razorpay Link",
          details: {
            linkId: link.linkId,
            url: link.url,
          },
        });
      });
    }

    // 3. Add transactions & webhooks
    if (Array.isArray(transactions)) {
      transactions.forEach((tx) => {
        const baseTime = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;

        // Main transaction log
        list.push({
          id: tx._id,
          type: "transaction",
          timestamp: baseTime || 0,
          date: tx.createdAt,
          title: `Gateway Order Initialized`,
          amount: tx.amount,
          status: tx.status ? tx.status.toLowerCase() : "created",
          gateway: "Razorpay Checkout",
          details: {
            paymentId: tx.paymentId,
            orderId: tx.orderId,
            razorpayPaymentLinkId: tx.razorpayPaymentLinkId,
            method: tx.method,
            email: tx.email,
            contact: tx.contact,
            errorReason: tx.errorReason,
          },
          webhookEvents: tx.webhookEvents || [],
        });
      });
    }

    // Sort ascending so timeline goes from oldest to newest (vertical line connects chronologically)
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  const paymentSummary = useMemo(() => {
    if (!data || !data.student) return null;
    const { student } = data;

    let lastDate = "";
    if (student.payments && student.payments.length > 0) {
      const dates = student.payments.map((p) => p.paidDate).filter(Boolean);
      if (dates.length > 0) {
        lastDate = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      }
    }

    const payStatus = student.paidAmount >= student.saleValue
      ? "Fully Paid"
      : student.paidAmount > 0
        ? "Partially Paid"
        : "Unpaid";

    return {
      saleValue: student.saleValue || 0,
      paidAmount: student.paidAmount || 0,
      outstanding: student.outstanding || 0,
      status: payStatus,
      lastPaymentDate: lastDate ? formatDate(lastDate) : "N/A",
    };
  }, [data]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-label="Close panel"
      />

      {/* Slide-over Panel */}
      <aside className="relative flex h-full w-full max-w-[660px] flex-col bg-slate-50 shadow-2xl transition-transform duration-300 animate-slideOver overflow-hidden border-l border-slate-200">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 shadow-sm shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-skillit">
                <CreditCard className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-display font-bold text-slate-800">Payment Journey</h2>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-400">
              Complete transaction logs & pipeline history (Read-only)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-700 border border-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center space-y-2 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-skillit" />
              <p className="text-sm font-medium">Fetching payment history...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-center text-rose-700">
              <AlertCircle className="h-8 w-8 mx-auto text-rose-500 mb-2" />
              <p className="font-semibold">{error}</p>
            </div>
          ) : (
            <>
              {/* Summary Cards Grid */}
              {paymentSummary && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Summary</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <SummaryCard title="Net Payable" amount={formatCurrency(paymentSummary.saleValue)} icon={DollarSign} />
                    <SummaryCard title="Paid Amount" amount={formatCurrency(paymentSummary.paidAmount)} icon={CheckCircle2} className="border-emerald-100 bg-emerald-50/20" />
                    <SummaryCard title="Due Outstanding" amount={formatCurrency(paymentSummary.outstanding)} icon={AlertCircle} className={paymentSummary.outstanding > 0 ? "border-amber-100 bg-amber-50/20" : ""} />
                  </div>
                  <div className="flex flex-wrap gap-2 items-center justify-between text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <span>
                      Payment Status: <strong className={paymentSummary.status === "Fully Paid" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>{paymentSummary.status}</strong>
                    </span>
                    <span>
                      Last Payment: <strong>{paymentSummary.lastPaymentDate}</strong>
                    </span>
                  </div>
                </section>
              )}

              {/* End-to-End Vertical Timeline */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Complete Timeline</h3>
                
                {timelineEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
                    <CreditCard className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium">No payment history or links logged for this student.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6 pb-6">
                    {timelineEvents.map((evt) => {
                      const cfg = STATUS_CONFIGS[evt.status] || { label: evt.status, bg: "bg-slate-50 text-slate-600 border-slate-100", icon: Clock, color: "text-slate-400" };
                      const StatusIcon = cfg.icon;
                      const isExpanded = !!expandedTxs[evt.id];

                      return (
                        <div key={evt.id} className="relative group">
                          {/* Dot / Icon */}
                          <span className={`absolute -left-[37px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white border-2 shadow-sm ${cfg.color} border-slate-200`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                          </span>

                          {/* Timeline Card */}
                          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                            {/* Card Header */}
                            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-50 pb-3">
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">{evt.title}</h4>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Calendar className="h-3 w-3" /> {formatDate(evt.date)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-sm font-bold text-slate-700">
                                  {formatCurrency(evt.amount)}
                                </span>
                              </div>
                            </div>

                            {/* Card Content details */}
                            <div className="mt-3 text-xs text-slate-600 space-y-2">
                              {evt.type === "manual_payment" && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                  <div>
                                    <span className="text-slate-400">Payment Mode:</span> <strong className="text-slate-700 font-semibold">{evt.gateway}</strong>
                                  </div>
                                  {evt.details.refId && (
                                    <div>
                                      <span className="text-slate-400">Reference ID:</span> <code className="bg-slate-100 px-1 rounded text-slate-800 text-[10px]">{evt.details.refId}</code>
                                    </div>
                                  )}
                                  {evt.details.statementId && (
                                    <div>
                                      <span className="text-slate-400">Statement ID:</span> <code className="bg-slate-100 px-1 rounded text-slate-800 text-[10px]">{evt.details.statementId}</code>
                                    </div>
                                  )}
                                  {evt.details.product && (
                                    <div>
                                      <span className="text-slate-400">Product/Course:</span> <span className="text-slate-700 font-semibold">{evt.details.product}</span>
                                    </div>
                                  )}
                                  {evt.details.invoiceNumber && (
                                    <div>
                                      <span className="text-slate-400">Invoice Number:</span> <span className="text-slate-700 font-semibold">{evt.details.invoiceNumber}</span>
                                    </div>
                                  )}
                                  {evt.details.invoiceDate && (
                                    <div>
                                      <span className="text-slate-400">Invoice Date:</span> <span className="text-slate-700 font-semibold">{evt.details.invoiceDate}</span>
                                    </div>
                                  )}

                                  <div className="col-span-2 pt-2 border-t border-slate-100 flex justify-end">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="py-1 px-3 text-[11px] h-auto border-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
                                      onClick={() => handleDownloadInvoice(evt.details.paymentIndex, evt.details.refId)}
                                      loading={downloadingInvoiceIdx === evt.details.paymentIndex}
                                      disabled={downloadingInvoiceIdx !== null}
                                    >
                                      <FileText className="h-3 w-3" /> View Invoice / Receipt
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {evt.type === "link_created" && (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Link ID:</span>
                                    <code className="text-slate-700 font-medium text-[10px]">{evt.details.linkId}</code>
                                  </div>
                                  {evt.details.url && (
                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                                      <span className="text-slate-500 font-medium truncate max-w-[280px]">{evt.details.url}</span>
                                      <a
                                        href={evt.details.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-skillit hover:text-skillit-dark font-semibold inline-flex items-center gap-1 select-none"
                                      >
                                        Visit Link <Download className="h-3.5 w-3.5 rotate-270" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}

                              {evt.type === "transaction" && (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                    <div>
                                      <span className="text-slate-400">Gateway:</span> <strong className="text-slate-700 font-semibold">{evt.gateway}</strong>
                                    </div>
                                    {evt.details.paymentId && (
                                      <div>
                                        <span className="text-slate-400">Transaction ID:</span> <code className="bg-slate-100 px-1 rounded text-slate-800 text-[10px]">{evt.details.paymentId}</code>
                                      </div>
                                    )}
                                    {evt.details.orderId && (
                                      <div>
                                        <span className="text-slate-400">Order ID:</span> <code className="bg-slate-100 px-1 rounded text-slate-800 text-[10px]">{evt.details.orderId}</code>
                                      </div>
                                    )}
                                    {evt.details.method && (
                                      <div>
                                        <span className="text-slate-400">Method:</span> <strong className="text-slate-700 font-semibold uppercase">{evt.details.method}</strong>
                                      </div>
                                    )}
                                    {evt.details.email && (
                                      <div>
                                        <span className="text-slate-400">Payer Email:</span> <span className="text-slate-700 font-semibold">{evt.details.email}</span>
                                      </div>
                                    )}
                                    {evt.details.contact && (
                                      <div>
                                        <span className="text-slate-400">Payer Contact:</span> <span className="text-slate-700 font-semibold">{formatPhoneDisplay(evt.details.contact)}</span>
                                      </div>
                                    )}
                                    {evt.details.errorReason && (
                                      <div className="col-span-2 text-rose-600 bg-rose-50/50 p-2 rounded-lg border border-rose-100/35">
                                        <span className="font-semibold">Failure Reason:</span> {evt.details.errorReason}
                                      </div>
                                    )}
                                  </div>

                                  {/* Webhook logs collapsible section */}
                                  {evt.webhookEvents && evt.webhookEvents.length > 0 && (
                                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                      <button
                                        type="button"
                                        className="w-full flex items-center justify-between p-2.5 text-[11px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100/70 transition-colors"
                                        onClick={() => toggleTxExpand(evt.id)}
                                      >
                                        <span>Gateway Event Trace ({evt.webhookEvents.length})</span>
                                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                      </button>

                                      {isExpanded && (
                                        <div className="p-2.5 space-y-2 border-t border-slate-100 bg-slate-50/20 text-[11px]">
                                          {evt.webhookEvents.map((event, idx) => (
                                            <div key={event._id || idx} className="flex justify-between items-start gap-4 border-b border-dashed border-slate-100 pb-1.5 last:border-b-0 last:pb-0">
                                              <div>
                                                <code className="text-blue-600 font-bold">{event.eventType}</code>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Event ID: {event.eventId}</p>
                                              </div>
                                              <span className="text-slate-400 whitespace-nowrap text-[10px]">
                                                {formatDate(event.receivedAt)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
