import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import DataTable from "../DataTable";
import CreateRoleModal from "./CreateRoleModal";
import RolePermissionsEditor from "./RolePermissionsEditor";
import * as adminApi from "../../api/admin";
import { useAuth } from "../../context/AuthContext";

const ROLE_PILL_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];
function pillColor(label = "") {
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) % ROLE_PILL_COLORS.length;
  return ROLE_PILL_COLORS[hash];
}

const RolesTab = forwardRef(function RolesTab({ roles, loading, search, onRefresh, onEditingChange }, ref) {
  const { refreshUser } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  useImperativeHandle(ref, () => ({ openCreate: () => setCreateOpen(true) }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.name?.toLowerCase().includes(q));
  }, [roles, search]);

  const openEdit = async (r) => {
    const full = await adminApi.getRole(r.id);
    setEditingRole(full);
    onEditingChange?.(true);
  };

  const signalPermissionRefresh = () => {
    localStorage.setItem("skillit_permissions_updated_at", String(Date.now()));
  };

  const closeEdit = () => {
    setEditingRole(null);
    onEditingChange?.(false);
  };

  const handleCreate = async (payload) => {
    await adminApi.createRole(payload);
    onRefresh();
    signalPermissionRefresh();
  };

  const handleSavePermissions = async (payload) => {
    await adminApi.updateRole(editingRole.id, payload);
    onRefresh();
    signalPermissionRefresh();
    await refreshUser();
    closeEdit();
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    await adminApi.deleteRole(r.id);
    onRefresh();
    signalPermissionRefresh();
  };

  if (editingRole) {
    return <RolePermissionsEditor role={editingRole} onCancel={closeEdit} onSave={handleSavePermissions} />;
  }

  const columns = [
    {
      key: "name", label: "Role Name", width: "180px",
      render: (r) => (
        <span
          onClick={() => openEdit(r)}
          className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer ${pillColor(r.name)}`}
        >
          {r.name}
        </span>
      ),
    },
    {
      key: "status", label: "Status", width: "120px", cellClassName: "whitespace-nowrap",
      render: (r) => (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${r.status === "Active" ? "text-emerald-600" : "text-slate-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${r.status === "Active" ? "bg-emerald-500" : "bg-slate-300"}`} /> {r.status}
        </span>
      ),
    },
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
        emptyText={loading ? "Loading roles…" : "No roles yet. Use the + button to create one."}
        rowMenu={(r) => [
          { label: "Edit Permissions", onClick: () => openEdit(r) },
          { label: "Delete", onClick: () => handleDelete(r) },
        ]}
      />

      <CreateRoleModal open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreate} />
    </>
  );
});

export default RolesTab;
