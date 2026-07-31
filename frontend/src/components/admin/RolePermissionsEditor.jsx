import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import Button from "../Button";
import { Field, Input, ToggleSwitch } from "../Field";
import { buildRolePermissionRows } from "../../lib/roleVisibility";
import { listModules } from "../../api/admin";

const BASIC = [["create", "Create"], ["read", "Read"], ["update", "Update"], ["delete", "Delete"], ["details", "Details"]];
const ADMIN = [["readAll", "Read All"], ["updateAll", "Update All"], ["deleteAll", "Delete All"]];
const SPECIAL = [["email", "Email"], ["bulkEmail", "Bulk Email"], ["bulkUpdate", "Bulk Update"], ["bulkDelete", "Bulk Delete"]];

export default function RolePermissionsEditor({ role, onCancel, onSave }) {
  const [name, setName] = useState(role.name || "");
  const [description, setDescription] = useState(role.description || "");
  const [modules, setModules] = useState([]);
  const [rows, setRows] = useState(role.permissions || []);
  const [expanded, setExpanded] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [loadingModules, setLoadingModules] = useState(true);

  useEffect(() => {
    let alive = true;
    listModules()
      .then((mods) => {
        if (!alive) return;
        setModules(mods);
      })
      .finally(() => {
        if (alive) setLoadingModules(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!modules.length) return;
    setName(role.name || "");
    setDescription(role.description || "");
    setRows(buildRolePermissionRows(modules, role.permissions || []));
  }, [role, modules]);

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const setPerm = (rowKey, group, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.key === rowKey ? { ...r, [group]: { ...r[group], [field]: value } } : r))
    );
  };

  const topLevelRows = rows.filter((r) => !r.parentKey);
  const childrenOf = (key) => rows.filter((r) => r.parentKey === key);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, description, permissions: buildRolePermissionRows(modules, rows) });
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (row, isChild = false) => {
    const kids = childrenOf(row.key);
    const hasKids = kids.length > 0;
    const isOpen = expanded.has(row.key);
    return (
      <React.Fragment key={row.key}>
        <tr className="border-b border-slate-100 hover:bg-slate-50/60">
          <td className={`px-4 py-3 text-sm text-slate-700 whitespace-nowrap ${isChild ? "pl-10" : ""}`}>
            <span className="inline-flex items-center gap-1.5">
              {hasKids ? (
                <button onClick={() => toggleExpand(row.key)} className="text-slate-400">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : (
                !isChild && <span className="w-3.5" />
              )}
              {row.label}
            </span>
          </td>
          {BASIC.map(([field]) => (
            <td key={field} className="px-4 py-3 text-center align-middle">
              <div className="flex justify-center">
                <ToggleSwitch
                  checked={!!row.basic?.[field]}
                  onChange={() => setPerm(row.key, "basic", field, !row.basic?.[field])}
                  label={`${row.label} ${field}`}
                />
              </div>
            </td>
          ))}
          {ADMIN.map(([field]) => (
            <td key={field} className="px-4 py-3 text-center align-middle">
              <div className="flex justify-center">
                <ToggleSwitch
                  checked={!!row.administrative?.[field]}
                  onChange={() => setPerm(row.key, "administrative", field, !row.administrative?.[field])}
                  label={`${row.label} ${field}`}
                />
              </div>
            </td>
          ))}
          {SPECIAL.map(([field]) => (
            <td key={field} className="px-4 py-3 text-center align-middle">
              <div className="flex justify-center">
                <ToggleSwitch
                  checked={!!row.special?.[field]}
                  onChange={() => setPerm(row.key, "special", field, !row.special?.[field])}
                  label={`${row.label} ${field}`}
                />
              </div>
            </td>
          ))}
        </tr>
        {hasKids && isOpen && kids.map((child) => renderRow(child, true))}
      </React.Fragment>
    );
  };

  const assignedCount = rows.filter((r) => r.basic?.read).length;
  const totalCount = rows.length;

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onCancel} className="h-9 w-9 rounded-full grid place-items-center text-slate-500 hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-3xl">
        <Field label="Role Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Input placeholder="Enter Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Modules assigned: <span className="font-semibold text-slate-700">{assignedCount} of {totalCount}</span>
        {loadingModules && " (loading modules…)"}
      </p>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100/80 text-slate-600">
              <th rowSpan={2} className="px-4 py-2 text-left font-semibold align-bottom">Name</th>
              <th colSpan={5} className="px-4 py-2 text-center font-semibold border-l border-slate-200">Basic Access</th>
              <th colSpan={3} className="px-4 py-2 text-center font-semibold border-l border-slate-200">Administrative Access</th>
              <th colSpan={4} className="px-4 py-2 text-center font-semibold border-l border-slate-200">Special Access</th>
            </tr>
            <tr className="bg-slate-50 text-skillit text-xs">
              {BASIC.map(([f, l]) => <th key={f} className="px-4 py-2 font-medium border-l border-slate-100">{l}</th>)}
              {ADMIN.map(([f, l]) => <th key={f} className="px-4 py-2 font-medium border-l border-slate-100">{l}</th>)}
              {SPECIAL.map(([f, l]) => <th key={f} className="px-4 py-2 font-medium border-l border-slate-100">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {topLevelRows.map((row) => renderRow(row))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
