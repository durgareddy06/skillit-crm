import React, { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export default function DataTable({
  columns,
  rows,
  onRowClick,
  rowMenu,
  expandedId,
  renderExpanded,
  emptyText = "No records found.",
  stickyHeader = true,
  tableLayout = "fixed",
  tableClassName = "",
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const menuButtonRefs = useRef({});
  const safeRows = Array.isArray(rows) ? rows : [];

  useEffect(() => {
    if (!openMenu) return undefined;

    const onPointerDown = (event) => {
      const button = menuButtonRefs.current[openMenu.idx];
      const menu = document.getElementById("datatable-row-menu");
      if (button?.contains(event.target) || menu?.contains(event.target)) return;
      setOpenMenu(null);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpenMenu(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const toggleRowMenu = (idx) => {
    setOpenMenu((current) => {
      if (current?.idx === idx) return null;

      const button = menuButtonRefs.current[idx];
      if (!button) return current;

      const rect = button.getBoundingClientRect();
      const menuWidth = 208;
      const menuHeight = 96;
      const padding = 8;
      const left = Math.min(window.innerWidth - menuWidth - padding, rect.right + padding);
      const top = Math.min(window.innerHeight - menuHeight - padding, Math.max(padding, rect.top - 8));

      return {
        idx,
        left: Math.max(padding, left),
        top,
      };
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100 animate-fadeIn">
      <div className="overflow-x-auto">
        <table className={`w-full ${tableLayout === "auto" ? "table-auto" : "table-fixed"} text-sm data-font ${tableClassName}`}>
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr className="bg-slate-100/80 text-slate-500">
              {rowMenu && <th className="w-10 px-3 py-3 text-left font-semibold" />}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-[13px] font-medium whitespace-nowrap ${col.headerClassName || ""}`}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {safeRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (rowMenu ? 1 : 0)} className="py-12 text-center text-slate-400">
                  {emptyText}
                </td>
              </tr>
            )}
            {safeRows.map((row, i) => (
              <React.Fragment key={row.id || i}>
                <tr
                  onClick={() => onRowClick?.(row)}
                  className={[
                    "transition-colors duration-150",
                    onRowClick ? "cursor-pointer hover:bg-blue-50/50" : "hover:bg-slate-50",
                  ].join(" ")}
                  style={{ animation: `fadeIn 0.25s ease-out ${Math.min(i, 12) * 0.02}s both` }}
                >
                  {rowMenu && (
                    <td className="relative px-2 py-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) menuButtonRefs.current[i] = el;
                          else delete menuButtonRefs.current[i];
                        }}
                        onClick={() => toggleRowMenu(i)}
                        className="grid h-7 w-7 place-items-center rounded-md text-blue-600 transition-all duration-150 hover:bg-blue-50 hover:scale-105"
                        aria-label="Open row actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-4 align-middle text-slate-700 ${col.cellClassName || ""}`}
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                    >
                      <div
                        className={col.render ? "" : "truncate"}
                        title={col.render ? undefined : (row[col.key] != null ? String(row[col.key]) : undefined)}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </div>
                    </td>
                  ))}
                </tr>
                {expandedId === row.id && renderExpanded && (
                  <tr className="bg-white">
                    <td colSpan={columns.length + (rowMenu ? 1 : 0)} className="p-0">
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {openMenu && (
        <div
          id="datatable-row-menu"
          className="fixed z-[80] w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.22)]"
          style={{ left: `${openMenu.left}px`, top: `${openMenu.top}px` }}
        >
          {rowMenu(safeRows[openMenu.idx]).map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                item.onClick?.();
                setOpenMenu(null);
              }}
              className={[
                "flex w-full items-center gap-3 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45",
                idx === 0 ? "border-b border-slate-100" : "",
                idx === 1 ? "text-red-500 hover:bg-red-50" : "",
                item.disabled ? "hover:bg-white active:bg-white" : "",
              ].join(" ")}
              title={item.title}
            >
              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
