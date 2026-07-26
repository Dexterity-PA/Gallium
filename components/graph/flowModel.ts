// The one description of what the GRAPH screen actually draws.
//
// This module exists because the screen used to carry two different answers to
// "how big is this graph": the panel header read a static GRAPH_STATS (the whole
// 90-node network) while the on-canvas stats block read the rendered foreground
// (25 nodes). Two inches apart, in the same frame, disagreeing.
//
// Everything a caller needs to label the view now comes from here: the layout
// the canvas draws from, and the two tallies derived from it. The header, the
// stats block, and the canvas cannot disagree because there is nothing left to
// disagree with.

import { GRAPH } from "@/lib/data/graph";
import { buildContaminationSchedule } from "@/components/graph/ContaminationSequence";
import { buildFlowLayout, type FlowEdge, type FlowLayout } from "@/components/graph/graphLayout";
import { graphTally, type GraphTally } from "@/components/graph/graphDerive";
import type { Status } from "@/lib/types";

export const SCHEDULE = buildContaminationSchedule();
export const NODE_BY_ID = new Map(GRAPH.nodes.map((n) => [n.id, n]));

// The three-column exposure flow (BRIEF Screen 3 rebuild): one affected site
// feeds N suppliers, which feed M BOM lines. Layout is a pure function of
// column membership + rank (see graphLayout.ts). There is no simulation
// anywhere in this screen.
export const LAYOUT: FlowLayout = buildFlowLayout({
  origin: {
    id: SCHEDULE.originId,
    label: SCHEDULE.originLabel,
    modeled: NODE_BY_ID.get(SCHEDULE.originId)?.provenance === "MODELED",
  },
  suppliers: SCHEDULE.tier2Ids.map((id) => ({
    id,
    label: NODE_BY_ID.get(id)?.label ?? id,
    modeled: NODE_BY_ID.get(id)?.provenance === "MODELED",
  })),
  bomLines: SCHEDULE.tier1Ids.map((id) => ({
    id,
    label: NODE_BY_ID.get(id)?.label ?? id,
    modeled: NODE_BY_ID.get(id)?.provenance === "MODELED",
  })),
  supplierOfBom: SCHEDULE.supplierOfBom,
  supplierHops: SCHEDULE.hopBySupplier,
});

function realEdgeProvenance(a: string, b: string): "OBSERVED" | "MODELED" | null {
  const real = GRAPH.edges.find(
    (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a)
  );
  return real?.provenance ?? null;
}

// A rendered edge's provenance: a direct line and a supplier to BOM line both
// correspond to one real GRAPH edge, so look that up. A collapsed multi-hop
// origin to supplier line has no single real edge to point to. It is a drawn
// simplification of a real multi-hop path, which is what MODELED means here.
export function renderedEdgeProvenance(edge: FlowEdge): "OBSERVED" | "MODELED" {
  if (edge.col === 1 || edge.direct) {
    const real = realEdgeProvenance(edge.source, edge.target);
    if (real) return real;
  }
  return "MODELED";
}

// What the canvas draws with the full-network toggle ON: the whole network.
export const FULL_TALLY: GraphTally = graphTally();

// What the canvas draws with the toggle OFF: the contamination path only,
// counted off the exact objects the renderer iterates (LAYOUT.nodes /
// LAYOUT.edges), not a parallel re-derivation that could drift from them.
export const FOREGROUND_TALLY: GraphTally = (() => {
  const nodesByStatus: Record<Status, number> = { CLEAR: 0, AT_RISK: 0, EXPOSED: 0 };
  for (const n of LAYOUT.nodes) {
    const real = NODE_BY_ID.get(n.id);
    if (real) nodesByStatus[real.status] += 1;
  }
  let observedEdges = 0;
  let modeledEdges = 0;
  for (const e of LAYOUT.edges) {
    if (renderedEdgeProvenance(e) === "MODELED") modeledEdges += 1;
    else observedEdges += 1;
  }
  const edgeTotal = observedEdges + modeledEdges;
  return {
    nodeTotal: LAYOUT.nodes.length,
    nodesByStatus,
    edgeTotal,
    observedEdges,
    modeledEdges,
    observedPerModeled: modeledEdges > 0 ? observedEdges / modeledEdges : 0,
    observedSharePct: edgeTotal > 0 ? (observedEdges / edgeTotal) * 100 : 0,
  };
})();

// The two scopes this screen can be in, named once so the panel header and the
// on-canvas stats block use the same word for the same thing.
export const SCOPE_LABEL = {
  foreground: "EXPOSED PATH",
  full: "FULL NETWORK",
} as const;

export function tallyForScope(fullNetwork: boolean): GraphTally {
  return fullNetwork ? FULL_TALLY : FOREGROUND_TALLY;
}
