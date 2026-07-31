import React, { useEffect, useMemo } from "react";
import { Field, Input } from "../Field";

function normalizeValue(type, value) {
  const raw = String(value ?? "");
  if (type === "number") return raw.replace(/\D/g, "");
  if (type === "text") return raw.replace(/[^a-zA-Z\s]/g, "");
  return raw.replace(/[^a-zA-Z0-9\s]/g, "");
}

export default function CustomFieldsForm({
  fields = [],
  value = {},
  onChange,
  disabled = false,
  title = "Custom Fields",
  loading = false,
}) {
  const safeFields = useMemo(() => (Array.isArray(fields) ? fields : []), [fields]);

  useEffect(() => {
    if (typeof onChange !== "function") return;
    const next = { ...(value || {}) };
    let changed = false;
    for (const field of safeFields) {
      if (next[field.key] === undefined) {
        next[field.key] = "";
        changed = true;
      }
    }
    if (changed) onChange(next);
  }, [safeFields, onChange, value]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
        Loading custom fields...
      </div>
    );
  }

  if (!safeFields.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
        No custom fields configured for this action.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">Fields added from Settings will appear here automatically.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {safeFields.map((field) => {
          const currentValue = value?.[field.key] ?? "";
          const inputType = field.type === "number" ? "number" : "text";
          return (
              <Field key={field.key} label={field.name} required={field.required}>
                <Input
                  value={currentValue}
                  disabled={disabled}
                  type={inputType}
                  required={field.required}
                  onChange={(e) => {
                    if (typeof onChange !== "function") return;
                    const nextValue = normalizeValue(field.type, e.target.value);
                    onChange({
                      ...(value || {}),
                      [field.key]: field.type === "number"
                        ? (nextValue === "" ? "" : Number(nextValue))
                        : nextValue,
                    });
                  }}
                  placeholder={field.name}
                />
              </Field>
          );
        })}
      </div>
    </section>
  );
}
