import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { Field, Select } from "./Field";
import { listTransferTargets, transferStudent } from "../api/students";

// Backend validates the hierarchy rule regardless of what's shown here.
// Admins can transfer to any active user. Managers and Senior Managers only
// see active SDE targets inside their allowed hierarchy scope.
export default function TransferLeadModal({ open, onClose, student, onTransferred }) {
  const [targets, setTargets] = useState([]);
  const [toUserId, setToUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setToUserId("");
    setLoading(true);
    listTransferTargets()
      .then((users) => setTargets(users))
      .catch(() => setError("Couldn't load transfer targets"))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    if (!toUserId || !student) return;
    setSaving(true);
    setError("");
    try {
      await transferStudent(student.id, toUserId);
      onTransferred?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't transfer this lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Transfer Lead">
      <div className="p-6">
        <p className="text-sm text-slate-500 mb-4">
          Transfer <span className="font-medium text-slate-700">{student?.customerName}</span> to an eligible SDE in your scope.
        </p>
        <Field label="Transfer to" required>
          <Select value={toUserId} onChange={(e) => setToUserId(e.target.value)} disabled={loading}>
            <option value="">{loading ? "Loading..." : "Select a user..."}</option>
            {targets.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.designation ? ` - ${u.designation}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        {!loading && targets.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">No eligible SDEs found in your scope.</p>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!toUserId}>Transfer</Button>
        </div>
      </div>
    </Modal>
  );
}
