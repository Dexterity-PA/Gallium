// Pure derivations for the GRAPH screen's detail overlays.
//
// Everything here is computed from the exported GRAPH (nodes + edges). The
// supplier→site relationships that graph.ts builds from its (non-exported)
// SUPPLIER_SITE / MFR_TO_SUPPLIER maps are already materialized as real edges,
// so walking GRAPH.edges recovers the same chains without reaching into lib
// internals. If lib later exported SUPPLIER_SITE we could label hops with the
// exact stage ("primary" vs "zone"). See the return notes.

import { GRAPH } from "@/lib/data/graph";
import type { GraphNode, GraphEdge, Provenance, Status } from "@/lib/types";

const nodeById: Map<string, GraphNode> = new Map(
  GRAPH.nodes.map((n) => [n.id, n])
);

// Undirected incidence list: every edge appears under both endpoints.
const edgesByNode: Map<string, GraphEdge[]> = (() => {
  const m = new Map<string, GraphEdge[]>();
  for (const n of GRAPH.nodes) m.set(n.id, []);
  for (const e of GRAPH.edges) {
    m.get(e.source)?.push(e);
    m.get(e.target)?.push(e);
  }
  return m;
})();

const STATUS_RANK: Record<Status, number> = { CLEAR: 1, AT_RISK: 2, EXPOSED: 3 };

// ---- connected edges (Job 1: the EDGES list) ----------------------
export interface ConnectedEdge {
  neighbor: GraphNode;
  provenance: Provenance;
  confidence: number;
}

export function connectedEdges(nodeId: string): ConnectedEdge[] {
  const out: ConnectedEdge[] = [];
  for (const e of edgesByNode.get(nodeId) ?? []) {
    const otherId = e.source === nodeId ? e.target : e.source;
    const neighbor = nodeById.get(otherId);
    if (!neighbor) continue;
    out.push({
      neighbor,
      provenance: e.provenance,
      confidence: e.confidence,
    });
  }
  // Deterministic: shallow rings first (toward Meridian), then by label.
  out.sort(
    (a, b) =>
      a.neighbor.ring - b.neighbor.ring ||
      a.neighbor.label.localeCompare(b.neighbor.label)
  );
  return out;
}

// ---- supply path (Job 1: the SUPPLY PATH chain) -------------------
// Rings are tiers: 0 Meridian · 1 BOM line · 2 supplier · 3 fab/backend/site.
// Adjacent tiers are edge-connected, so a representative chain through a node is
// the walk UP toward Meridian (ring-1 at each step) plus the walk DOWN toward a
// site (ring+1). At each step we follow the worst-case real edge (most exposed
// neighbor, then OBSERVED over MODELED, then id) so the path traces the
// contamination story this screen is about: every hop is a real GRAPH edge.

function neighborAtRing(
  fromId: string,
  targetRing: number,
  exclude: Set<string>
): GraphNode | null {
  const cands: Array<{ node: GraphNode; observed: boolean }> = [];
  for (const e of edgesByNode.get(fromId) ?? []) {
    const otherId = e.source === fromId ? e.target : e.source;
    if (exclude.has(otherId)) continue;
    const n = nodeById.get(otherId);
    if (!n || n.ring !== targetRing) continue;
    cands.push({ node: n, observed: e.provenance === "OBSERVED" });
  }
  if (cands.length === 0) return null;
  cands.sort(
    (a, b) =>
      STATUS_RANK[b.node.status] - STATUS_RANK[a.node.status] ||
      Number(b.observed) - Number(a.observed) ||
      a.node.id.localeCompare(b.node.id)
  );
  return cands[0].node;
}

function edgeBetween(a: string, b: string): GraphEdge | null {
  for (const e of edgesByNode.get(a) ?? []) {
    if (
      (e.source === a && e.target === b) ||
      (e.source === b && e.target === a)
    ) {
      return e;
    }
  }
  return null;
}

export interface PathStep {
  node: GraphNode;
  // The edge linking this step to the PREVIOUS step (null for the first row).
  edge: { provenance: Provenance; confidence: number } | null;
  isSelected: boolean;
}

export function supplyPath(nodeId: string): PathStep[] {
  const node = nodeById.get(nodeId);
  if (!node) return [];

  const seen = new Set<string>([nodeId]);

  // upstream: node.ring - 1 ... 0 (Meridian)
  const up: GraphNode[] = [];
  let cur: GraphNode = node;
  while (cur.ring > 0) {
    const parent = neighborAtRing(cur.id, cur.ring - 1, seen);
    if (!parent) break;
    seen.add(parent.id);
    up.push(parent);
    cur = parent;
  }
  up.reverse(); // Meridian first

  // downstream: node.ring + 1 ... 3 (site)
  const down: GraphNode[] = [];
  cur = node;
  while (cur.ring < 3) {
    const child = neighborAtRing(cur.id, cur.ring + 1, seen);
    if (!child) break;
    seen.add(child.id);
    down.push(child);
    cur = child;
  }

  const seq = [...up, node, ...down];
  return seq.map((n, i) => {
    const prev = seq[i - 1];
    const e = prev ? edgeBetween(prev.id, n.id) : null;
    return {
      node: n,
      edge: e ? { provenance: e.provenance, confidence: e.confidence } : null,
      isSelected: n.id === nodeId,
    };
  });
}

// ---- graph-wide tallies (Job 2: the stats block) -----------------
// Derived by reduction over GRAPH, never literals.
export interface GraphTally {
  nodeTotal: number;
  nodesByStatus: Record<Status, number>;
  edgeTotal: number;
  observedEdges: number;
  modeledEdges: number;
  observedPerModeled: number; // OBSERVED : MODELED as x:1
  observedSharePct: number; // OBSERVED / (OBSERVED + MODELED) * 100
}

export function graphTally(status?: ReadonlyMap<string, Status>): GraphTally {
  const nodesByStatus: Record<Status, number> = {
    CLEAR: 0,
    AT_RISK: 0,
    EXPOSED: 0,
  };
  // Optional status override: the scenario control recolors the network
  // (lib/derive/scenario.ts scenarioGraphView) without touching GRAPH itself.
  for (const n of GRAPH.nodes) nodesByStatus[status?.get(n.id) ?? n.status] += 1;

  let observedEdges = 0;
  let modeledEdges = 0;
  for (const e of GRAPH.edges) {
    if (e.provenance === "MODELED") modeledEdges += 1;
    else observedEdges += 1;
  }
  const edgeTotal = observedEdges + modeledEdges;

  return {
    nodeTotal: GRAPH.nodes.length,
    nodesByStatus,
    edgeTotal,
    observedEdges,
    modeledEdges,
    observedPerModeled: modeledEdges > 0 ? observedEdges / modeledEdges : 0,
    observedSharePct: edgeTotal > 0 ? (observedEdges / edgeTotal) * 100 : 0,
  };
}
