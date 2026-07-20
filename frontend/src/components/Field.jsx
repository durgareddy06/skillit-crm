import React from "react";

function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "");
}

export function normalizePhone(value) {
  return digitsOnly(value).slice(-10);
}

export function formatPhoneDisplay(value) {
  const phone = normalizePhone(value);
  return phone ? `+91-${phone}` : "-";
}

export function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function toDateInputValue(value = "") {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = String(value).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${day.padStart(2, "0")}-${month.padStart(2, "0")}`;
}

export function fromDateInputValue(value = "") {
  if (!value) return "";
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}

export function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 mb-1.5 inline-block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const baseInput =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 " +
  "outline-none transition-all duration-150 focus:bg-white focus:border-skillit focus:ring-4 focus:ring-blue-100";

export function Input(props) {
  return <input {...props} className={`${baseInput} ${props.className || ""}`} />;
}

export function PhoneInput({ value, defaultValue, onChange, className = "", ...props }) {
  const handleChange = (e) => {
    const nextValue = normalizePhone(e.target.value);
    e.target.value = nextValue;
    if (onChange) {
      onChange({
        ...e,
        target: {
          ...e.target,
          value: nextValue,
        },
      });
    }
  };

  const normalizedValue = value !== undefined ? normalizePhone(value) : undefined;
  const normalizedDefaultValue = defaultValue !== undefined ? normalizePhone(defaultValue) : undefined;
  const inputProps = value !== undefined
    ? { value: normalizedValue }
    : { defaultValue: normalizedDefaultValue };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
        +91
      </span>
      <input
        {...props}
        {...inputProps}
        onChange={handleChange}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={10}
        className={`${baseInput} pl-14 ${className}`}
      />
    </div>
  );
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`${baseInput} ${props.className || ""}`}>
      {children}
    </select>
  );
}

export function Textarea(props) {
  return <textarea {...props} className={`${baseInput} min-h-[90px] ${props.className || ""}`} />;
}

export function ToggleSwitch({ checked, onChange, disabled = false, label, className = "" }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full align-middle",
        "transition-colors duration-150 focus:outline-none focus:ring-4 focus:ring-blue-100",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        checked ? "bg-skillit" : "bg-slate-300",
        className,
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform duration-150",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
