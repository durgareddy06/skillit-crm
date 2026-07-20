import React from "react";

export default function StatCard({ label, value, hint, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-skillit",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    green: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-pop">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <span className={`h-8 w-8 rounded-lg grid place-items-center text-sm ${tones[tone]}`}>●</span>
      </div>
      <p className="text-2xl font-display font-bold text-slate-800 mt-2">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1 data-font">{hint}</p>}
    </div>
  );
}
