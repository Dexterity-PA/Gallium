"use client";



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

function segments(observedResolved: number, resolvable: number, modeledFlagged: number): Seg[] {
  return [
    ...Array<Seg>(observedResolved).fill("resolved"),
    ...Array<Seg>(modeledFlagged).fill("modeled"),
    ...Array<Seg>(Math.max(0, resolvable - observedResolved)).fill("open"),
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

export function ResolutionBar({
  resolved,
  resolvable,
  modeledFlagged,
}: {
  resolved: number;
  /** OBSERVED RESOLVABLE under the current scenario (13 at the default). */
  resolvable: number;
  /** Modeled exposed lines under the current scenario (3 at the default). */
  modeledFlagged: number;
}) {
  const observedResolved = Math.min(resolved, resolvable);
  const open = Math.max(0, resolvable - observedResolved);

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
          {modeledFlagged} MODELED FLAGGED
        </span>
        <span className="text-dim">·</span>
        <span className="tabular-nums text-dim">{open} OPEN</span>
      </div>

      <div className="flex min-w-0 flex-1 gap-px">
        {segments(observedResolved, resolvable, modeledFlagged).map((seg, i) => (
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
