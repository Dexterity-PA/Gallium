"use client";

import { useMemo } from "react";
import type { BomLine } from "@/lib/types";
import { ACTION_CODE } from "@/components/resolve/rollup";
import type { ScenarioPlan } from "@/lib/derive/plan";

// The left rail of RESOLVE: all 16 lines requiring action, one --row-h row
// each at --fs-body, no wrapping. Three sections that sum to the reconciled
// ledger:
//   OBSERVED (11)   quarantine-exposed logistics lines, --critical until
//                   AIR/ALT/BUY fires, then --focus RESOLVED.
//   COMPLIANCE (2)  ownership-FLAGGED lines (logistics-CLEAR), flip to
//                   RESOLVED as the LICENSE action fires. A separate axis.
//   MODELED (3)     inferred tier-3 lines, stay --modeled, FLAGGED forever.
// The bar groups the first two as "13 OBSERVED RESOLVED"; the third as
// "3 MODELED FLAGGED". --modeled is reserved for MODELED and nothing else.
//
// Two accents on this panel: --critical (exposed / flagged) and --focus
// (resolved, and the hover rule tying a row to its action), plus --modeled.

const COLS = "10px minmax(0,1fr) 2ch 3ch 3ch 8ch";
const GAP = "8px";

function HeadRow() {
  return (
    // font-size stays --fs-body on the grid container so the `ch` column
    // widths resolve identically to the body rows; `.label` is applied to the
    // header cells themselves, never to the grid that measures them.
    <div
      className="sticky top-0 z-10 grid items-center border-b border-rule-strong bg-panel px-2 text-body"
      style={{ gridTemplateColumns: COLS, columnGap: GAP, height: "var(--row-h)" }}
    >
      <span />
      <span className="label">MPN</span>
      <span className="label text-right">TR</span>
      <span className="label text-right">LT</span>
      <span className="label text-center">VIA</span>
      <span className="label text-right">STATE</span>
    </div>
  );
}

function SectionRow({ label, count }: { label: string; count: number }) {
  return (
    <div
      className="flex items-center justify-between border-b border-rule bg-base px-2 label"
      style={{ height: "var(--row-h)" }}
    >
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </div>
  );
}

function LineRow({
  line,
  actionId,
  compliance,
  resolved,
  highlighted,
}: {
  line: BomLine;
  actionId: string | undefined;
  /** Ownership-FLAGGED but NOT scenario-exposed: the affiliates axis. */
  compliance: boolean;
  resolved: boolean;
  highlighted: boolean;
}) {
  const modeled = line.provenance === "MODELED";

  let state: string;
  let stateColor: string;
  let glyph: string;
  let mpnColor: string;
  if (modeled) {
    // MODELED never resolves. Violet is reserved for it and nothing else.
    state = "FLAGGED";
    stateColor = "var(--modeled)";
    glyph = "▲";
    mpnColor = "var(--modeled)";
  } else if (compliance) {
    state = resolved ? "RESOLVED" : "FLAGGED";
    stateColor = resolved ? "var(--focus)" : "var(--critical)";
    glyph = resolved ? "●" : "⚑";
    mpnColor = resolved ? "var(--text-secondary)" : "var(--text-primary)";
  } else {
    state = resolved ? "RESOLVED" : "EXPOSED";
    stateColor = resolved ? "var(--focus)" : "var(--critical)";
    glyph = resolved ? "●" : "▲";
    mpnColor = resolved ? "var(--text-secondary)" : "var(--text-primary)";
  }

  return (
    <div
      className="grid items-center px-2 text-body"
      style={{
        gridTemplateColumns: COLS,
        columnGap: GAP,
        height: "var(--row-h)",
        borderLeft: `2px solid ${highlighted ? "var(--focus)" : "transparent"}`,
        background: highlighted ? "var(--bg-elevated)" : "transparent",
        transition:
          "color 200ms ease-out, background-color 200ms ease-out, border-color 200ms ease-out",
      }}
    >
      <span
        style={{ color: stateColor, transition: "color 200ms ease-out" }}
        aria-hidden
      >
        {glyph}
      </span>
      <span
        className="overflow-hidden text-ellipsis whitespace-nowrap"
        style={{
          color: mpnColor,
          fontWeight: resolved || modeled ? 400 : 500,
          transition: "color 200ms ease-out",
        }}
        title={line.description}
      >
        {line.mpn}
      </span>
      <span className="text-right text-label text-dim">
        T{line.tier}
      </span>
      <span
        className="text-right tabular-nums"
        style={{ color: modeled ? "var(--modeled)" : "var(--text-secondary)" }}
      >
        {line.leadTimeWeeks}W
      </span>
      <span
        className="text-center text-label"
        style={{
          color: resolved ? "var(--focus)" : "var(--text-dim)",
          transition: "color 200ms ease-out",
        }}
      >
        {actionId ? ACTION_CODE[actionId] : "n/a"}
      </span>
      <span
        className="text-right text-label"
        style={{ color: stateColor, transition: "color 200ms ease-out" }}
      >
        {state}
      </span>
    </div>
  );
}

export function ExposedLines({
  plan,
  actionedIds,
  hoveredActionId,
}: {
  plan: ScenarioPlan;
  actionedIds: ReadonlySet<string>;
  hoveredActionId: string | null;
}) {
  // line id -> the action that recovers it, under THIS scenario's coverage.
  const lineToAction = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of plan.actions) {
      for (const l of a.covers) m.set(l.id, a.action.id);
    }
    return m;
  }, [plan]);

  const rowFor = (line: BomLine, compliance = false) => {
    const actionId = lineToAction.get(line.id);
    return (
      <LineRow
        key={line.id}
        line={line}
        actionId={actionId}
        compliance={compliance}
        resolved={Boolean(actionId && actionedIds.has(actionId))}
        highlighted={Boolean(actionId && actionId === hoveredActionId)}
      />
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeadRow />
      <div className="min-h-0 flex-1 overflow-auto">
        <SectionRow label="Observed · logistics" count={plan.observedExposed.length} />
        {plan.observedExposed.map((l) => rowFor(l))}

        <SectionRow label="Compliance · affiliates" count={plan.complianceLines.length} />
        {plan.complianceLines.map((l) => rowFor(l, true))}

        <SectionRow label="Modeled · inferred" count={plan.modeledExposed.length} />
        {plan.modeledExposed.map((line) => (
          <LineRow
            key={line.id}
            line={line}
            actionId={undefined}
            compliance={false}
            resolved={false}
            highlighted={false}
          />
        ))}

        <div className="border-t border-rule px-2 py-1.5 text-label leading-relaxed text-dim">
          <span className="text-modeled">MODELED</span> lines are inferred
          from industry structure, not observed per part. They are flagged, never
          resolved.
        </div>
      </div>
    </div>
  );
}
