import React, { useEffect, useMemo, useState } from "react";
import { Play, X } from "lucide-react";
import { getActivityFeed } from "../data/activityFeed";

const TABS = [
  { key: "all", label: "All" },
  { key: "callLogs", label: "Call Logs" },
  { key: "payments", label: "Payments" },
  { key: "onboardings", label: "OnBoardings" },
];

function SectionCard({ item }) {
  return (
    <article className="pb-5">
      <div className="flex items-start justify-between gap-4">
        <h4 className="text-[15px] font-semibold text-slate-800 leading-snug">{item.title}</h4>
        <span className="shrink-0 text-[11px] text-slate-400 whitespace-nowrap">{item.at}</span>
      </div>

      {item.meta && <p className="mt-1 text-[11px] text-slate-400">{item.meta}</p>}

      {!!item.details?.length && (
        <ul className="mt-2 space-y-1.5 pl-5 text-[13px] leading-5 text-slate-800 list-disc">
          {item.details.map((line, idx) => (
            <li key={idx} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      )}

      {item.audio && (
        <div className="mt-2 inline-flex items-center gap-2 text-[13px] text-slate-800">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-white">
            <Play className="h-3 w-3 fill-white" />
          </span>
          <span className="border-b border-slate-400">{item.audio}</span>
        </div>
      )}
    </article>
  );
}

export default function ActivityDrawer({ open, student, onClose, defaultTab = "all" }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab, student?.id]);

  const feed = useMemo(() => getActivityFeed(student), [student]);

  if (!open) return null;

  const currentItems = feed[activeTab] || [];

  return (
    <div className="fixed inset-0 z-40">
        <button
          type="button"
          aria-label="Close activity drawer"
          className="absolute inset-0 z-0 bg-slate-900/45 backdrop-blur-[1px]"
          onClick={onClose}
        />

      <aside className="absolute right-0 top-0 z-10 h-full w-full max-w-[430px] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-800">Activity</h2>
              <p className="mt-1 text-xs text-slate-400">{student?.customerName || student?.name || "Student"}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close activity drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-slate-200 px-3">
            <div className="flex gap-2 overflow-x-auto">
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={[
                      "relative px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                      active ? "text-blue-600" : "text-slate-500 hover:text-slate-800",
                    ].join(" ")}
                  >
                    {tab.label}
                    <span
                      className={[
                        "absolute bottom-0 left-0 h-0.5 w-full rounded-full transition-transform",
                        active ? "bg-blue-600 scale-x-100" : "bg-transparent scale-x-0",
                      ].join(" ")}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === "all" ? (
              <div className="space-y-8">
                {feed.all.map((item, idx) => (
                  <section key={idx} className={idx !== feed.all.length - 1 ? "border-b border-slate-100" : ""}>
                    <SectionCard item={item} />
                  </section>
                ))}
              </div>
            ) : activeTab === "callLogs" ? (
              <div className="space-y-6">
                {currentItems.map((item, idx) => (
                  <section key={idx} className={idx !== currentItems.length - 1 ? "border-b border-slate-200 pb-5" : ""}>
                    <SectionCard item={item} />
                  </section>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {currentItems.map((item, idx) => (
                  <section key={idx} className={idx !== currentItems.length - 1 ? "border-b border-slate-100" : ""}>
                    <SectionCard item={item} />
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
