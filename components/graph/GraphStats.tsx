// Stats block, fixed top-right of the graph canvas. Every number is DERIVED
// from the SAME data the canvas renders from: the tally and the scope name are
// both passed in from flowModel.ts, which is also what the panel header reads,
// so this block, the header and the canvas cannot report three different sizes
// for one picture.
//
// Deliberately dense: color already carries CLEAR/AT RISK/EXPOSED meaning
// everywhere else in this app (ok/warn/critical), so this panel leans on
// that instead of spelling out a text label per number. The point is to
// leave the canvas room to grow, not to be a second legend.

import type { GraphTally } from "@/components/graph/graphDerive";
import type { ScopeFocus } from "@/components/graph/flowModel";

function Count({ dot, value }: { dot: string; value: number }) {
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium tabular-nums text-primary">
      <span className="text-[9px] leading-none" style={{ color: dot }} aria-hidden>
        ●
      </span>
      {value}
    </span>
  );
}

export function GraphStats({
  tally,
  scope,
  focus,
}: {
  tally: GraphTally;
  scope: string;
  /** The focused-part row (flowModel.ts tallyForScope). Absent when nothing
   *  is focused, so the unfocused block renders exactly as before. */
  focus?: ScopeFocus | null;
}) {
  const T = tally;
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-[180px] select-none border border-rule bg-[color-mix(in_srgb,var(--bg-base)_88%,transparent)] px-2 py-1"
      // 24px safe margin, same as the canvas controls below. This block is
      // pinned to a full-bleed panel, so right-2 put its edge counts 8px off
      // the window.
      style={{ right: "var(--safe-inset)" }}
    >
      {/* gap-2, not justify-between alone: the widest scope name (FULL
          NETWORK) and the widest count pair (90N · 162E) otherwise butt
          together with no space between them. */}
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-dim">{scope}</span>
        <span className="text-[10px] tabular-nums tracking-[0.06em] text-dim">
          {T.nodeTotal}N · {T.edgeTotal}E
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <Count dot="var(--ok)" value={T.nodesByStatus.CLEAR} />
        <Count dot="var(--warn)" value={T.nodesByStatus.AT_RISK} />
        <Count dot="var(--critical)" value={T.nodesByStatus.EXPOSED} />
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums tracking-[0.04em] text-dim">
        <span>
          {T.observedEdges} obs · <span style={{ color: "var(--modeled)" }}>{T.modeledEdges} mod</span>
        </span>
        <span>{T.observedSharePct.toFixed(1)}%</span>
      </div>

      {/* The focused part, when there is one. Both branches come from the
          same tallyForScope call the header reads, so this row and the
          panel corner cannot disagree about the focused state. The no-path
          branch is the graceful degrade: base scope stays rendered, the
          reason is stated quietly, nothing is drawn for the part. */}
      {focus ? (
        focus.kind === "path" ? (
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] tabular-nums tracking-[0.04em]">
            <span className="min-w-0 truncate" style={{ color: "var(--trace)" }}>
              FOCUS {focus.mpn}
            </span>
            <span className="shrink-0 text-dim">
              {focus.tally.nodeTotal}N · {focus.tally.edgeTotal}E
            </span>
          </div>
        ) : (
          <div className="mt-1 text-[10px] tracking-[0.04em]">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-dim">FOCUS {focus.mpn}</span>
              <span className="shrink-0 text-dim">NO PATH</span>
            </div>
            <div className="text-[9px] tracking-[0.02em] text-dim">{focus.reason}</div>
          </div>
        )
      ) : null}
    </div>
  );
}
