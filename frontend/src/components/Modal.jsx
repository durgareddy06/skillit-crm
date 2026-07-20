import React from "react";

export default function Modal({ open, onClose, title, children, wide = false, hideHeader = false, className = "", bodyClassName = "" }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fadeIn p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={[
          "bg-white rounded-2xl shadow-2xl w-full animate-popIn max-h-[90vh] overflow-y-auto",
          wide ? "max-w-5xl" : "max-w-md",
          className,
        ].join(" ")}
      >
        {!hideHeader && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="h-5 w-1.5 rounded-full bg-skillit inline-block" />
              <h3 className="font-display font-semibold text-slate-800">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all duration-150 btn-anim"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}
        <div className={bodyClassName || "p-6"}>{children}</div>
      </div>
    </div>
  );
}
