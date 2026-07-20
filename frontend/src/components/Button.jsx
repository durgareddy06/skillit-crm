import React from "react";

const VARIANTS = {
  primary:
    "bg-skillit text-white hover:bg-skillit-dark shadow-sm hover:shadow-pop",
  outline:
    "border border-slate-300 text-slate-600 hover:border-skillit hover:text-skillit bg-white",
  danger:
    "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
  ghost:
    "text-slate-500 hover:bg-slate-100",
  success:
    "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  loading = false,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={[
        "btn-anim inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        VARIANTS[variant],
        className,
      ].join(" ")}
    >
      {loading && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}
