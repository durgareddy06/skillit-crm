import React, { useEffect, useMemo, useState } from "react";
import Button from "../Button";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function AssignUsersPanel({ allUsers, assignedIds, onCancel, onSave }) {
  const [availableChecked, setAvailableChecked] = useState(new Set());
  const [assignedChecked, setAssignedChecked] = useState(new Set());
  const [assigned, setAssigned] = useState(new Set(assignedIds));
  const [availSearch, setAvailSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAssigned(new Set(assignedIds));
    setAvailableChecked(new Set());
    setAssignedChecked(new Set());
  }, [assignedIds]);

  const available = useMemo(
    () => allUsers.filter((u) => !assigned.has(u.id)),
    [allUsers, assigned]
  );
  const assignedUsers = useMemo(
    () => allUsers.filter((u) => assigned.has(u.id)),
    [allUsers, assigned]
  );

  const filteredAvailable = available.filter(
    (u) => !availSearch || u.name?.toLowerCase().includes(availSearch.toLowerCase()) || u.email?.toLowerCase().includes(availSearch.toLowerCase())
  );
  const filteredAssigned = assignedUsers.filter(
    (u) => !assignedSearch || u.name?.toLowerCase().includes(assignedSearch.toLowerCase()) || u.email?.toLowerCase().includes(assignedSearch.toLowerCase())
  );

  const toggle = (set, setSet, id) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setSet(next);
  };

  const moveRight = () => {
    setAssigned((prev) => new Set([...prev, ...availableChecked]));
    setAvailableChecked(new Set());
  };
  const moveLeft = () => {
    setAssigned((prev) => {
      const next = new Set(prev);
      assignedChecked.forEach((id) => next.delete(id));
      return next;
    });
    setAssignedChecked(new Set());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Array.from(assigned));
    } catch (error) {
      window.alert(error?.response?.data?.message || "Unable to save team members.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1.5 rounded-full bg-skillit inline-block" />
          <h3 className="font-display font-semibold text-slate-800 text-lg">Assign Users</h3>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-start">
        <UserPickerList
          title={`Available Users (${String(available.length).padStart(2, "0")})`}
          users={filteredAvailable}
          checked={availableChecked}
          onToggle={(id) => toggle(availableChecked, setAvailableChecked, id)}
          search={availSearch}
          onSearch={setAvailSearch}
        />

        <div className="flex flex-col items-center gap-3 pt-16">
          <button onClick={moveRight} className="h-9 w-9 rounded-full bg-slate-800 text-white grid place-items-center hover:bg-slate-700 transition-colors">
            <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={moveLeft} className="h-9 w-9 rounded-full bg-slate-800 text-white grid place-items-center hover:bg-slate-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        <UserPickerList
          title={`Assigned Users (${assignedUsers.length})`}
          users={filteredAssigned}
          checked={assignedChecked}
          onToggle={(id) => toggle(assignedChecked, setAssignedChecked, id)}
          search={assignedSearch}
          onSearch={setAssignedSearch}
        />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Save</Button>
      </div>
    </div>
  );
}

function UserPickerList({ title, users, checked, onToggle, search, onSearch }) {
  return (
    <div>
      <p className="font-semibold text-slate-800 mb-2">{title}</p>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-2 border-b border-slate-100">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Name, Email"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:bg-white focus:border-skillit"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-2 py-2 text-left font-medium">Name</th>
                <th className="px-2 py-2 text-left font-medium">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 && (
                <tr><td colSpan={3} className="text-center text-slate-400 py-6">No users</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onToggle(u.id)}>
                  <td className="px-3 py-2">
                    <input type="checkbox" readOnly checked={checked.has(u.id)} className="rounded border-slate-300 text-skillit" />
                  </td>
                  <td className="px-2 py-2 text-skillit font-medium">{u.name}</td>
                  <td className="px-2 py-2 text-slate-600">{u.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
