import React, { useEffect, useState } from "react";
import Modal from "../Modal";
import Button from "../Button";
import { Field, Input, Select } from "../Field";
import { listRoles } from "../../api/admin";
import { DEFAULT_ROLE_NAMES, sortRoleNames } from "../../config/roles";

export default function CreateRoleModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [nameMode, setNameMode] = useState("");
  const [saving, setSaving] = useState(false);
  const [roleOptions, setRoleOptions] = useState([]);

  useEffect(() => {
    if (open) {
      setForm({ name: "", description: "" });
      setNameMode("");
      listRoles()
        .then((roles) => {
          const fetched = (roles || []).map((r) => r.name).filter(Boolean);
          setRoleOptions(sortRoleNames([...DEFAULT_ROLE_NAMES, ...fetched]));
        })
        .catch(() => setRoleOptions([]));
    }
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleNameModeChange = (e) => {
    const next = e.target.value;
    setNameMode(next);
    setForm((current) => ({
      ...current,
      name: next === "__custom__" ? "" : next,
    }));
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Role">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Role Name" required>
          <div className="space-y-2">
            <Select value={nameMode || (form.name ? "__custom__" : "")} onChange={handleNameModeChange}>
              <option value="">Select role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
              <option value="__custom__">Other</option>
            </Select>
            {(nameMode === "__custom__" || (!roleOptions.includes(form.name) && form.name)) && (
              <Input
                placeholder="Enter role name"
                value={form.name}
                onChange={set("name")}
              />
            )}
          </div>
        </Field>
        <Field label="Description">
          <Input placeholder="Enter Description" value={form.description} onChange={set("description")} />
        </Field>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Save</Button>
      </div>
    </Modal>
  );
}
