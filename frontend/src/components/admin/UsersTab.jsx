import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import DataTable from "../DataTable";
import UserFormModal from "./UserFormModal";
import * as adminApi from "../../api/admin";
import { useAuth } from "../../context/AuthContext";
import { isSdeDesignation } from "../../lib/userHierarchy";

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

const UsersTab = forwardRef(function UsersTab({ users, loading, search, onRefresh }, ref) {
  const { user: currentUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const managers = useMemo(() => users, [users]);
  useImperativeHandle(ref, () => ({ openCreate: () => { setEditingUser(null); setModalOpen(true); } }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const openCreate = () => { setEditingUser(null); setModalOpen(true); };
  const openEdit = (u) => { setEditingUser(u); setModalOpen(true); };

  const handleSave = async (payload) => {
    if (editingUser) {
      await adminApi.updateUser(editingUser.id, payload);
    } else {
      await adminApi.createUser(payload);
    }
    onRefresh();
  };

  const handleArchive = async (u) => {
    if (isSdeDesignation(u.designation || u.role)) {
      window.alert("SDE accounts cannot be archived or deleted.");
      return;
    }
    if (!window.confirm(`Archive user "${u.name}"?`)) return;
    await adminApi.archiveUser(u.id);
    setModalOpen(false);
    onRefresh();
  };

  const handleResetPassword = async (u) => {
    const pwd = window.prompt(`New password for ${u.name}`, "skillit123");
    if (!pwd) return;
    await adminApi.resetPassword(u.id, pwd);
    window.alert("Password reset.");
  };

  const handleResetLoginAttempts = async (u) => {
    await adminApi.resetLoginAttempts(u.id);
    onRefresh();
  };

  const columns = [
    { key: "name", label: "Name", width: "180px", render: (r) => <span className="text-skillit font-medium cursor-pointer" onClick={() => openEdit(r)}>{r.name}</span> },
    { key: "email", label: "Email", width: "240px", cellClassName: "whitespace-nowrap" },
    {
      key: "status", label: "Status", width: "120px", cellClassName: "whitespace-nowrap",
      render: (r) => (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${r.status === "Active" ? "text-emerald-600" : "text-slate-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${r.status === "Active" ? "bg-emerald-500" : "bg-slate-300"}`} /> {r.status}
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
    <>
      <DataTable
        columns={columns}
        rows={filtered}
        tableLayout="auto"
        emptyText={loading ? "Loading users…" : "No users yet. Use the + button to create one."}
        rowMenu={(r) => {
          const menu = [{ label: "Edit", onClick: () => openEdit(r) }];
          if (r.id !== currentUser?.id && !isSdeDesignation(r.designation || r.role)) {
            menu.push({ label: "Archive", onClick: () => handleArchive(r) });
          }
          return menu;
        }}
      />

      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={handleArchive}
        onResetPassword={handleResetPassword}
        onResetLoginAttempts={handleResetLoginAttempts}
        user={editingUser}
        managers={managers}
      />
    </>
  );
});

export default UsersTab;
