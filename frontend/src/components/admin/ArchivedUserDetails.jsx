import React, { useEffect, useState } from "react";
import { ArrowLeft, User, Mail, Users, Calendar } from "lucide-react";
import DataTable from "../DataTable";
import * as adminApi from "../../api/admin";

export default function ArchivedUserDetails({ userId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("students");

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    adminApi.getUserHistoricalData(userId)
      .then(setData)
      .catch((err) => {
        alert(err?.response?.data?.message || "Failed to load archived user details.");
        onBack();
      })
      .finally(() => setLoading(false));
  }, [userId, onBack]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading profile and history...</div>
      </div>
    );
  }

  if (!data) return null;

  const { user, studentsCreated, payments, bookedOrders, enrollments } = data;

  const TABS = [
    { id: "students", label: "Students Created", count: studentsCreated.length },
    { id: "payments", label: "Payments", count: payments.length },
    { id: "booked", label: "Booked Orders", count: bookedOrders.length },
    { id: "enrollments", label: "Enrollments", count: enrollments.length },
  ];

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-display font-bold text-slate-800">Archived User Profile</h2>
          <p className="text-sm text-slate-500">View history and archive reference records</p>
        </div>
      </div>

      {/* Info Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* User Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-card flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Name</p>
            <p className="font-display font-semibold text-slate-800 truncate mt-0.5">{user.name}</p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full mt-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> Archived
            </span>
          </div>
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-card flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Email</p>
            <p className="font-medium text-slate-700 truncate mt-0.5">{user.email}</p>
            <p className="text-xs text-slate-400 mt-1">{user.designation || user.role}</p>
          </div>
        </div>

        {/* Team & Hierarchy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-card flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Hierarchy & Team</p>
            <p className="font-semibold text-slate-800 mt-0.5 truncate">{user.team}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">Mgr: {user.reportingManager}</p>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-card flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Audit Dates</p>
            <p className="text-xs text-slate-600 mt-0.5">Created: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</p>
            <p className="text-xs text-slate-600 mt-0.5">Archived: {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "-"}</p>
          </div>
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className="border-b border-slate-100 flex gap-2 overflow-x-auto pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={[
              "px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-2",
              activeTab === t.id
                ? "border-skillit text-skillit"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200"
            ].join(" ")}
          >
            {t.label}
            <span className={[
              "text-xs px-2 py-0.5 rounded-full font-medium transition-colors",
              activeTab === t.id ? "bg-blue-50 text-skillit" : "bg-slate-100 text-slate-600"
            ].join(" ")}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        {activeTab === "students" && (
          <DataTable
            columns={[
              {
                key: "uniqueId",
                label: "Unique ID",
                width: "120px",
                render: (r) => (
                  <a
                    href={`/student/${r.id}?readOnly=true`}
                    className="text-xs font-semibold text-slate-500 hover:text-skillit underline"
                  >
                    {r.uniqueId}
                  </a>
                )
              },
              {
                key: "customerName",
                label: "Student Name",
                width: "200px",
                render: (r) => (
                  <a
                    href={`/student/${r.id}?readOnly=true`}
                    className="font-medium text-skillit hover:underline"
                  >
                    {r.customerName}
                  </a>
                )
              },
              { key: "email", label: "Email", width: "240px" },
              {
                key: "status",
                label: "Status",
                width: "120px",
                render: (r) => (
                  <span className={[
                    "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                    r.status === "Enrolled" ? "bg-emerald-50 text-emerald-700" :
                    r.status === "Pending" ? "bg-amber-50 text-amber-700" :
                    "bg-slate-100 text-slate-700"
                  ].join(" ")}>
                    {r.status}
                  </span>
                )
              },
              { key: "createdAt", label: "Created At", width: "170px", render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : "-" }
            ]}
            rows={studentsCreated}
            emptyText="No students created by this user."
          />
        )}

        {activeTab === "payments" && (
          <DataTable
            columns={[
              {
                key: "studentName",
                label: "Student Name",
                width: "180px",
                render: (r) => (
                  <a
                    href={`/student/${r.studentId}?readOnly=true`}
                    className="font-medium text-skillit hover:underline"
                  >
                    {r.studentName}
                  </a>
                )
              },
              { key: "studentUniqueId", label: "Student Unique ID", width: "140px" },
              { key: "paidDate", label: "Paid Date", width: "140px" },
              { key: "amount", label: "Amount", width: "120px", render: (r) => `₹${Number(r.amount).toLocaleString("en-IN")}` },
              { key: "mode", label: "Mode", width: "140px" },
              { key: "product", label: "Product", width: "140px" },
              { key: "refId", label: "Ref ID", width: "140px" },
              { key: "statementId", label: "Statement ID", width: "140px" },
            ]}
            rows={payments}
            emptyText="No payments processed by this user."
          />
        )}

        {activeTab === "booked" && (
          <DataTable
            columns={[
              {
                key: "uniqueId",
                label: "Unique ID",
                width: "120px",
                render: (r) => (
                  <a
                    href={`/student/${r.id}?readOnly=true`}
                    className="text-xs font-semibold text-slate-500 hover:text-skillit underline"
                  >
                    {r.uniqueId}
                  </a>
                )
              },
              {
                key: "customerName",
                label: "Student Name",
                width: "200px",
                render: (r) => (
                  <a
                    href={`/student/${r.id}?readOnly=true`}
                    className="font-medium text-skillit hover:underline"
                  >
                    {r.customerName}
                  </a>
                )
              },
              { key: "email", label: "Email", width: "240px" },
              { key: "amount", label: "Value", width: "120px", render: (r) => `₹${Number(r.amount).toLocaleString("en-IN")}` },
              { key: "orderPunchedAt", label: "Punched At", width: "170px", render: (r) => r.orderPunchedAt ? new Date(r.orderPunchedAt).toLocaleString() : "-" }
            ]}
            rows={bookedOrders}
            emptyText="No booked orders associated with this user."
          />
        )}

        {activeTab === "enrollments" && (
          <DataTable
            columns={[
              {
                key: "uniqueId",
                label: "Unique ID",
                width: "120px",
                render: (r) => (
                  <a
                    href={`/student/${r.id}?readOnly=true`}
                    className="text-xs font-semibold text-slate-500 hover:text-skillit underline"
                  >
                    {r.uniqueId}
                  </a>
                )
              },
              {
                key: "customerName",
                label: "Student Name",
                width: "200px",
                render: (r) => (
                  <a
                    href={`/student/${r.id}?readOnly=true`}
                    className="font-medium text-skillit hover:underline"
                  >
                    {r.customerName}
                  </a>
                )
              },
              { key: "email", label: "Email", width: "240px" },
              { key: "program", label: "Program", width: "180px" },
              { key: "batch", label: "Batch", width: "100px" },
              { key: "enrolledAt", label: "Enrolled At", width: "170px", render: (r) => r.enrolledAt ? new Date(r.enrolledAt).toLocaleString() : "-" }
            ]}
            rows={enrollments}
            emptyText="No enrollments associated with this user."
          />
        )}
      </div>
    </div>
  );
}
