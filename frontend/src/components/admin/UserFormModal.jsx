import React, { useEffect, useMemo, useState } from "react";
import Modal from "../Modal";
import Button from "../Button";
import { Field, Input, Select, PhoneInput, ToggleSwitch, normalizePhone, toDateInputValue, fromDateInputValue } from "../Field";
import { RotateCcw, Trash2, Archive as ArchiveIcon } from "lucide-react";
import { listRoles } from "../../api/admin";
import { sortRoles } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";
import { isSdeDesignation } from "../../lib/userHierarchy";

function designationKey(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  roleId: "",
  dateOfJoining: "",
  department: "",
  appAccess: false,
};

export default function UserFormModal({ open, onClose, onSave, onArchive, onResetPassword, onResetLoginAttempts, user, managers = [] }) {
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const isEdit = !!user;

  // The Role select's VALUE is always a real Role._id (or the reserved
  // "admin" sentinel) — never a free-text name. This is the single source
  // of truth for who gets what access; it's a hard foreign key end to end,
  // not a string that can drift out of sync with the actual Role document.
  useEffect(() => {
    if (!open) return;
    listRoles()
      .then((list) => setRoles(sortRoles(list)))
      .catch(() => setRoles([]));
  }, [open]);

  const roleOptions = useMemo(() => [{ id: "admin", name: "Admin" }, ...roles], [roles]);

  useEffect(() => {
    if (open) {
      setForm(
        user
          ? {
              name: user.name || "",
              email: user.email || "",
              phone: user.phone || "",
              roleId: user.role === "admin" ? "admin" : (user.roleId || ""),
              dateOfJoining: toDateInputValue(user.dateOfJoining),
              department: user.department || "",
              appAccess: !!user.appAccess,
            }
          : emptyForm
      );
    }
  }, [open, user]);

  const set = (key) => (e) => {
    const value = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.roleId) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        phone: normalizePhone(form.phone),
        dateOfJoining: fromDateInputValue(form.dateOfJoining),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        phone: normalizePhone(form.phone),
        dateOfJoining: fromDateInputValue(form.dateOfJoining),
        status: user.status === "Active" ? "Inactive" : "Active",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit User" : "Create User"} wide hideHeader>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1.5 rounded-full bg-skillit inline-block" />
            <h3 className="font-display font-semibold text-slate-800 text-lg">{isEdit ? "Edit User" : "Create User"}</h3>
          </div>
          <div className="flex items-center gap-2">
            {isEdit && (
              <>
                <Button variant="outline" onClick={() => onResetLoginAttempts?.(user)}>
                  <RotateCcw className="h-4 w-4" /> Reset Login Attempts
                </Button>
                <Button
                  variant={user.status === "Active" ? "danger" : "success"}
                  onClick={handleToggleStatus}
                  loading={saving}
                >
                  {user.status === "Active" ? "Inactive" : "Active"}
                </Button>
                {user?.id !== currentUser?.id && !isSdeDesignation(user.designation || user.role) && (
                  <Button variant="danger" onClick={() => onArchive?.(user)}>
                    <ArchiveIcon className="h-4 w-4" /> Archive
                  </Button>
                )}
              </>
            )}
            <button onClick={onClose} className="h-8 w-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700">x</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<Field label="Role" required>
            <Select value={form.roleId} onChange={set("roleId")}> 
              <option value="">Select...</option>
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Full Name" required>
            <Input placeholder="Enter Full Name" value={form.name} onChange={set("name")} />
          </Field>

          <Field label="Email" required>
            <Input type="email" placeholder="Enter Email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Mobile" required>
            <PhoneInput placeholder="Enter number" value={form.phone} onChange={set("phone")} />
          </Field>

          <Field label="Date of Joining" required>
            <Input type="date" value={form.dateOfJoining} onChange={set("dateOfJoining")} />
          </Field>
          <Field label="Department" required>
            <Input placeholder="Enter Department" value={form.department} onChange={set("department")} />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">App Access</span>
            <ToggleSwitch
              checked={form.appAccess}
              onChange={() => set("appAccess")(!form.appAccess)}
              label="App Access"
            />
          </div>
          {isEdit && (
            <button
              type="button"
              onClick={() => onResetPassword?.(user)}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              Reset Password
            </button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
