import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Button from "../components/Button";
import ActivityDrawer from "../components/ActivityDrawer";
import { Field, Input, Textarea, fromDateInputValue, toDateInputValue, todayDateInputValue } from "../components/Field";
import { listStudents, updateStudent } from "../api/students";
import { buildSupportTableColumns, SupportActivityButton } from "../config/supportTableColumns.jsx";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";

export default function Orientation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activityFor, setActivityFor] = useState(null);

  const refresh = () => {
    listStudents("orientation")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    refresh();
  }, []);

  const submitOrientation = async (e) => {
    e.preventDefault();
    if (!active) return;

    const form = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await updateStudent(active.id, {
        orientationDate: fromDateInputValue(form.get("orientationDate")),
        orientationLink: form.get("orientationLink"),
        recordedLink: form.get("recordedLink"),
        internalRemarks: form.get("internalRemarks"),
        orientationCompleted: true,
      }, "orientation");
      setActive(null);
      refresh();
      navigate("/learners");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Topbar title="Orientation" subtitle="Skillit Academy | 8639191169" />
      <DataTable
        columns={buildSupportTableColumns({
          onNameClick: hasPermission(user, "orientation", "details") ? (row) => setActive(row) : undefined,
          nameExtra: (row) => (
            <SupportActivityButton onClick={(e) => {
              e.stopPropagation();
              setActivityFor(row);
            }} />
          ),
        })}
        rows={rows}
      />

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        hideHeader
        className="max-w-[980px]"
      >
        {active && (
          <form onSubmit={submitOrientation} className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold text-slate-800">{active.customerName}</h3>
                <p className="text-sm text-slate-500">Orientation details</p>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-white transition-colors hover:bg-slate-700"
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
              <div className="grid gap-4">
                <Field label="Orientation Date" required>
                  <Input name="orientationDate" type="date" max={todayDateInputValue()} defaultValue={toDateInputValue(active.orientationDate || "")} required />
                </Field>
                <Field label="Orientation Link" required>
                  <Input
                    name="orientationLink"
                    type="url"
                    defaultValue={active.orientationLink || ""}
                    placeholder="https://zoom.us/j/12345678"
                    required
                  />
                </Field>
                <Field label="Recorded Link">
                  <Input
                    name="recordedLink"
                    type="url"
                    defaultValue={active.recordedLink || ""}
                    placeholder="https://zoom.us/j/12345678"
                  />
                </Field>
                <Field label="Internal Remarks">
                  <Textarea
                    name="internalRemarks"
                    defaultValue={active.internalRemarks || ""}
                    placeholder="Add private notes for coordinators..."
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setActive(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Complete Orientation
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ActivityDrawer open={!!activityFor} student={activityFor} onClose={() => setActivityFor(null)} />
    </div>
  );
}
