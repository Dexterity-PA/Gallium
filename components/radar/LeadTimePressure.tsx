"use client";

import { BOM } from "@/lib/data/bom";
import type { BomLine } from "@/lib/types";

// ---------------------------------------------------------------------------
// Derived view model. This is a rollup of BOM lines that are already in
// lib/data/bom.ts — no new dataset, and nothing here is invented: every figure
// on screen is a leadTimeWeeks / leadTimeDelta already carried by a part.
//
// The BOM has no category field, so categories come from ordered keyword rules
// over the part description. Order matters: an "Isolated IGBT gate driver" is
// gate drive, not a power device, so the isolation rule runs first.
// ---------------------------------------------------------------------------

const RULES: Array<[RegExp, string]> = [
  [/gate|isolat|optocoupler|transformer driver/i, "GATE DRIVE / ISOLATION"],
  [/igbt|schottky|diode|rectifier|mosfet/i, "POWER STAGE"],
  [/mcu|microcontroller|control/i, "CONTROL"],
  [/capacitor|electrolytic|dc-link/i, "DC-LINK ENERGY"],
  [/shunt|current sense|sensor/i, "CURRENT SENSE"],
];

function categoryOf(line: BomLine): string {
  // Tier-3 inference is always package-level in this dataset.
  if (line.provenance === "MODELED") return "PACKAGE MATERIALS";
  for (const [re, name] of RULES) if (re.test(line.description)) return name;
  return "UNCATEGORIZED";
}

export interface PressureRow {
  category: string;
  lines: number;
  driver: BomLine; // the longest-pole part — it is what gates the build
  now: number;
  was: number;
  delta: number;
  modeled: boolean;
}

export const PRESSURE: PressureRow[] = (() => {
  const groups = new Map<string, BomLine[]>();
  for (const line of BOM) {
    if (line.status !== "EXPOSED") continue;
    const key = categoryOf(line);
    const bucket = groups.get(key);
    if (bucket) bucket.push(line);
    else groups.set(key, [line]);
  }

  const rows = [...groups].map(([category, lines]): PressureRow => {
    const driver = lines.reduce((a, b) =>
      b.leadTimeWeeks > a.leadTimeWeeks ||
      (b.leadTimeWeeks === a.leadTimeWeeks && b.leadTimeDelta > a.leadTimeDelta)
        ? b
        : a
    );
    return {
      category,
      lines: lines.length,
      driver,
      now: driver.leadTimeWeeks,
      was: driver.leadTimeWeeks - driver.leadTimeDelta,
      delta: driver.leadTimeDelta,
      modeled: lines.every((l) => l.provenance === "MODELED"),
    };
  });

  rows.sort((a, b) => b.delta - a.delta || b.now - a.now);
  return rows;
})();

const MAX_WEEKS = Math.max(...PRESSURE.map((r) => Math.max(r.now, r.was)));
const TOTAL_LINES = PRESSURE.reduce((n, r) => n + r.lines, 0);
const WORST = PRESSURE.reduce((a, b) => (b.delta > a.delta ? b : a));
const LONGEST = PRESSURE.reduce((a, b) => (b.now > a.now ? b : a));

const fmt = (n: number) => `${n}W`;

// ---------------------------------------------------------------------------

function Row({ row, index, active }: { row: PressureRow; index: number; active: boolean }) {
  const rising = row.delta >= 0;
  // --modeled stays reserved for inferred data; observed movement is
  // --critical when rising and drops to plain --text-secondary when falling:
  // a lead time coming back down is not a second alarm colour (DESIGN.md §2).
  const moveTone = row.modeled ? "var(--modeled)" : rising ? "var(--critical)" : "var(--text-secondary)";
  const valueTone = row.modeled ? "var(--modeled)" : "var(--text-primary)";
  const labelTone = row.modeled ? "var(--modeled)" : "var(--text-dim)";

  const basePct = (Math.min(row.now, row.was) / MAX_WEEKS) * 100;
  const movePct = (Math.abs(row.delta) / MAX_WEEKS) * 100;
  const delay = `${index * 40}ms`;
  const ease = "width 240ms cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <div className="border-b border-rule py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="truncate label"
          style={{ color: labelTone }}
        >
          {row.category}
        </span>
        <span className="shrink-0 text-label tabular-nums text-dim">
          {row.lines} LN
        </span>
      </div>

      <div className="mt-1 truncate text-label text-dim">
        {row.driver.mpn}
      </div>

      {/* was ──────── move : bar scaled to the longest exposed lead time */}
      <div className="mt-1 flex h-1.5 w-full overflow-hidden bg-elevated">
        <div
          style={{
            width: active ? `${basePct}%` : "0%",
            background: "var(--rule-strong)",
            transition: ease,
            transitionDelay: delay,
          }}
        />
        <div
          style={{
            width: active ? `${movePct}%` : "0%",
            background: moveTone,
            transition: ease,
            transitionDelay: delay,
          }}
        />
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2 text-body tabular-nums">
        <span style={{ color: valueTone }}>
          {fmt(row.now)}
          <span className="ml-1 text-label text-dim">FROM {fmt(row.was)}</span>
        </span>
        <span style={{ color: moveTone }}>
          {rising ? "▲" : "▼"} {fmt(Math.abs(row.delta))}
        </span>
      </div>
    </div>
  );
}

export function LeadTimePressure({ active }: { active: boolean }) {
  return (
    <div className="shrink-0">
      <div className="flex items-baseline justify-between">
        <span className="label">
          Lead Time Pressure
        </span>
        <span className="text-label tabular-nums text-dim">
          {PRESSURE.length} CAT / {TOTAL_LINES} LN
        </span>
      </div>

      {/* headline pair, same treatment as the metrics above */}
      <div className="mt-1 grid grid-cols-2 gap-2 border-y border-rule-strong py-1.5">
        <div>
          <div className="label">
            Longest Pole
          </div>
          <div
            className="text-value tabular-nums"
            style={{ color: LONGEST.modeled ? "var(--modeled)" : "var(--text-primary)" }}
          >
            {fmt(LONGEST.now)}
            <span className="ml-1 text-label text-dim">{LONGEST.driver.mpn}</span>
          </div>
        </div>
        <div>
          <div className="label">
            Largest Move
          </div>
          <div className="text-value tabular-nums" style={{ color: "var(--critical)" }}>
            ▲ {fmt(WORST.delta)}
            <span className="ml-1 text-label text-dim">{WORST.driver.mpn}</span>
          </div>
        </div>
      </div>

      <div>
        {PRESSURE.map((row, i) => (
          <Row key={row.category} row={row} index={i} active={active} />
        ))}
      </div>

      <div className="mt-2 text-label leading-body text-dim">
        BARS SCALE TO {MAX_WEEKS}W. FILLED SEGMENT IS WEEKS ADDED SINCE PRIOR QUOTE.
        <br />
        ROW FIGURE IS THE LONGEST-POLE PART IN THE CATEGORY.
      </div>
      <div className="mt-1 text-label leading-body">
        <span style={{ color: "var(--modeled)" }}>■</span>{" "}
        <span className="text-dim">MODELED — INFERRED, NOT PER-PART OBSERVED.</span>
      </div>
    </div>
  );
}
