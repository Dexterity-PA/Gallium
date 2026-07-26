import { GRAPH, GRAPH_ADJACENCY, PROPAGATION_ORIGIN_ID } from "@/lib/data/graph";

// The exposure fan (DATA.md §5 / BRIEF Screen 3): every exposed BOM line
// reachable from the affected backend, and the distinct supplier standing
// behind each one. This is the entire dataset the three-column flow draws,
// derived from the real BFS + adjacency, nothing hardcoded. A supplier
// feeding more than one exposed line is the convergence the screen exists
// to show.

export interface SupplierHop {
  direct: boolean; // true iff the supplier is a real one-edge neighbor of the origin
  hops: number; // real edge count from origin to supplier over GRAPH_ADJACENCY
  viaIds: string[]; // intermediate node id(s) on that real shortest path (empty when direct)
}

export interface ContaminationSchedule {
  totalMs: number;
  originId: string;
  originLabel: string;
  tier1Ids: string[]; // BOM nodes, column 3 ("BOM LINES")
  tier2Ids: string[]; // supplier nodes, column 2 ("SUPPLIERS")
  convergentIds: string[]; // tier-2 suppliers feeding >1 tier-1 line
  supplierOfBom: Map<string, string>; // bomId -> supplierId
  // Real shortest path from origin to each supplier: some suppliers are
  // collapsed onto a direct origin→supplier line in the drawing even though
  // the real graph routes them through an intermediate zone site.
  hopBySupplier: Map<string, SupplierHop>;
  directSupplierCount: number;
  viaSupplierCount: number;
  // Column-by-column reveal: site appears, then edges fan to suppliers, then
  // edges fan to BOM lines, then the header count resolves. Eased, no bounce.
  originAtMs: number;
  column2AtMs: number;
  column3AtMs: number;
  headerAtMs: number;
  fadeMs: number;
  headerLabel: string;
}

// Unweighted shortest path over the real adjacency (not just the exposed
// subgraph). This is what tells a direct origin→supplier edge apart from
// one the drawing collapses across an intermediate zone site.
function shortestPath(from: string, to: string): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const seen = new Set<string>([from]);
  let frontier = [from];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const neighbors = (GRAPH_ADJACENCY[id] ?? []).slice().sort();
      for (const n of neighbors) {
        if (seen.has(n)) continue;
        seen.add(n);
        prev.set(n, id);
        if (n === to) {
          const path = [to];
          let cur = to;
          while (cur !== from) {
            cur = prev.get(cur)!;
            path.push(cur);
          }
          return path.reverse();
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

function exposedReachable(): Set<string> {
  const status = new Map(GRAPH.nodes.map((n) => [n.id, n.status]));
  const isExposed = (id: string) => status.get(id) === "EXPOSED";

  const seen = new Set<string>([PROPAGATION_ORIGIN_ID]);
  let frontier = [PROPAGATION_ORIGIN_ID];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const neighbors = (GRAPH_ADJACENCY[id] ?? [])
        .filter((n) => isExposed(n) && !seen.has(n))
        .sort(); // deterministic ordering within a level
      for (const n of neighbors) {
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return seen;
}

export function buildContaminationSchedule(): ContaminationSchedule {
  const nodeById = new Map(GRAPH.nodes.map((n) => [n.id, n]));
  const reachable = exposedReachable();

  const tier1Ids = GRAPH.nodes
    .filter((n) => n.ring === 1 && n.status === "EXPOSED" && reachable.has(n.id))
    .map((n) => n.id)
    .sort();

  // Every BOM node has exactly one ring-2 (supplier) neighbor by
  // construction (lib/data/graph.ts: one "BOM → supplier" edge per line).
  const supplierOfBom = new Map<string, string>();
  for (const bomId of tier1Ids) {
    const sup = (GRAPH_ADJACENCY[bomId] ?? []).find(
      (nid) => nodeById.get(nid)?.ring === 2
    );
    if (sup) supplierOfBom.set(bomId, sup);
  }

  const tier2Ids = Array.from(new Set(supplierOfBom.values())).sort();

  const feedCount = new Map<string, number>();
  for (const supId of supplierOfBom.values()) {
    feedCount.set(supId, (feedCount.get(supId) ?? 0) + 1);
  }
  const convergentIds = tier2Ids.filter((id) => (feedCount.get(id) ?? 0) > 1);

  const originLabel = nodeById.get(PROPAGATION_ORIGIN_ID)?.label ?? PROPAGATION_ORIGIN_ID;

  // Direct-vs-collapsed split: real shortest path from origin to each
  // supplier. Most exposed suppliers sit one hop off the origin site; a few
  // route through an intermediate (often modeled) zone site, and the drawing
  // still shows one line for legibility, so this is what makes that
  // collapse inspectable instead of asserting a directness the data lacks.
  const hopBySupplier = new Map<string, SupplierHop>();
  for (const supId of tier2Ids) {
    const path = shortestPath(PROPAGATION_ORIGIN_ID, supId);
    const hops = path ? path.length - 1 : 1;
    const viaIds = path && path.length > 2 ? path.slice(1, -1) : [];
    hopBySupplier.set(supId, { direct: hops <= 1, hops, viaIds });
  }
  const directSupplierCount = tier2Ids.filter((id) => hopBySupplier.get(id)?.direct).length;
  const viaSupplierCount = tier2Ids.length - directSupplierCount;

  return {
    totalMs: 6000,
    originId: PROPAGATION_ORIGIN_ID,
    originLabel,
    tier1Ids,
    tier2Ids,
    convergentIds,
    supplierOfBom,
    hopBySupplier,
    directSupplierCount,
    viaSupplierCount,
    originAtMs: 0,
    column2AtMs: 1600,
    column3AtMs: 3600,
    headerAtMs: 5200,
    fadeMs: 550,
    headerLabel: `CONTAMINATION PATH · ${originLabel.toUpperCase()} → ${tier2Ids.length} SUPPLIERS (${directSupplierCount} DIRECT · ${viaSupplierCount} VIA ZONE SITES) → ${tier1Ids.length} BOM LINES → MERIDIAN`,
  };
}
