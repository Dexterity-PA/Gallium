"use client";

import { useMemo } from "react";
import { BOM } from "@/lib/data/bom";
import type { BomLine } from "@/lib/types";
import { useScenario } from "@/lib/hooks/useScenario";
import { affectedRadius, scenarioStatus } from "@/lib/derive/scenario";

// ---------------------------------------------------------------------------
// Derived view model. This is a rollup of BOM lines that are already in
// lib/data/bom.ts. No new dataset, and nothing here is invented: every figure
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
  driver: BomLine; // the longest-pole part, which is what gates the build
  now: number;
  was: number;
  delta: number;
  modeled: boolean;
}

export interface PressureView {
  rows: PressureRow[];
  maxWeeks: number;
  totalLines: number;
  worst: PressureRow | null;
  longest: PressureRow | null;
}

/** Pressure rollup for a set of exposed lines. The scenario control decides
 *  the set; the categories and figures are the same authored lead-time data
 *  either way. At the default control this is exactly the scripted rollup. */
export function pressureFor(exposed: BomLine[]): PressureView {
  const groups = new Map<string, BomLine[]>();
  for (const line of exposed) {
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
  return {
    rows,
    maxWeeks: rows.length ? Math.max(...rows.map((r) => Math.max(r.now, r.was))) : 0,
    totalLines: rows.reduce((n, r) => n + r.lines, 0),
    worst: rows.length ? rows.reduce((a, b) => (b.delta > a.delta ? b : a)) : null,
    longest: rows.length ? rows.reduce((a, b) => (b.now > a.now ? b : a)) : null,
  };
}

/** The scripted baseline, kept for guards: pressureFor over the authored
 *  EXPOSED set. */
export const PRESSURE: PressureRow[] = pressureFor(
  BOM.filter((l) => l.status === "EXPOSED")
).rows;

const fmt = (n: number) => `${n}W`;

// ---------------------------------------------------------------------------

function Row({
  row,
  index,
  active,
  maxWeeks,
}: {
  row: PressureRow;
  index: number;
  active: boolean;
  maxWeeks: number;
}) {
  const rising = row.delta >= 0;
  // --modeled stays reserved for inferred data; observed movement is
  // --critical when rising and drops to plain --text-secondary when falling:
  // a lead time coming back down is not a second alarm colour (DESIGN.md §2).
  const moveTone = row.modeled ? "var(--modeled)" : rising ? "var(--critical)" : "var(--text-secondary)";
  const valueTone = row.modeled ? "var(--modeled)" : "var(--text-primary)";
  const labelTone = row.modeled ? "var(--modeled)" : "var(--text-dim)";

  const basePct = maxWeeks > 0 ? (Math.min(row.now, row.was) / maxWeeks) * 100 : 0;
  const movePct = maxWeeks > 0 ? (Math.abs(row.delta) / maxWeeks) * 100 : 0;
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
  const { control } = useScenario();
  const view = useMemo(() => {
    const radius = affectedRadius(control.originId, control.severity);
    return pressureFor(BOM.filter((l) => scenarioStatus(l, radius) === "EXPOSED"));
  }, [control]);
  const { rows, maxWeeks, totalLines, worst, longest } = view;

  if (rows.length === 0 || !worst || !longest) {
    return (
      <div className="shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="label">Lead Time Pressure</span>
          <span className="text-label tabular-nums text-dim">0 CAT / 0 LN</span>
        </div>
        <div className="mt-1 border-y border-rule-strong py-1.5 text-label leading-body text-dim">
          NO EXPOSED LINES UNDER THIS SCENARIO. QUOTED LEAD TIMES UNAFFECTED.
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0">
      <div className="flex items-baseline justify-between">
        <span className="label">
          Lead Time Pressure
        </span>
        <span className="text-label tabular-nums text-dim">
          {rows.length} CAT / {totalLines} LN
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
            style={{ color: longest.modeled ? "var(--modeled)" : "var(--text-primary)" }}
          >
            {fmt(longest.now)}
            <span className="ml-1 text-label text-dim">{longest.driver.mpn}</span>
          </div>
        </div>
        <div>
          <div className="label">
            Largest Move
          </div>
          <div className="text-value tabular-nums" style={{ color: "var(--critical)" }}>
            ▲ {fmt(worst.delta)}
            <span className="ml-1 text-label text-dim">{worst.driver.mpn}</span>
          </div>
        </div>
      </div>

      <div>
        {rows.map((row, i) => (
          <Row key={row.category} row={row} index={i} active={active} maxWeeks={maxWeeks} />
        ))}
      </div>

      <div className="mt-2 text-label leading-body text-dim">
        BARS SCALE TO {maxWeeks}W. FILLED SEGMENT IS WEEKS ADDED SINCE PRIOR QUOTE.
        <br />
        ROW FIGURE IS THE LONGEST-POLE PART IN THE CATEGORY.
      </div>
      <div className="mt-1 text-label leading-body">
        <span style={{ color: "var(--modeled)" }}>■</span>{" "}
        <span className="text-dim">MODELED · INFERRED, NOT PER-PART OBSERVED.</span>
      </div>
    </div>
  );
}
