"use client";

import { OBSERVED_RESOLVABLE, MODELED_FLAGGED } from "@/lib/data/actions";

// Honest end state (DATA §0 truth ledger): the 13 OBSERVED RESOLVABLE lines
// (11 logistics-exposed + 2 compliance) resolve as CTAs are actioned; the 3
// MODELED tier-3 lines are only flagged: the product cannot claim to resolve
// exposure it merely inferred. 13 + 3 = 16 segments = LINES_REQUIRING_ACTION.
//
// Segment order matters. The violet MODELED block sits immediately after the
// filled green run and travels right with it, so the bar reads as one
// continuous state with the unresolved remainder trailing, not as a stalled
// loader with three orphaned segments pinned to the far end.
type Seg = "resolved" | "modeled" | "open";

function segments(observedResolved: number): Seg[] {
  return [
    ...Array<Seg>(observedResolved).fill("resolved"),
    ...Array<Seg>(MODELED_FLAGGED).fill("modeled"),
    ...Array<Seg>(OBSERVED_RESOLVABLE - observedResolved).fill("open"),
  ];
}

const FILL: Record<Seg, string> = {
  resolved: "var(--focus)",
  modeled: "var(--modeled)",
  open: "var(--bg-elevated)",
};
const STROKE: Record<Seg, string> = {
  resolved: "var(--focus)",
  modeled: "var(--modeled)",
  open: "var(--rule)",
};

export function ResolutionBar({ resolved }: { resolved: number }) {
  const observedResolved = Math.min(resolved, OBSERVED_RESOLVABLE);
  const open = OBSERVED_RESOLVABLE - observedResolved;

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-rule px-2 py-1.5">
      <div className="flex shrink-0 items-center gap-2 text-body">
        <span
          className="tabular-nums"
          style={{ color: observedResolved > 0 ? "var(--focus)" : "var(--text-primary)" }}
        >
          {observedResolved} OBSERVED RESOLVED
        </span>
        <span className="text-dim">·</span>
        <span className="tabular-nums text-modeled">
          {MODELED_FLAGGED} MODELED FLAGGED
        </span>
        <span className="text-dim">·</span>
        <span className="tabular-nums text-dim">{open} OPEN</span>
      </div>

      <div className="flex min-w-0 flex-1 gap-px">
        {segments(observedResolved).map((seg, i) => (
          <div
            key={i}
            className="h-3 flex-1"
            style={{
              background: FILL[seg],
              border: `1px solid ${STROKE[seg]}`,
              transition:
                "background-color 200ms ease-out, border-color 200ms ease-out",
            }}
          />
        ))}
      </div>
    </div>
  );
}
