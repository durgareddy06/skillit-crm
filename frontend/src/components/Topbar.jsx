import React from "react";

export default function Topbar({ title, subtitle, subtitleExtras, right, titleRight, left }) {
  return (
    <div className="bg-gradient-to-r from-skillit to-skillit-light rounded-2xl px-6 py-5 mb-6 shadow-pop relative overflow-visible animate-fadeIn">
      <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute right-16 -bottom-10 h-24 w-24 rounded-full bg-white/10 pointer-events-none" />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            {left && <div className="shrink-0">{left}</div>}
            <h1 className="text-white text-xl md:text-2xl font-display font-bold">{title}</h1>
            {titleRight && <div className="shrink-0">{titleRight}</div>}
          </div>
          {subtitle && <p className="text-blue-100 text-sm mt-0.5 data-font">{subtitle}</p>}
          {subtitleExtras && <div className="mt-2">{subtitleExtras}</div>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}
