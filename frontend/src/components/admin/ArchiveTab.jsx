import React, { useMemo } from "react";
import DataTable from "../DataTable";
import * as adminApi from "../../api/admin";

const ROLE_PILL_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-purple-100 text-purple-700",
];

function pillColor(label = "") {
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) % ROLE_PILL_COLORS.length;
  return ROLE_PILL_COLORS[hash];
}

export default function ArchiveTab({ users = [], loading, search, onRefresh, onViewDetails }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleRestore = async (u) => {
    if (!window.confirm(`Restore user "${u.name}"?`)) return;
    try {
      await adminApi.restoreUser(u.id);
      onRefresh();
    } catch (error) {
      window.alert(error?.response?.data?.message || "Failed to restore user.");
    }
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "180px",
      render: (r) => (
        <button
          type="button"
          onClick={() => onViewDetails?.(r.id)}
          className="font-medium text-skillit hover:underline text-left outline-none"
        >
          {r.name}
        </button>
      )
    },
    { key: "email", label: "Email", width: "240px", cellClassName: "whitespace-nowrap" },
    {
      key: "status", label: "Status", width: "120px", cellClassName: "whitespace-nowrap",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> {r.status}
        </span>
      ),
    },
    {
      key: "role", label: "Role", width: "120px",
      render: (r) => (
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${pillColor(r.designation || r.role)}`}>
          {r.designation || r.role}
        </span>
      ),
    },
    { key: "reportingManagerName", label: "Reporting Manager", width: "180px", cellClassName: "whitespace-nowrap" },
    { key: "createdAt", label: "Created At", width: "170px", render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : "-" },
    { key: "updatedAt", label: "Upadated At", width: "170px", render: (r) => r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "-" },
    { key: "createdBy", label: "Created By", width: "130px", cellClassName: "whitespace-nowrap" },
    { key: "updatedBy", label: "Upadated By", width: "130px", cellClassName: "whitespace-nowrap" },
  ];

  return (
    <DataTable
      columns={columns}
      rows={filtered}
      tableLayout="auto"
      emptyText={loading ? "Loading archived users…" : "No archived users yet."}
      rowMenu={(r) => [
        { label: "Restore", onClick: () => handleRestore(r) },
      ]}
    />
  );
}
