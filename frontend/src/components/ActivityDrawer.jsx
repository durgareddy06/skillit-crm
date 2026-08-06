import React, { useEffect, useMemo, useState } from "react";
import { Play, X } from "lucide-react";
import { getActivityFeed } from "../data/activityFeed";
import { getStudent } from "../api/students";

const TABS = [
  { key: "all", label: "All" },
  { key: "callLogs", label: "Call Logs" },
  { key: "payments", label: "Payments" },
  { key: "onboardings", label: "OnBoardings" },
];

function safeCopyToClipboard(text, successMessage = "Copied to clipboard!") {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => alert(successMessage))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }

  function fallbackCopy(textToCopy) {
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand("copy");
      if (successful) {
        alert(successMessage);
      } else {
        alert("Failed to copy to clipboard.");
      }
    } catch (err) {
      alert("Failed to copy to clipboard.");
    }
    document.body.removeChild(textArea);
  }
}

function getAudioUrl(audioPath) {
  if (!audioPath) return "";

  let backendOrigin = "";
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (apiBaseUrl && (apiBaseUrl.startsWith("http://") || apiBaseUrl.startsWith("https://"))) {
    backendOrigin = apiBaseUrl.replace(/\/api\/?$/, "");
  } else {
    backendOrigin = `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  if (audioPath.startsWith("http://") || audioPath.startsWith("https://")) {
    const isLive = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
    if (isLive) {
      let resolvedPath = audioPath;
      if (audioPath.includes("localhost:4000")) {
        resolvedPath = audioPath.replace("http://localhost:4000", backendOrigin);
      }
      if (window.location.protocol === "https:" && resolvedPath.startsWith("http://")) {
        resolvedPath = resolvedPath.replace(/^http:\/\//i, "https://");
      }
      return resolvedPath;
    }
    return audioPath;
  }

  return `${backendOrigin}${audioPath.startsWith("/") ? "" : "/"}${audioPath}`;
}

function renderLineWithLinks(line) {
  if (typeof line !== "string") return line;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = line.split(urlRegex);

  if (parts.length === 1) {
    return <span>{line}</span>;
  }

  return (
    <span>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <span key={i} className="inline-flex items-center gap-1.5 ml-1 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-[12px] font-mono">
              <a
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline break-all"
              >
                {part}
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  safeCopyToClipboard(part, "Link copied to clipboard!");
                }}
                className="inline-flex items-center justify-center px-1 py-0.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded text-[9px] font-semibold cursor-pointer"
                title="Copy Link"
              >
                Copy
              </button>
            </span>
          );
        }
        return part;
      })}
    </span>
  );
}

function SectionCard({ item }) {
  const resolvedAudioUrl = useMemo(() => getAudioUrl(item.audio), [item.audio]);

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
              {renderLineWithLinks(line)}
            </li>
          ))}
        </ul>
      )}

      {item.audio && (
        <div className="mt-3 space-y-2 w-full">
          <audio src={resolvedAudioUrl} controls className="w-full h-8 max-w-full rounded-md shadow-sm border border-slate-100 bg-slate-50" />
          <div className="flex gap-3 text-[11px] text-slate-500 pl-1">
            <a href={resolvedAudioUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 font-medium">
              Open Recording URL
            </a>
            <span>•</span>
            <button
              onClick={() => {
                safeCopyToClipboard(resolvedAudioUrl, "Recording URL copied to clipboard!");
              }}
              className="hover:underline text-blue-600 font-medium cursor-pointer"
            >
              Copy Recording URL
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ActivityDrawer({ open, student, onClose, defaultTab = "all" }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [detailedStudent, setDetailedStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab, student?.id]);

  useEffect(() => {
    if (open && student?.id) {
      setLoading(true);
      getStudent(student.id)
        .then((data) => {
          setDetailedStudent(data);
        })
        .catch((err) => {
          console.error("Failed to fetch detailed student:", err);
          setDetailedStudent(student);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setDetailedStudent(null);
    }
  }, [open, student?.id]);

  const feed = useMemo(() => getActivityFeed(detailedStudent || student), [detailedStudent, student]);

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
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                <span className="text-xs text-slate-400 font-medium">Syncing activity data...</span>
              </div>
            ) : activeTab === "all" ? (
              feed.all.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">No activity recorded yet.</p>
              ) : (
                <div className="space-y-8">
                  {feed.all.map((item, idx) => (
                    <section key={idx} className={idx !== feed.all.length - 1 ? "border-b border-slate-100" : ""}>
                      <SectionCard item={item} />
                    </section>
                  ))}
                </div>
              )
            ) : activeTab === "callLogs" ? (
              currentItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">No call logs available.</p>
              ) : (
                <div className="space-y-6">
                  {currentItems.map((item, idx) => (
                    <section key={idx} className={idx !== currentItems.length - 1 ? "border-b border-slate-200 pb-5" : ""}>
                      <SectionCard item={item} />
                    </section>
                  ))}
                </div>
              )
            ) : (
              currentItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">No entries yet.</p>
              ) : (
                <div className="space-y-8">
                  {currentItems.map((item, idx) => (
                    <section key={idx} className={idx !== currentItems.length - 1 ? "border-b border-slate-100" : ""}>
                      <SectionCard item={item} />
                    </section>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
