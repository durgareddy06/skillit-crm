import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import DataTable from "../DataTable";
import CreateRoleModal from "./CreateRoleModal";
import RolePermissionsEditor from "./RolePermissionsEditor";
import Modal from "../Modal";
import Button from "../Button";
import { Field, Select } from "../Field";
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

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferringRole, setTransferringRole] = useState(null);
  const [destRoleId, setDestRoleId] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

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
    if (r.userCount > 0) {
      setTransferringRole(r);
      const otherRoles = roles.filter((role) => role.id !== r.id);
      setDestRoleId(otherRoles[0]?.id || "");
      setTransferModalOpen(true);
      return;
    }

    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    try {
      await adminApi.deleteRole(r.id);
      onRefresh();
      signalPermissionRefresh();
    } catch (error) {
      window.alert(error?.response?.data?.message || "Unable to delete role.");
    }
  };

  const handleTransferAndConfirm = async () => {
    if (!destRoleId) return;
    setTransferLoading(true);
    try {
      await adminApi.transferRoleUsers(transferringRole.id, destRoleId);
      await adminApi.deleteRole(transferringRole.id);
      setTransferModalOpen(false);
      setTransferringRole(null);
      onRefresh();
      signalPermissionRefresh();
      await refreshUser();
    } catch (error) {
      window.alert(error?.response?.data?.message || "Unable to transfer users and delete role.");
    } finally {
      setTransferLoading(false);
    }
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

      <Modal
        open={transferModalOpen}
        onClose={() => !transferLoading && setTransferModalOpen(false)}
        title="Transfer Users"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            This role cannot be deleted because users are still assigned to it. Please reassign all users to another role before deleting this role.
          </p>

          <Field label="Destination Role" required>
            <Select
              value={destRoleId}
              onChange={(e) => setDestRoleId(e.target.value)}
              disabled={transferLoading}
            >
              <option value="" disabled>Select a role...</option>
              {roles
                .filter((role) => role.id !== transferringRole?.id)
                .map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.userCount || 0} users)
                  </option>
                ))}
            </Select>
          </Field>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTransferModalOpen(false)}
              disabled={transferLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleTransferAndConfirm}
              loading={transferLoading}
              disabled={!destRoleId}
            >
              Transfer Users
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
});

export default RolesTab;
