import React from "react";
import { MoreVertical, BarChart2 } from "lucide-react";
import { formatPhoneDisplay } from "../components/Field";

export function buildSupportTableColumns({ nameExtra, onNameClick }) {
  return [
    {
      key: "customerName",
      label: "Customer",
      width: "220px",
      cellClassName: "whitespace-nowrap",
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          {onNameClick ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNameClick(r);
              }}
              className="inline-flex items-center gap-2 rounded-full px-2 py-1 font-medium text-skillit transition-colors hover:bg-blue-50"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-blue-100 bg-white text-skillit shadow-sm transition-all duration-150 hover:bg-blue-50">
                <MoreVertical className="h-4 w-4" />
              </span>
              {r.customerName}
            </button>
          ) : (
            <span className="font-medium text-slate-700">{r.customerName}</span>
          )}
          {nameExtra ? <span className="shrink-0">{nameExtra(r)}</span> : null}
        </span>
      ),
    },
    { key: "date", label: "Date", width: "120px", cellClassName: "whitespace-nowrap" },
    { key: "month", label: "Month", width: "110px", cellClassName: "whitespace-nowrap" },
    { key: "cycle", label: "Cycle", width: "90px", cellClassName: "whitespace-nowrap" },
    { key: "course", label: "Course", width: "220px", cellClassName: "whitespace-normal break-words" },
    { key: "primaryContactName", label: "Customer Contact Name", width: "220px", cellClassName: "whitespace-normal break-words" },
    { key: "sdeName", label: "SDE Name", width: "160px", cellClassName: "whitespace-nowrap" },
    { key: "manager", label: "Manager", width: "160px", cellClassName: "whitespace-nowrap" },
    { key: "demoDoneBy", label: "Demo By", width: "150px", cellClassName: "whitespace-nowrap" },
    {
      key: "status",
      label: "Status",
      width: "120px",
      cellClassName: "whitespace-nowrap",
      render: (r) => {
        const status = r.status || "Active";
        const tone =
          status === "Cancelled" || status === "Dropped"
            ? "bg-red-500 text-white"
            : status === "Enrolled" || status === "Active"
              ? "bg-emerald-500 text-white"
              : "bg-blue-50 text-blue-600";

        return (
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
            {status}
          </span>
        );
      },
    },
    { key: "paymentMode", label: "Payment Mode", width: "160px", cellClassName: "whitespace-nowrap" },
    { key: "saleValue", label: "Sale Value", width: "140px", cellClassName: "whitespace-nowrap" },
    { key: "paidAmount", label: "Paid Amount", width: "140px", cellClassName: "whitespace-nowrap" },
    { key: "outstanding", label: "Outstanding", width: "140px", cellClassName: "whitespace-nowrap" },
    { key: "altContactNumber", label: "Alternative Phone Number", width: "220px", cellClassName: "whitespace-nowrap", render: (r) => formatPhoneDisplay(r.altContactNumber) },
  ];
}

export function SupportActivityButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => onClick?.(e)}
      title="View activity"
      className="text-slate-400 hover:text-skillit transition-colors btn-anim"
    >
      <BarChart2 className="h-4 w-4" />
    </button>
  );
}
