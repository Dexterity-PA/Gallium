"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Metric } from "@/components/ui/Metric";
import type { ResolutionSummary } from "@/lib/uploadResolution";

interface ResolutionScreenProps {
  summary: ResolutionSummary;
  onComplete: (summary: ResolutionSummary) => void;
}

// Stage windows for the ~12s reveal. The counts themselves are never
// fabricated: resolveUploadRows() already ran (see app/page.tsx) and
// produced the real matched/unresolved/exposed split from resolveMpn()
// calls; this component only staggers *when* that already-computed truth is
// revealed, so it reads as real work rather than a spinner.
const PARSE_END = 3000;
const MATCH_END = PARSE_END + 4500; // 7500
const EXPOSE_END = MATCH_END + 3500; // 11000
const TOTAL_MS = EXPOSE_END + 1000; // 12000

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

type LogTag = "PARSED" | "MATCHED" | "UNRESOLVED" | "EXPOSED" | "CLEAR";

function tagColor(tag: LogTag): string {
  switch (tag) {
    case "UNRESOLVED":
    case "EXPOSED":
      // Both are the real BOM `status` field (see uploadResolution.ts),
      // same axis StatusGlyph resolves to --critical elsewhere in the app.
      return "var(--critical)";
    default:
      return "var(--text-secondary)";
  }
}

export function ResolutionScreen({ summary, onComplete }: ResolutionScreenProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let raf: number;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const e = now - startRef.current;
      setElapsed(Math.min(e, TOTAL_MS));
      if (e < TOTAL_MS) {
        raf = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        window.setTimeout(() => onComplete(summary), 500);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // A fresh ResolutionScreen instance mounts per run (see the Stage union
    // in app/page.tsx); summary/onComplete are stable for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedFrac = clamp01(elapsed / PARSE_END);
  const matchFrac = clamp01((elapsed - PARSE_END) / (MATCH_END - PARSE_END));
  const exposeFrac = clamp01((elapsed - MATCH_END) / (EXPOSE_END - MATCH_END));

  const linesParsed = Math.round(parsedFrac * summary.totalRows);
  const rowsProcessed = Math.round(matchFrac * summary.totalRows);
  const seen = summary.rows.slice(0, rowsProcessed);
  const matchedSoFar = seen.filter((r) => r.matched).length;
  const unresolvedSoFar = seen.filter((r) => !r.matched).length;

  const matchedRows = useMemo(() => summary.rows.filter((r) => r.matched), [summary.rows]);
  const exposedSeenCount = Math.round(exposeFrac * matchedRows.length);
  const exposedSoFar = matchedRows.slice(0, exposedSeenCount).filter((r) => r.exposed).length;

  const done = elapsed >= TOTAL_MS;

  const stageLabel = done
    ? "RESOLUTION COMPLETE"
    : elapsed < PARSE_END
      ? "PARSING BOM"
      : elapsed < MATCH_END
        ? "MATCHING AGAINST PARTS NETWORK"
        : "CROSS-REFERENCING EXPOSURE";

  const log = useMemo(() => {
    if (elapsed < PARSE_END) {
      return summary.rows
        .slice(Math.max(0, linesParsed - 9), linesParsed)
        .map((r) => ({ mpn: r.mpn, description: r.description, tag: "PARSED" as LogTag }));
    }
    if (elapsed < MATCH_END) {
      return seen
        .slice(-9)
        .map((r) => ({
          mpn: r.mpn,
          description: r.description,
          tag: (r.matched ? "MATCHED" : "UNRESOLVED") as LogTag,
        }));
    }
    return matchedRows
      .slice(0, exposedSeenCount)
      .slice(-9)
      .map((r) => ({
        mpn: r.mpn,
        description: r.description,
        tag: (r.exposed ? "EXPOSED" : "CLEAR") as LogTag,
      }));
  }, [elapsed, linesParsed, seen, matchedRows, exposedSeenCount, summary.rows]);

  const progressPct = Math.round((elapsed / TOTAL_MS) * 100);

  return (
    <div className="substrate relative flex h-full w-full flex-col items-center justify-center gap-4 bg-[var(--bg-base)] px-4">
      <div className="flex w-full max-w-[720px] flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] tracking-[0.14em] text-[var(--text-dim)]">
            <span>
              {summary.source === "sample" ? "SAMPLE BOM · MD-7200" : (summary.fileName ?? "UPLOADED FILE")}
            </span>
            <span className="tabular-nums">{progressPct}%</span>
          </div>
          <div className="h-1 w-full bg-[var(--rule)]">
            <div
              className="h-full bg-[var(--focus)] transition-[width] duration-150 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-[var(--text-primary)]">
            {!done ? (
              <span className="anim-cursor text-[var(--focus)]">▮</span>
            ) : (
              <span className="text-[var(--ok)]">●</span>
            )}
            {stageLabel}
          </div>
        </div>

        <Panel label="Resolution" noPad>
          <div className="grid grid-cols-4 divide-x divide-[var(--rule)]">
            <div className="p-3">
              <Metric label="Lines Parsed" value={linesParsed} sub={`of ${summary.totalRows}`} size="lg" />
            </div>
            <div className="p-3">
              <Metric label="Matched" value={matchedSoFar} size="lg" />
            </div>
            <div className="p-3">
              <Metric label="Unresolved" value={unresolvedSoFar} tone="var(--critical)" size="lg" />
            </div>
            <div className="p-3">
              <Metric label="Exposed" value={exposedSoFar} tone="var(--critical)" size="lg" />
            </div>
          </div>
        </Panel>

        <Panel
          label="Live Log"
          corner={`${rowsProcessed || linesParsed}/${summary.totalRows}`}
          className="h-[220px]"
          bodyClassName="overflow-hidden"
        >
          <div className="flex flex-col gap-1 font-mono text-[10px]">
            {log.map((row, i) => (
              <div key={`${row.mpn}-${i}`} className="flex items-center gap-2">
                <span
                  style={{ color: tagColor(row.tag) }}
                  className="w-[74px] shrink-0 tracking-[0.08em]"
                >
                  {row.tag}
                </span>
                <span className="w-[140px] shrink-0 truncate text-[var(--text-primary)]">{row.mpn}</span>
                <span className="truncate text-[var(--text-dim)]">{row.description}</span>
              </div>
            ))}
          </div>
        </Panel>

        {done ? (
          <div className="text-center text-[10px] tracking-[0.08em] text-[var(--text-dim)]">
            {summary.unresolved} of {summary.totalRows} lines had no network match, entering
            dashboard…
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-4 text-[9px] tracking-[0.06em] text-[var(--text-dim)]">
        FICTIONAL SCENARIO · REPRESENTATIVE DATA
      </div>
    </div>
  );
}
