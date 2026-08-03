import React, { useState, useEffect } from "react";
import { Link2, AlertCircle } from "lucide-react";
import Modal from "./Modal";
import { updateStudent } from "../api/students";

export default function OrientationModal({ open, onClose, student, onSaveSuccess }) {
  const [orientationDate, setOrientationDate] = useState("");
  const [orientationLink, setOrientationLink] = useState("");
  const [recordedLink, setRecordedLink] = useState("");
  const [internalRemarks, setInternalRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (student) {
      setOrientationDate(student.orientationDate || "");
      setOrientationLink(student.orientationLink || "");
      setRecordedLink(student.recordedLink || "");
      setInternalRemarks(student.internalRemarks || "");
      setError("");
    }
  }, [student]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!student) return;
    setError("");

    if (!orientationDate) {
      setError("Orientation Date is required.");
      return;
    }
    if (!orientationLink.trim()) {
      setError("Orientation Link is required.");
      return;
    }
    if (!recordedLink.trim()) {
      setError("Recorded Link is required.");
      return;
    }
    if (!internalRemarks.trim()) {
      setError("Internal Remarks is required.");
      return;
    }

    setSaving(false);
    try {
      setSaving(true);
      await updateStudent(
        student.id,
        {
          orientationCompleted: true,
          orientationDate,
          orientationLink: orientationLink.trim(),
          recordedLink: recordedLink.trim(),
          internalRemarks: internalRemarks.trim(),
        },
        "orientation"
      );
      onSaveSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save orientation details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} hideHeader={true} className="max-w-[650px] !rounded-2xl overflow-hidden">
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Orientation Date */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">
            Orientation Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={orientationDate}
            onChange={(e) => setOrientationDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base"
          />
        </div>

        {/* Orientation Link */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">
            Orientation Link <span className="text-red-500">*</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-slate-400">
              <Link2 className="h-5 w-5" />
            </span>
            <input
              type="text"
              placeholder="https://zoom.us/j/12345678"
              value={orientationLink}
              onChange={(e) => setOrientationLink(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base"
            />
          </div>
        </div>

        {/* Recorded Link */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">
            Recorded Link <span className="text-red-500">*</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-slate-400">
              <Link2 className="h-5 w-5" />
            </span>
            <input
              type="text"
              placeholder="https://zoom.us/j/12345678"
              value={recordedLink}
              onChange={(e) => setRecordedLink(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base"
            />
          </div>
        </div>

        {/* Internal Remarks */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">
            Internal Remarks <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Add private notes for coordinators..."
            value={internalRemarks}
            onChange={(e) => setInternalRemarks(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base"
          />
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 px-6 bg-[#3b82f6] hover:bg-[#2563eb] active:bg-[#1d4ed8] text-white font-semibold rounded-xl text-base shadow-sm hover:shadow transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {saving ? "saving..." : "complete orientation"}
        </button>
      </form>
    </Modal>
  );
}
