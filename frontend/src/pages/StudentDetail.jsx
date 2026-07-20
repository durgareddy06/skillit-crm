import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Link2,
  Mail,
  PackagePlus,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
  User,
  GraduationCap,
  CreditCard,
  TrendingUp,
  MessageSquare,
} from "lucide-react";
import Topbar from "../components/Topbar";
import Button from "../components/Button";
import Modal from "../components/Modal";
import DataTable from "../components/DataTable";
import TransferLeadModal from "../components/TransferLeadModal";
import { Field, Input, Select, formatPhoneDisplay } from "../components/Field";
import { useAuth } from "../context/AuthContext";
import { canUsePermission, hasActionPermission } from "../lib/permissions";
import { canTransferLead } from "../lib/userHierarchy";
import {
  getStudent,
  addPayment,
  cancelStudent,
  misApprove,
  misCancel,
  dropStudent,
  generatePaymentLink,
} from "../api/students";
import { fromDateInputValue, todayDateInputValue } from "../components/Field";

const money = (n) => `\u20B9${Number(n || 0).toLocaleString("en-IN")}`;
const statMoney = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TABS = ["Payments", "Timeline"];

export default function StudentDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const context = params.get("context");

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Payments");
  const [busy, setBusy] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [addPaymentError, setAddPaymentError] = useState("");
  const [showPaymentLink, setShowPaymentLink] = useState(false);
  const [paymentLinkAmount, setPaymentLinkAmount] = useState("");
  const [paymentLinkError, setPaymentLinkError] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isStudentModule = !context || context === "detail";

  useEffect(() => {
    if (!isStudentModule) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsSticky(scrollY > 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isStudentModule]);

  const handleArrowClick = () => {
    setExpanded((prev) => {
      const nextExpanded = !prev;
      if (!nextExpanded) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return nextExpanded;
    });
  };
  const canCreateStudent = canUsePermission(user, "student", "create");
  const canUpdateStudent = canUsePermission(user, "student", "update");
  const canDeleteStudent = canUsePermission(user, "student", "delete");
  const canCreatePaymentLink = hasActionPermission(user, "generate-payment-link");
  const canAddPaymentPermission = hasActionPermission(user, "add-payment");
  const canEditFees = canUsePermission(user, "payments", "update");
  const canPunchOrder = hasActionPermission(user, "punch-order");
  const canEnrollStudent = canUsePermission(user, "enrollments", "update");
  const canCancelStudent = canUsePermission(user, "cancelled", "update");
  const canApproveMis = canUsePermission(user, "mis-approval", "update");
  const canTransferStudent = canTransferLead(user) && canUpdateStudent;
  const canManageStudent = canCreateStudent || canUpdateStudent || canDeleteStudent || canCreatePaymentLink || canAddPaymentPermission || canPunchOrder || canEnrollStudent || canCancelStudent || canApproveMis || canEditFees;
  const isPaymentLinkContext = context === "payment-link";
  const preserveContext = context ? `?context=${context}` : "";

  const refresh = useCallback(() => {
    setLoading(true);
    getStudent(id).then(setStudent).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading || !student) {
    return <p className="text-sm text-slate-400">Loading student...</p>;
  }

  const netPayable = Math.max(0, Number(student.saleValue || 0) - Number(student.discount || 0));
  const outstandingBalance = Math.max(0, netPayable - Number(student.paidAmount || 0));
  const canAddPayment = outstandingBalance > 0;
  const paymentLinks = Array.isArray(student.paymentLinks) && student.paymentLinks.length > 0
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
  const reservedLinkAmount = paymentLinks.reduce((sum, link) => sum + (Number(link.amount) || 0), 0);
  const availableLinkBalance = Math.max(0, outstandingBalance - reservedLinkAmount);

  const openPaymentLinkModal = () => {
    setPaymentLinkAmount(String(availableLinkBalance));
    setPaymentLinkError("");
    setShowPaymentLink(true);
  };

  const confirmPaymentLink = async () => {
    if (!canCreatePaymentLink) return;
    setBusy(true);
    try {
      const amount = Number(paymentLinkAmount || 0);
      if (amount <= 0) {
        setPaymentLinkError("Payment link amount must be greater than zero.");
        return;
      }
      if (amount > availableLinkBalance) {
        setPaymentLinkError(`Payment link amount cannot exceed the remaining available balance of ${statMoney(availableLinkBalance)}.`);
        return;
      }
      setPaymentLinkError("");
      await generatePaymentLink(student.id, amount);
      setShowPaymentLink(false);
      await refresh();
      navigate("/payment-link");
    } finally {
      setBusy(false);
    }
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
        subtitle={`Skillit Academy | Program: ${student.program}`}
        subtitleExtras={(
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-white/90 data-font">
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> {formatPhoneDisplay(student.contactNumber)}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" /> {student.email}
            </span>
          </div>
        )}
      />

      <div className="relative mb-6 pt-4">
        {isStudentModule && (
          <button
            type="button"
            onClick={handleArrowClick}
            aria-label={expanded ? "Collapse details" : "Expand details"}
            className={
              isSticky
                ? "fixed bottom-6 left-1/2 md:left-[calc(50%+128px)] -translate-x-1/2 z-50 grid h-8 w-8 place-items-center rounded-full bg-skillit text-white shadow-md ring-4 ring-white/80 transition-all duration-200 active:scale-95"
                : "absolute left-1/2 top-0 z-20 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-skillit text-white shadow-md ring-4 ring-white/80 transition-all duration-200 active:scale-95"
            }
          >
            <span className="text-sm leading-none">{expanded ? "↑" : "↓"}</span>
          </button>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Net Payable" value={statMoney(netPayable)} />
          <Stat label="Paid Amount" value={statMoney(student.paidAmount)} />
          <Stat label="Outstanding" value={statMoney(outstandingBalance)} />
        </div>
      </div>
      <div className="space-y-6">
        {isStudentModule && expanded && (
          <>
            <Section id="customer-info" icon={<User className="h-5 w-5" />} title="Customer Information">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Customer Name">
                  <Input value={student.customerName || ""} readOnly />
                </Field>
                <Field label="Primary Contact Name">
                  <Input value={student.primaryContactName || student.customerName || ""} readOnly />
                </Field>
                <Field label="Primary Contact Email">
                  <Input value={student.email || ""} readOnly />
                </Field>
                <Field label="Primary Contact Number">
                  <Input value={formatPhoneDisplay(student.contactNumber)} readOnly />
                </Field>
                <Field label="Alternative Contact Number">
                  <Input value={formatPhoneDisplay(student.altContactNumber || "")} readOnly />
                </Field>
                <Field label="Category">
                  <Input value={student.category || ""} readOnly />
                </Field>
              </div>
            </Section>

            <Section id="academic-details" icon={<GraduationCap className="h-5 w-5" />} title="Course & Academic Details">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Course">
                  <Input value={student.course || ""} readOnly />
                </Field>
                <Field label="Batch">
                  <Input value={student.batch || ""} readOnly />
                </Field>
                <Field label="Quarter">
                  <Input value={student.quarter || 1} readOnly />
                </Field>
                <Field label="Date">
                  <Input value={student.date || ""} readOnly />
                </Field>
                <Field label="Month">
                  <Input value={student.month || ""} readOnly />
                </Field>
                <Field label="Cycle">
                  <Input value={student.cycle || 1} readOnly />
                </Field>
                <div className="md:col-span-3">
                  <Field label="Program">
                    <Input value={student.program || ""} readOnly />
                  </Field>
                </div>
              </div>
            </Section>

            <Section id="financial-details" icon={<CreditCard className="h-5 w-5" />} title="Financial Details">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Course Fee">
                  <Input value={statMoney(student.saleValue)} readOnly />
                </Field>
                <Field label="Sale Value">
                  <Input value={statMoney(netPayable)} readOnly />
                </Field>
                <Field label="Paid Amount">
                  <Input value={statMoney(student.paidAmount)} readOnly />
                </Field>
                <Field label="Outstanding Amount">
                  <Input value={statMoney(outstandingBalance)} readOnly />
                </Field>
                <Field label="Payment Mode">
                  <Input value={student.paymentMode || "Not Selected"} readOnly />
                </Field>
              </div>
            </Section>

            <Section id="sales-attribution" icon={<TrendingUp className="h-5 w-5" />} title="Sales Attribution">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="SDE Name">
                  <Input value={student.sdeName || ""} readOnly />
                </Field>
                <Field label="Manager">
                  <Input value={student.manager || ""} readOnly />
                </Field>
                <Field label="Demo Done By">
                  <Input value={student.demoDoneBy || ""} readOnly />
                </Field>
                <Field label="Sales Type">
                  <Input value={student.salesType || "International"} readOnly />
                </Field>
                <Field label="Lead Source">
                  <Input value={student.leadSource || ""} readOnly />
                </Field>
                <Field label="Lead Link">
                  {student.leadLink ? (
                    <div className="flex gap-2">
                      <Input value={student.leadLink} readOnly className="flex-1" />
                      <a
                        href={student.leadLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center px-3 rounded-xl bg-slate-100 text-skillit hover:bg-slate-200 text-sm font-medium"
                      >
                        Open
                      </a>
                    </div>
                  ) : (
                    <Input value="-" readOnly />
                  )}
                </Field>
                <Field label="Office Visit">
                  <Input value={student.officeVisit || "No"} readOnly />
                </Field>
                <Field label="Call Recording Upload">
                  <Input value="No recording uploaded" readOnly />
                </Field>
              </div>
            </Section>

            <Section id="comments-bottom" icon={<MessageSquare className="h-5 w-5" />} title="Comments">
              <Field label="Remarks">
                <textarea
                  value={student.internalRemarks || "No remarks entered yet."}
                  readOnly
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 bg-slate-50 focus:outline-none"
                />
              </Field>
            </Section>
          </>
        )}

        {(!isStudentModule || !expanded) && (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-800">{student.customerName} fee details</h2>
              {context !== "payments" && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => setShowActions((v) => !v)}
                    className="!px-2 !py-1 !text-skillit"
                  >
                    <Link2 className="h-4 w-4" /> Actions
                  </Button>

                  {showActions && (
                    <>
                      <button
                        type="button"
                        aria-label="Close actions menu"
                        onClick={() => setShowActions(false)}
                        className="fixed inset-0 z-[60] cursor-default bg-slate-900/30 backdrop-blur-[1px]"
                      />
                      <div className="absolute right-0 top-12 z-[70] w-56 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
                        <button
                          type="button"
                          disabled={!canCreatePaymentLink}
                          onClick={() => {
                            if (!canCreatePaymentLink) return;
                            setShowActions(false);
                            openPaymentLinkModal();
                          }}
                          title={canCreatePaymentLink ? undefined : "Create access is disabled for this role"}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-skillit disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white disabled:hover:text-slate-600"
                        >
                          <Link2 className="h-4 w-4" /> Create payment link
                        </button>
                        <button
                          type="button"
                          disabled={!canDeleteStudent}
                          onClick={() => {
                            if (!canDeleteStudent) return;
                            setShowActions(false);
                            run(() => dropStudent(student.id));
                          }}
                          title={canDeleteStudent ? undefined : "Delete access is disabled for this role"}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white"
                        >
                          <Trash2 className="h-4 w-4" /> Drop student
                        </button>
                        {canTransferStudent ? (
                          <button
                            type="button"
                            disabled={!canUpdateStudent}
                            onClick={() => {
                              if (!canUpdateStudent) return;
                              setShowActions(false);
                              setShowTransfer(true);
                            }}
                            title={canUpdateStudent ? undefined : "Update access is disabled for this role"}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-skillit disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white disabled:hover:text-slate-600"
                          >
                            <RefreshCw className="h-4 w-4" /> Transfer lead
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {!canManageStudent && (
              <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                This role has read-only access for student actions. Buttons remain visible but disabled until the role is granted access in Manage Roles.
              </p>
            )}

            <div className="mb-4 flex w-fit gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-card">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={[
                    "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                    tab === t ? "bg-skillit text-white shadow-sm" : "text-slate-500 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "Payments" && (
              <>
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    disabled={!canEditFees}
                    onClick={() => {
                      if (!canEditFees) return;
                      navigate(`/student/${student.id}/edit-fee-components${preserveContext}`);
                    }}
                    title={canEditFees ? undefined : "Update access is disabled for this role"}
                    className="flex items-center gap-1.5 text-sm text-skillit disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                </div>

                <div className="mb-6">
                  <h3 className="mb-3 text-base font-semibold text-slate-800">Payment Links</h3>
                  <DataTable
                    columns={[
                      { key: "amount", label: "Link Amount", render: (r) => money(r.amount) },
                      {
                        key: "status",
                        label: "Status",
                        render: (r) => (
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                            {r.status || "Pending"}
                          </span>
                        ),
                      },
                      {
                        key: "url",
                        label: "Link",
                        render: (r) => (r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-skillit hover:underline"
                          >
                            {r.url}
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )),
                      },
                      { key: "createdAt", label: "Generated On" },
                    ]}
                    rows={paymentLinks}
                    emptyText="No payment links generated yet."
                  />
                </div>

                <DataTable
                  columns={[
                    { key: "paidDate", label: "Paid Date" },
                    { key: "amount", label: "Amount", render: (r) => money(r.amount) },
                    { key: "product", label: "Product" },
                    { key: "mode", label: "Mode" },
                    { key: "refId", label: "Payment Reference ID" },
                  ]}
                  rows={student.payments || []}
                  emptyText="No payments recorded yet."
                />

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => {
                      if (!canAddPaymentPermission) return;
                      setAddPaymentError("");
                      setShowAddPayment(true);
                    }}
                    disabled={!canAddPaymentPermission}
                    title={canAddPaymentPermission ? undefined : "Create access is disabled for this role"}
                  >
                    <Plus className="h-4 w-4" /> Add Payment
                  </Button>
                </div>
              </>
            )}

            {tab === "Overview" && (
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <Info label="Course" value={student.course} />
                <Info label="Batch / Cycle" value={`${student.batch} - Cycle ${student.cycle}`} />
                <Info label="SDE" value={student.sdeName} />
                <Info label="Manager" value={student.manager} />
                <Info label="Date" value={student.date} />
                <Info label="Month" value={student.month} />
                <Info label="Order Status" value={student.status === "Dropped" ? "Dropped" : student.orderPunched ? student.status : "Not punched yet"} />
                <Info label="Payment Link" value={student.paymentLinkStatus} />
              </div>
            )}

            {tab === "Timeline" && (
              <ol className="relative ml-2 space-y-6 border-l-2 border-blue-100">
                <TimelineItem title="Student created" at={student.createdAt} detail={`By ${student.createdBy}`} />
                {paymentLinks.map((link, i) => (
                  <TimelineItem
                    key={`link-${i}`}
                    title="Payment link generated"
                    at={link.createdAt || student.date}
                    detail={`Amount ${money(link.amount)}`}
                  />
                ))}
                {student.payments?.map((p, i) => (
                  <TimelineItem key={i} title="Payment added" at={p.paidDate} detail={`${money(p.amount)} via ${p.mode}`} />
                ))}
                {student.orderPunched && <TimelineItem title="Order punched" at={student.date} detail="Booked order created" />}
                {student.status === "Enrolled" && <TimelineItem title="Enrolled" at={student.date} detail="Moved to Enrolled queue" />}
                {student.status === "Cancelled" && <TimelineItem title="Cancelled" at={student.date} detail="Order cancelled" />}
                {student.misStatus === "approved" && <TimelineItem title="MIS approved" at={student.date} detail="Approved and handed to Customer Support" />}
              </ol>
            )}
          </div>
        )}
      </div>

      {(!context || context === "payments" || context === "payment-link") && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!canPunchOrder}
            onClick={() => {
              if (!canPunchOrder) return;
              navigate(`/student/${student.id}/punch-order?context=${context || "detail"}`);
            }}
            title={canPunchOrder ? undefined : "Create access is disabled for this role"}
            className="inline-flex items-center gap-2 rounded-xl bg-skillit px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-skillit-dark disabled:cursor-not-allowed disabled:bg-skillit/45"
          >
            <PackagePlus className="h-4 w-4" /> Punch an Order
          </button>
        </div>
      )}

      {context === "pending" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="success"
            onClick={() => navigate(`/student/${student.id}/punch-order?context=pending`)}
            disabled={!canEnrollStudent}
            loading={busy}
            title={canEnrollStudent ? undefined : "Update access is disabled for this role"}
          >
            <CheckCircle2 className="h-4 w-4" /> Push to Enrollments
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!canCancelStudent) return;
              run(() => cancelStudent(student.id)).then(() => navigate("/cancelled"));
            }}
            disabled={!canCancelStudent}
            loading={busy}
            title={canCancelStudent ? undefined : "Delete access is disabled for this role"}
          >
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        </div>
      )}

      {context === "mis-approval" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="success"
            onClick={() => {
              if (!canApproveMis) return;
              run(() => misApprove(student.id)).then(() => navigate("/approved"));
            }}
            disabled={!canApproveMis}
            loading={busy}
            title={canApproveMis ? undefined : "Update access is disabled for this role"}
          >
            <ShieldCheck className="h-4 w-4" /> Approve
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!canCancelStudent) return;
              run(() => misCancel(student.id));
            }}
            disabled={!canCancelStudent}
            loading={busy}
            title={canCancelStudent ? undefined : "Delete access is disabled for this role"}
          >
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        </div>
      )}

      <Modal
        open={showAddPayment}
        onClose={() => {
          setShowAddPayment(false);
          setAddPaymentError("");
        }}
        hideHeader
        className="max-w-3xl"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canAddPaymentPermission) return;
            const f = new FormData(e.target);
            const amount = Number(f.get("amount") || 0);
            if (amount <= 0) {
              setAddPaymentError("Payment amount must be greater than zero.");
              return;
            }
            if (amount > outstandingBalance) {
              setAddPaymentError(`Payment amount cannot exceed the outstanding balance of ${statMoney(outstandingBalance)}.`);
              return;
            }
            setAddPaymentError("");
            await run(() => addPayment(student.id, {
              mode: f.get("mode"),
              amount,
              loanId: f.get("loanId"),
              date: fromDateInputValue(f.get("date")),
            }));
            setShowAddPayment(false);
          }}
          className="space-y-6"
        >
          <div className="flex items-start gap-4">
            <span className="mt-2 h-10 w-3 rounded-full bg-skillit" />
            <div>
              <h3 className="text-2xl font-semibold text-slate-800">Add Payment</h3>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Mode of Payment" required>
              <Select name="mode" required defaultValue="">
                <option value="" disabled>Mode of Payment</option>
                <option>Not Yet Decided</option>
                <option>Cash</option>
                <option>Swipe</option>
                <option>Bank Transactions</option>
                <option>Shopee</option>
                <option>FEEMONK</option>
                <option>FullPayment</option>
                <option>2Shot Payment</option>
                <option>JODO Flex</option>
              </Select>
            </Field>

            <Field label="Amount" required>
              <Input
                name="amount"
                type="number"
                min="0"
                max={outstandingBalance}
                required
                placeholder="Amount"
              />
              <p className="mt-1 text-xs text-slate-400">
                Remaining outstanding: {statMoney(outstandingBalance)}
              </p>
            </Field>

            <Field label="Loan ID">
              <Input name="loanId" placeholder="Loan ID" />
            </Field>

              <Field label="Transaction Date" required>
              <Input name="date" type="date" max={todayDateInputValue()} required placeholder="Transaction Date" />
            </Field>
          </div>

          {addPaymentError && <p className="text-sm text-red-500">{addPaymentError}</p>}

          <div className="flex justify-end gap-3 pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowAddPayment(false);
                setAddPaymentError("");
              }}
              className="!text-skillit"
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy} className="min-w-[170px]" disabled={!canAddPaymentPermission}>
              Add Payment
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showPaymentLink}
        onClose={() => {
          setShowPaymentLink(false);
          setPaymentLinkError("");
        }}
        hideHeader
        className="max-w-3xl"
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-2xl font-semibold text-slate-800">Create Payment Link</h3>
            <p className="mt-5 text-lg font-semibold text-slate-700">Fee details</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            <div className="grid gap-4 md:grid-cols-[1.7fr_1fr_auto] md:items-center">
              <div>
                <p className="text-xs text-slate-400">Fee Description</p>
                <p className="mt-1 text-lg font-semibold text-slate-800">Course Fee</p>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-slate-400">Amount</label>
              <Input
                  value={paymentLinkAmount}
                  onChange={(e) => setPaymentLinkAmount(e.target.value)}
                  type="number"
                  min="0"
                  max={availableLinkBalance}
                  className="mt-1 bg-white text-base"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Remaining available for links: {statMoney(availableLinkBalance)}
                </p>
                {paymentLinkError && <p className="mt-2 text-sm text-red-500">{paymentLinkError}</p>}
              </div>
              <button
                type="button"
                onClick={() => setPaymentLinkAmount("")}
                className="mt-5 grid h-7 w-7 place-items-center rounded-full text-skillit transition-colors hover:bg-blue-50"
                aria-label="Clear amount"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-24">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowPaymentLink(false);
                setPaymentLinkError("");
              }}
              className="!text-skillit"
            >
              Cancel
            </Button>
            <Button loading={busy} onClick={confirmPaymentLink} className="min-w-[130px]" disabled={!canCreatePaymentLink}>
              Continue
            </Button>
          </div>
        </div>
      </Modal>

      <TransferLeadModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        student={student}
        onTransferred={refresh}
      />

    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-display font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium text-slate-700">{value || "-"}</p>
    </div>
  );
}

function TimelineItem({ title, at, detail }) {
  return (
    <li className="ml-5">
      <span className="absolute -left-[7px] h-3 w-3 rounded-full bg-skillit ring-4 ring-blue-50" />
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-400">{at}</p>
      <p className="mt-1 text-sm text-slate-500 data-font">{detail}</p>
    </li>
  );
}

function Section({ id, icon, title, children }) {
  return (
    <section id={id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card scroll-mt-28">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-50 pb-3">
        <span className="text-skillit">{icon}</span>
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}
