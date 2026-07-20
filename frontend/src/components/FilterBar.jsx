import React from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Input, Select } from "./Field";

export default function FilterBar({ filters = [], values = {}, onChange, onAdvanced, advancedLabel = "Advanced Filters" }) {
  const widths = {
    select: "!w-[92px]",
    wide: "!w-[122px]",
  };

  return (
    <div className="mb-4">
      <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1">
        {filters.map((f) => (
          <Select
            key={f.key}
            value={values[f.key] || ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            className={`${f.wide ? widths.wide : widths.select} !h-8 !px-2.5 !py-1.5 shrink-0 bg-white text-[11px]`}
          >
            <option value="">{f.label}</option>
            {f.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        ))}

        <button
          type="button"
          onClick={onAdvanced}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
        >
          <SlidersHorizontal className="h-3 w-3" />
          {advancedLabel}
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
