"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BomLine } from "@/lib/types";
import { ERP_BLIND_WARNING, MODELED_NOTE } from "@/lib/data/bom";
import { statusColor, statusGlyph } from "@/components/ui/StatusGlyph";
import { SourcePanel } from "@/components/shared/SourcePanel";
import {
  alternatesFor,
  leadTimeHistory,
  ERP_BLIND_ALTERNATE_NOTE,
  type Alternate,
  type AlternateVerdict,
} from "./derive";

const VERDICT_LABEL: Record<AlternateVerdict, string> = {
  TRUE_ESCAPE: "true escape",
  SHARED_BACKEND: "shared backend",
  SHARED_SUBSTRATE: "shared substrate",
  SHARED_WAFER_FAB: "shared wafer fab",
};

function Row({ label, value, tone = "var(--text-primary)" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="label">
        {label}
      </span>
      <span className="tabular-nums text-value" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

// ---- Job 1: lead-time history sparkline -----------------------------------
// Inline SVG (no chart lib) to match the terminal aesthetic. Baseline segment
// muted, recent-move segment in the delta's semantic color (red rising / green
// falling), elbow + current-quarter marked. Series is representative/derived.
function LeadTimeSparkline({ line }: { line: BomLine }) {
  const hist = leadTimeHistory(line);
  const { series, base, now, delta, riseStart, riseLen, min, max } = hist;

  const W = 372;
  const H = 40;
  const padX = 3;
  const padTop = 6;
  const padBot = 6;
  const n = series.length;
  const span = Math.max(1, max - min);
  const x = (i: number) => padX + (i * (W - 2 * padX)) / (n - 1);
  const y = (v: number) =>
    padTop + (H - padTop - padBot) * (1 - (v - min) / span);

  // Rising lead time is bad (red); falling is good (green); flat is neutral —
  // matching how the table and part-meta already render leadTimeDelta.
  const trend =
    delta > 0 ? "var(--critical)" : delta < 0 ? "var(--text-secondary)" : "var(--text-secondary)";

  const baselinePts = series
    .slice(0, riseStart + 1)
    .map((v, i) => `${x(i)},${y(v)}`)
    .join(" ");
  const risePts = series
    .slice(riseStart)
    .map((v, i) => `${x(i + riseStart)},${y(v)}`)
    .join(" ");

  const nowX = x(n - 1);
  const nowY = y(now);
  const elbowX = x(riseStart);

  return (
    <div className="mb-2 border-t border-rule pt-1.5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">
          Lead-time history · 8Q
        </span>
        <span className="label">
          Representative
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Lead time ${base} to ${now} weeks over 8 quarters`}
        style={{ display: "block" }}
      >
        {/* baseline reference */}
        <line
          x1={padX}
          x2={W - padX}
          y1={y(base)}
          y2={y(base)}
          stroke="var(--text-dim)"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.5}
          vectorEffect="non-scaling-stroke"
        />
        {/* elbow — where the recent move begins */}
        <line
          x1={elbowX}
          x2={elbowX}
          y1={padTop}
          y2={H - padBot}
          stroke="var(--rule-strong)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* baseline segment */}
        <polyline
          points={baselinePts}
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* recent-move segment (the spike) */}
        <polyline
          points={risePts}
          fill="none"
          stroke={trend}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {/* current-quarter marker */}
        <circle cx={nowX} cy={nowY} r={2.2} fill={trend} />
      </svg>

      {/* axis endpoints */}
      <div className="mt-1 flex items-baseline justify-between label">
        <span>8Q ago</span>
        <span>Now</span>
      </div>

      {/* readout */}
      <div className="mt-1 flex items-baseline justify-between">
        <span className="label">
          Baseline{" "}
          <span className="tabular-nums text-secondary">{base}W</span>
          {delta > 0 ? (
            <span className="ml-2">
              Spike{" "}
              <span className="tabular-nums" style={{ color: "var(--critical)" }}>
                +{delta}W
              </span>{" "}
              / {riseLen}Q
            </span>
          ) : null}
        </span>
        <span className="tabular-nums text-body text-primary">
          {now}W
          {delta !== 0 ? (
            <span className="ml-1" style={{ color: trend }}>
              {delta > 0 ? "▲" : "▼"}
              {Math.abs(delta)}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// ---- Job 2: qualified alternates ------------------------------------------
function AlternateRow({ alt }: { alt: Alternate }) {
  return (
    <div className="border-b border-rule py-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate">
          <span style={{ color: statusColor(alt.status) }}>
            {statusGlyph(alt.status)}
          </span>{" "}
          <span className="text-body text-primary">{alt.mpn}</span>
        </span>
        <span className="tabular-nums text-body shrink-0 text-secondary">
          {alt.leadTimeWeeks}W LT
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-label text-dim">
        <span className="min-w-0 truncate">
          {alt.source} · {alt.pinCompatible ? "PIN-COMPAT" : "FOOTPRINT Δ"} ·{" "}
          <span className="tabular-nums">REQUAL {alt.requalWeeks}W</span>
        </span>
        <span
          className="shrink-0 uppercase"
          style={{ color: alt.verdict === "TRUE_ESCAPE" ? "var(--focus)" : "var(--critical)" }}
        >
          {alt.verdict === "TRUE_ESCAPE" ? "✓" : "✕"} {VERDICT_LABEL[alt.verdict]}
        </span>
      </div>
      {alt.collidingNode ? (
        <div className="mt-1 text-label text-dim">
          via <span className="text-secondary">{alt.collidingNode}</span> — recovers{" "}
          {alt.recoveredLines} line{alt.recoveredLines === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  );
}

function Alternates({ line }: { line: BomLine }) {
  const alts = alternatesFor(line);
  return (
    <div className="mt-2 border-t border-rule pt-1.5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">
          Alternates · {alts.length} qualified
        </span>
        <span className="label">
          Representative
        </span>
      </div>
      {alts.map((a) => (
        <AlternateRow key={a.mpn} alt={a} />
      ))}
      <div className="mt-2 space-y-1 text-label leading-relaxed text-dim">
        <p>
          Candidate substitutes — not on-hand inventory. Verdict is the
          candidate&apos;s own supply path checked against the affected radius;
          substitution requires requalification.
        </p>
        <p>{ERP_BLIND_ALTERNATE_NOTE}</p>
      </div>
    </div>
  );
}

export function PartDrawer({
  line,
  onClose,
}: {
  line: BomLine | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!line) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [line, onClose]);

  // Provenance drill-in — the money-shot click path: EXPOSURE row → this
  // drawer → the Kaohsiung backend-A&T import record. Reset during render
  // (not in an effect) whenever the drawer's line changes, so it never
  // reopens stale on a new selection.
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesOpenFor, setSourcesOpenFor] = useState<string | null>(null);
  if ((line?.id ?? null) !== sourcesOpenFor) {
    setSourcesOpenFor(line?.id ?? null);
    setSourcesOpen(false);
  }

  return (
    <AnimatePresence>
      {line ? (
        <motion.aside
          key={line.id}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-y-0 right-0 z-40 flex w-[420px] max-w-[92%] flex-col border-l border-rule-strong bg-panel"
        >
          {/* header */}
          <div className="flex h-row shrink-0 items-center justify-between border-b border-rule px-2">
            <span className="text-value uppercase text-primary">
              {line.mpn} — Supply Path
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-dim transition-colors hover:text-focus"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            <div className="mb-2 text-body text-secondary">
              {line.description}
            </div>

            {/* supply path */}
            {line.supplyPath?.length ? (
              <div className="mb-2">
                {line.supplyPath.map((n, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[104px_1fr_auto] items-baseline gap-2 border-b border-rule py-1"
                  >
                    <span className="label">
                      {n.stage}
                    </span>
                    <span
                      className="text-body"
                      style={{ color: n.inQuarantineZone ? "var(--critical)" : "var(--text-primary)" }}
                    >
                      {n.site}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSourcesOpen(true)}
                      className="text-label transition-opacity hover:opacity-70"
                      style={{ color: n.provenance === "MODELED" ? "var(--modeled)" : "var(--text-secondary)" }}
                      title="View provenance"
                    >
                      ● {n.provenance}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {/* ERP-blind warning — the single most important text in the
                build. A rule, not a box: it reads off a 2px --critical left
                edge with no fill, so the drawer stays one flat plane. */}
            {line.erpBlind ? (
              <div
                className="mb-2 pl-2"
                style={{ borderLeft: "2px solid var(--critical)" }}
              >
                <div className="mb-2 text-body font-medium text-critical">
                  ⚠ CUSTOMER ERP LISTS ORIGIN AS &quot;{line.erpOrigin}&quot;
                </div>
                <div className="space-y-1 text-body leading-relaxed text-secondary">
                  {ERP_BLIND_WARNING.bodyLines.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSourcesOpen(true)}
                  className="mt-2 block text-left text-label leading-relaxed text-dim underline decoration-dotted underline-offset-2 transition-colors hover:text-critical"
                >
                  SOURCES: {ERP_BLIND_WARNING.sources} →
                </button>
              </div>
            ) : null}

            {/* modeled note */}
            {line.provenance === "MODELED" ? (
              <div
                className="mb-2 pl-2 text-body leading-relaxed"
                style={{
                  borderLeft: "2px dashed var(--modeled)",
                  color: "var(--modeled)",
                }}
              >
                {MODELED_NOTE}
              </div>
            ) : null}

            {/* lead-time history sparkline (Job 1) */}
            <LeadTimeSparkline line={line} />

            {/* part meta */}
            <div className="border-t border-rule pt-1.5">
              <Row label="Manufacturer" value={line.manufacturer} />
              <Row label="Tier" value={line.tier} />
              <Row
                label="Lead time"
                value={
                  <>
                    {line.leadTimeWeeks}W
                    {line.leadTimeDelta !== 0 ? (
                      <span
                        className="ml-1"
                        style={{ color: line.leadTimeDelta > 0 ? "var(--critical)" : "var(--text-secondary)" }}
                      >
                        {line.leadTimeDelta > 0 ? "▲" : "▼"}
                        {Math.abs(line.leadTimeDelta)}
                      </span>
                    ) : null}
                  </>
                }
              />
              <Row label="Qty / unit" value={line.qtyPerUnit} />
              <Row label="Unit cost" value={`$${line.unitCost.toFixed(2)}`} />
              <Row
                label="Confidence"
                value={`${line.confidence}%`}
                tone={line.provenance === "MODELED" ? "var(--modeled)" : "var(--text-primary)"}
              />
            </div>

            {/* qualified alternates (Job 2) */}
            <Alternates line={line} />
          </div>
        </motion.aside>
      ) : null}
      <SourcePanel
        sourceIds={line && sourcesOpen ? line.sourceIds : null}
        onClose={() => setSourcesOpen(false)}
        context={line ? `${line.mpn} supply path` : undefined}
      />
    </AnimatePresence>
  );
}
