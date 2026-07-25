// Stats block — fixed top-right of the graph canvas (DESIGN §4 panel, §3 type).
// Every number is DERIVED from GRAPH via graphTally(): node status counts, edge
// provenance counts, and the observed/modeled ratio + share. No literals.
//
// Sits top-right (the node detail panel is bottom-right; the TIER-2 EXPOSURE
// trace label rides the interior of the cyan spoke well inside the frame), so
// this corner block clears both.

import { graphTally } from "@/components/graph/graphDerive";

const T = graphTally();

function Row({
  label,
  value,
  dot,
  valueColor,
  indent,
}: {
  label: string;
  value: string;
  dot?: string;
  valueColor?: string;
  indent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`flex items-center gap-1 text-[10px] uppercase tracking-[0.10em] text-[var(--text-lo)] ${
          indent ? "pl-2" : ""
        }`}
      >
        {dot ? (
          <span className="text-[9px] leading-none" style={{ color: dot }} aria-hidden>
            ●
          </span>
        ) : null}
        {label}
      </span>
      <span
        className="text-[11px] font-medium tabular-nums leading-none"
        style={{ color: valueColor ?? "var(--text-hi)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function GraphStats() {
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10 w-[168px] select-none border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-base)_88%,transparent)] px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between border-b border-[var(--border)] pb-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-lo)]">
          Graph
        </span>
        <span className="text-[10px] tabular-nums tracking-[0.06em] text-[var(--text-lo)]">
          {T.nodeTotal}N · {T.edgeTotal}E
        </span>
      </div>

      <div className="space-y-0.5">
        <Row label="Nodes" value={String(T.nodeTotal)} />
        <Row label="Clear" value={String(T.nodesByStatus.CLEAR)} dot="var(--green)" indent />
        <Row label="At risk" value={String(T.nodesByStatus.AT_RISK)} dot="var(--orange)" indent />
        <Row label="Exposed" value={String(T.nodesByStatus.EXPOSED)} dot="var(--red)" indent />
      </div>

      <div className="my-1 border-t border-[var(--border)]" />

      <div className="space-y-0.5">
        <Row label="Edges" value={String(T.edgeTotal)} />
        <Row label="Observed" value={String(T.observedEdges)} indent />
        <Row
          label="Modeled"
          value={String(T.modeledEdges)}
          valueColor="var(--violet)"
          indent
        />
      </div>

      <div className="my-1 border-t border-[var(--border)]" />

      <div className="space-y-0.5">
        <Row label="Obs : Mod" value={`${T.observedPerModeled.toFixed(1)} : 1`} />
        <Row label="Obs share" value={`${T.observedSharePct.toFixed(1)}%`} />
      </div>
    </div>
  );
}
