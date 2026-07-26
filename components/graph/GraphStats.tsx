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

export function GraphStats({ tally, scope }: { tally: GraphTally; scope: string }) {
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
    </div>
  );
}
