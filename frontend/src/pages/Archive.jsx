import React, { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import * as adminApi from "../api/admin";

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

export default function Archive() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchArchivedUsers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listArchivedUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load archived users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.trim().toLowerCase()) ||
      u.email?.toLowerCase().includes(search.trim().toLowerCase())
  );

  const columns = [
    { key: "name", label: "Name", width: "180px", render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: "email", label: "Email", width: "240px", cellClassName: "whitespace-nowrap" },
    {
      key: "status",
      label: "Status",
      width: "120px",
      cellClassName: "whitespace-nowrap",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> {r.status}
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      width: "120px",
      render: (r) => (
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${pillColor(r.designation || r.role)}`}>
          {r.designation || r.role}
        </span>
      ),
    },
    { key: "reportingManagerName", label: "Reporting Manager", width: "180px", cellClassName: "whitespace-nowrap" },
    { key: "createdAt", label: "Created At", width: "170px", render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "-") },
    { key: "updatedAt", label: "Updated At", width: "170px", render: (r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "-") },
    { key: "createdBy", label: "Created By", width: "130px", cellClassName: "whitespace-nowrap" },
    { key: "updatedBy", label: "Updated By", width: "130px", cellClassName: "whitespace-nowrap" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
      <Topbar
        title="Archive"
        subtitle="View archived users and reference historical records."
        right={
          <div className="relative">
            <input
              type="text"
              placeholder="Search archived users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-4 py-2 text-sm text-slate-800 outline-none transition-all focus:border-skillit focus:ring-4 focus:ring-blue-100"
            />
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={filtered}
          tableLayout="auto"
          emptyText={loading ? "Loading archived users…" : "No archived users found."}
        />
      </div>
    </div>
  );
}
