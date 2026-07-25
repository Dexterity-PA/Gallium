"use client";

import { useEffect, useRef } from "react";

// Bottom strip of the centre column: a terminal log that appends a line each
// time an action fires. Keeps the column reading as an instrument while the
// cards are collapsed, and gives the click-path an audit trail.

export interface LogEntry {
  key: string;
  t: string; // HH:MM:SS
  tag: string;
  text: string;
  tone?: string;
}

export function ResolutionLog({ entries }: { entries: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <div className="shrink-0 border-t border-rule">
      <div className="flex h-row items-center justify-between border-b border-rule px-2 label">
        <span>Resolution Log</span>
        <span className="tabular-nums">{entries.length} ENTRIES</span>
      </div>
      <div className="h-[92px] overflow-auto px-2 py-1">
        {entries.map((e) => (
          <div
            key={e.key}
            className="flex items-baseline gap-2 whitespace-nowrap text-label leading-tight"
            style={{ animation: "row-slide-in 180ms ease-out" }}
          >
            <span className="shrink-0 tabular-nums text-dim">{e.t}</span>
            <span
              className="shrink-0 text-secondary"
              style={{ minWidth: "22ch" }}
            >
              {e.tag}
            </span>
            <span
              className="overflow-hidden text-ellipsis"
              style={{ color: e.tone ?? "var(--text-secondary)" }}
            >
              {e.text}
            </span>
          </div>
        ))}
        <div ref={endRef} className="flex items-center gap-2 leading-tight">
          <span className="text-label text-dim">&gt;</span>
          <span
            className="anim-cursor inline-block"
            style={{ width: "6px", height: "11px", background: "var(--focus)" }}
          />
        </div>
      </div>
    </div>
  );
}
