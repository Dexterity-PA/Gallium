import {
  GRAPH,
  GRAPH_ADJACENCY,
  PROPAGATION_ORIGIN_ID,
  CUSTOMER_NODE_ID,
} from "@/lib/data/graph";
import { CENTERPIECE_ID } from "@/lib/data/bom";

// The scripted contamination sequence (DATA.md §5 / BRIEF Screen 3).
// Six seconds, replayable. Propagation order is a BFS from Kaohsiung over the
// exposed subgraph, so it always reaches exactly the 14 exposed BOM nodes and
// follows real edge topology.

export interface ContaminationSchedule {
  totalMs: number;
  originId: string;
  originFlareMs: number;
  activations: Array<{ id: string; atMs: number }>;
  centerAmberMs: number;
  tracePathIds: string[];
  traceAtMs: number;
  traceLabel: string;
  settleMs: number;
}

const STAGGER_MS = 60;
const PROPAGATION_START_MS = 1800;

function exposedBfsOrder(): string[] {
  const status = new Map(GRAPH.nodes.map((n) => [n.id, n.status]));
  const isExposed = (id: string) => status.get(id) === "EXPOSED";

  const order: string[] = [];
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
        order.push(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return order;
}

function tracePath(): string[] {
  // Meridian → ISO5852SDW BOM node → its supplier → Kaohsiung origin.
  const bomNode = `G-${CENTERPIECE_ID}`;
  const supplier =
    (GRAPH_ADJACENCY[bomNode] ?? []).find((n) => n.startsWith("S-")) ?? "S-TI";
  return [CUSTOMER_NODE_ID, bomNode, supplier, PROPAGATION_ORIGIN_ID];
}

export function buildContaminationSchedule(): ContaminationSchedule {
  const order = exposedBfsOrder();
  const activations = order.map((id, i) => ({
    id,
    atMs: PROPAGATION_START_MS + i * STAGGER_MS,
  }));

  return {
    totalMs: 6000,
    originId: PROPAGATION_ORIGIN_ID,
    originFlareMs: 1200,
    activations,
    centerAmberMs: 4000,
    tracePathIds: tracePath(),
    traceAtMs: 5000,
    traceLabel: "TIER-2 EXPOSURE — NOT VISIBLE IN ERP",
    settleMs: 6000,
  };
}
