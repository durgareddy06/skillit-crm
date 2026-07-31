import React, { useEffect, useMemo, useState } from "react";
import Modal from "../Modal";
import Button from "../Button";
import { Field, Input, Select, Textarea } from "../Field";
import AssignUsersPanel from "./AssignUsersPanel";
import {
  isManagerDesignation,
  isSrManagerDesignation,
  isSdeDesignation,
} from "../../lib/userHierarchy";

export default function TeamFormModal({ open, onClose, onSave, onAssignUsers, team, managers = [], allUsers = [], teams = [] }) {
  const [form, setForm] = useState({ name: "", manager: "", description: "" });
  const [view, setView] = useState("form"); // 'form' | 'assign'
  const [saving, setSaving] = useState(false);
  const isEdit = !!team;

  useEffect(() => {
    if (open) {
      setView("form");
      setForm(
        team
          ? { name: team.name || "", manager: team.manager || "", description: team.description || "" }
          : { name: "", manager: "", description: "" }
      );
    }
  }, [open, team]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name || !form.manager) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const managerOptions = useMemo(
    () => managers.filter((m) => !isSdeDesignation(m.designation || m.role)),
    [managers]
  );

  const assignableUsers = useMemo(() => {
    const currentTeamMemberIds = new Set((team?.members || []).map((id) => String(id)));
    const blockedIds = new Set();

    for (const otherTeam of teams) {
      if (otherTeam.id === team?.id) continue;
      for (const memberId of otherTeam.members || []) {
        const user = allUsers.find((u) => String(u.id) === String(memberId));
        const designation = user?.designation || user?.role || "";
        const restricted = user && isSdeDesignation(designation);
        if (restricted) blockedIds.add(String(memberId));
      }
    }

    return allUsers.filter((user) => {
      const userId = String(user.id);
      if (team && String(team.manager) === userId) return false;
      return currentTeamMemberIds.has(userId) || !blockedIds.has(userId);
    });
  }, [allUsers, team, teams]);

  const handleAssignSave = async (userIds) => {
    await onAssignUsers(team.id, userIds);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="" wide hideHeader>
      <div className="p-6">
        {view === "assign" && team ? (
          <AssignUsersPanel
            allUsers={assignableUsers}
            assignedIds={team.members || []}
            onCancel={() => setView("form")}
            onSave={handleAssignSave}
          />
        ) : !isEdit ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="h-5 w-1.5 rounded-full bg-skillit inline-block" />
                <h3 className="font-display font-semibold text-slate-800 text-lg">Create Team</h3>
              </div>
              <button onClick={onClose} className="h-8 w-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Role Name" required>
                <Input placeholder="Enter Team Name" value={form.name} onChange={set("name")} />
              </Field>
              <Field label="Role Manager" required>
                <Select value={form.manager} onChange={set("manager")}>
                  <option value="">Select…</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="h-5 w-1.5 rounded-full bg-skillit inline-block" />
                <h3 className="font-display font-semibold text-slate-800 text-lg">Edit Team</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={team.status === "Active" ? "danger" : "success"}
                  onClick={() => onSave({ ...form, status: team.status === "Active" ? "Inactive" : "Active" })}
                >
                  {team.status === "Active" ? "Inactive" : "Active"}
                </Button>
                <Button variant="primary" onClick={() => setView("assign")}>Assign Users</Button>
                <button onClick={onClose} className="h-8 w-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100">×</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Team Name" required>
                <Input value={form.name} onChange={set("name")} />
              </Field>
              <Field label="Select Manager" required>
                <Select value={form.manager} onChange={set("manager")}> 
                  <option value="">Select…</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Description">
                <Textarea placeholder="Enter Description" value={form.description} onChange={set("description")} />
              </Field>
            </div>

            <div className="mt-4 bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-1">Status</p>
                <p className="font-medium text-slate-700">{team.status}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">User Count</p>
                <p className="font-medium text-slate-700">{team.userCount}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Created At</p>
                <p className="font-medium text-slate-700">{team.createdAt ? new Date(team.createdAt).toLocaleString() : "-"}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Created By</p>
                <p className="font-medium text-slate-700">{team.createdBy || "-"}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Updated At</p>
                <p className="font-medium text-slate-700">{team.updatedAt ? new Date(team.updatedAt).toLocaleString() : "-"}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Updated By</p>
                <p className="font-medium text-slate-700">{team.updatedBy || "-"}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
