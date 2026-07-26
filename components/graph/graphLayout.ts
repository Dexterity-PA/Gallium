// Deterministic layout for the exposure flow (GRAPH screen rebuild, no
// simulation anywhere in this file). A node's position is a pure function of
// which column it belongs to and its rank within that column, so remounting
// produces byte-identical coordinates every time.

export type FlowCol = 0 | 1 | 2;

export interface FlowNode {
  id: string;
  label: string;
  col: FlowCol;
  x: number;
  y: number;
  // Column 0 (origin) is drawn as a vertical band, not a circle: radius is
  // its half-WIDTH and barHalfHeight is its half-height. Columns 1/2 are
  // plain circles (barHalfHeight is undefined) and radius is a true radius.
  radius: number;
  barHalfHeight?: number;
  modeled: boolean;
  // Out-degree within the fan (suppliers only): >1 means convergence.
  feedCount: number;
}

export interface FlowEdge {
  source: string;
  target: string;
  // Which column gap this edge crosses: 0 = origin→supplier, 1 = supplier→BOM.
  col: 0 | 1;
  weight: number; // # of BOM lines routed through this relationship
  // False when this line collapses a real multi-hop path (origin→zone
  // site→supplier) into one drawn segment. Supplier→BOM edges are always a
  // real single hop, so this is only ever false on a col-0 edge.
  direct: boolean;
  hops: number; // real edge count from origin to the target, over GRAPH_ADJACENCY
  // Precomputed hop-tick anchor (40% along the edge, collision-nudged), set
  // only when !direct. Precomputed here, once, rather than in the per-frame
  // canvas draw, since positions are pure and never change after layout.
  tickX?: number;
  tickY?: number;
}

export interface FlowLayout {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
  colX: [number, number, number];
}

const MARGIN_X = 140;
// Column spacing is an OCCUPANCY decision, not a per-gap aesthetic one. The
// fit in SupplyGraph.tsx scales the whole bbox to fit the panel, so what
// matters is the bbox's aspect ratio against the panel's usable aspect: too
// tall and the fit is height-bound, leaving dead margins left and right.
//
// Usable aspect (panel minus the fit pads in SupplyGraph.tsx) measures 1.87 at
// 1920x1080 and 1.85 at 2560x1440. The bbox is 417 world units tall (13 gaps
// of MIN_ROW_GAP, plus a column-1 radius top and bottom), so to match the
// tighter of those two it wants to be ~770 wide: 418 + 342 + the two end
// radii. That keeps the fit height-bound at both viewports while spending
// 98%+ of the usable width, instead of the previous 670-wide bbox that left
// the frame with margins nothing was ever drawn into.
//
// The split between the two gaps is the aesthetic part. Origin-to-suppliers
// carries 10 near-parallel lines and nothing else, so it is the band that
// reads as empty; suppliers-to-BOM carries the fan and its crossings, so it
// earns more room. Hence the previous 460/210 became 418/342.
const GAP_ORIGIN_SUPPLIERS = 418;
const GAP_SUPPLIERS_BOM = 342;
// Baseline row spacing for whichever column is denser (usually the BOM
// lines): both columns 1 and 2 then share that SAME total vertical span,
// so the sparser column spreads out to fill it rather than sitting
// compressed in a middle band.
const MIN_ROW_GAP = 31;
// Col 0 radius = half-width of the origin band. Narrowed (was 9, an 18px
// bar that read as a scrollbar), still visibly wider-than-tall so it reads
// as a band, not a circle.
const RADIUS: Record<FlowCol, number> = { 0: 5, 1: 7, 2: 5 };
const TICK_MIN_SEP = 10; // world units; below this, nudge a tick deterministically

// A convergent supplier (feeds >1 exposed line) gets a heavier ring outside
// its base radius. These two functions are the ONE description of that ring,
// shared by the ring draw and the label offset so they can never drift out
// of sync (that drift is what overlapped the TI label with its own ring).
//
// ringExtent is in WORLD units: how far the ring's centre-line sits outside
// the node radius. ringStrokePx is in SCREEN px: the stroke is drawn at a
// zoom-independent width, so half of it spills outside that centre-line by a
// constant number of pixels no matter how far out you zoom. A label offset
// that forgets that half-stroke lands on the ring at low zoom, which is
// exactly where the previous pass's arithmetic broke down.
export function ringExtent(feedCount: number): number {
  return feedCount > 1 ? 3 + Math.min(6, (feedCount - 1) * 2) : 0;
}
export function ringStrokePx(feedCount: number): number {
  return feedCount > 1 ? 1.5 + (feedCount - 1) * 1.1 : 0;
}

function columnYForSpan(count: number, span: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => (i / (count - 1) - 0.5) * span);
}

// Deterministic fallback if a hop-tick anchor lands within TICK_MIN_SEP of
// one already placed: push it straight down by a fixed step until clear.
// With the shared-span row layout below, rows are MIN_ROW_GAP apart (> the
// separation threshold), so this never actually fires today; it's here so
// a future denser layout doesn't reintroduce overlapping tick labels.
function placeTickDeterministically(
  point: { x: number; y: number },
  placed: Array<{ x: number; y: number }>
): { x: number; y: number } {
  const { x } = point;
  let { y } = point;
  let guard = 0;
  while (placed.some((p) => Math.hypot(p.x - x, p.y - y) < TICK_MIN_SEP) && guard < 20) {
    y += TICK_MIN_SEP;
    guard++;
  }
  return { x, y };
}

export interface FlowNodeInput {
  id: string;
  label: string;
  modeled: boolean;
}

export interface SupplierHop {
  direct: boolean;
  hops: number;
}

export function buildFlowLayout(input: {
  origin: FlowNodeInput;
  suppliers: FlowNodeInput[];
  bomLines: FlowNodeInput[];
  supplierOfBom: Map<string, string>; // bomId -> supplierId
  supplierHops: Map<string, SupplierHop>; // supplierId -> real hop count from origin
}): FlowLayout {
  const { origin, suppliers, bomLines, supplierOfBom, supplierHops } = input;

  const feedCount = new Map<string, number>();
  for (const supId of supplierOfBom.values()) {
    feedCount.set(supId, (feedCount.get(supId) ?? 0) + 1);
  }

  // Column 1 (suppliers): the barycenter against column 0 is identical for
  // every supplier (a single origin node), so the one meaningful, deterministic
  // ordering signal left is the supplier's own label.
  const orderedSuppliers = [...suppliers].sort((a, b) => a.label.localeCompare(b.label));
  const supplierRank = new Map(orderedSuppliers.map((s, i) => [s.id, i]));

  // Column 2 (BOM lines): one barycenter pass against column 1: a line's
  // position is its parent supplier's rank, tie-broken by label. This groups
  // every line under a convergent supplier together, which is what actually
  // cuts crossings without a full Sugiyama solve.
  const orderedBom = [...bomLines].sort((a, b) => {
    const ra = supplierRank.get(supplierOfBom.get(a.id) ?? "") ?? 0;
    const rb = supplierRank.get(supplierOfBom.get(b.id) ?? "") ?? 0;
    return ra - rb || a.label.localeCompare(b.label);
  });

  const colX: [number, number, number] = [
    MARGIN_X,
    MARGIN_X + GAP_ORIGIN_SUPPLIERS,
    MARGIN_X + GAP_ORIGIN_SUPPLIERS + GAP_SUPPLIERS_BOM,
  ];
  const width = colX[2] + MARGIN_X; // right margin mirrors the left

  // Shared vertical span: both columns spread across the SAME extent,
  // sized off the denser column at a legible baseline gap. The sparser
  // column (usually suppliers) gets a larger per-row gap as a result,
  // instead of sitting compressed in a middle band.
  const denserCount = Math.max(orderedSuppliers.length, orderedBom.length, 2);
  const sharedSpan = (denserCount - 1) * MIN_ROW_GAP;
  const supplierY = columnYForSpan(orderedSuppliers.length, sharedSpan);
  const bomY = columnYForSpan(orderedBom.length, sharedSpan);
  const barHalfHeight = sharedSpan / 2;
  const barRightX = colX[0] + RADIUS[0];

  const nodes: FlowNode[] = [
    {
      id: origin.id,
      label: origin.label,
      col: 0,
      x: colX[0],
      y: 0,
      radius: RADIUS[0],
      barHalfHeight,
      modeled: origin.modeled,
      feedCount: 0,
    },
    ...orderedSuppliers.map((s, i) => ({
      id: s.id,
      label: s.label,
      col: 1 as const,
      x: colX[1],
      y: supplierY[i],
      radius: RADIUS[1],
      modeled: s.modeled,
      feedCount: feedCount.get(s.id) ?? 0,
    })),
    ...orderedBom.map((b, i) => ({
      id: b.id,
      label: b.label,
      col: 2 as const,
      x: colX[2],
      y: bomY[i],
      radius: RADIUS[2],
      modeled: b.modeled,
      feedCount: 0,
    })),
  ];

  // Origin→supplier edges leave the band at a y position distributed along
  // it, specifically at the same row height as the supplier they connect
  // to, rather than converging on one point. That's what turns a fan/hub
  // artifact into a set of parallel lines reading as "leaving a site."
  const edges: FlowEdge[] = [];
  const placedTicks: Array<{ x: number; y: number }> = [];
  orderedSuppliers.forEach((s, i) => {
    const hop = supplierHops.get(s.id) ?? { direct: true, hops: 1 };
    const sy = supplierY[i];
    const edge: FlowEdge = {
      source: origin.id,
      target: s.id,
      col: 0,
      weight: feedCount.get(s.id) ?? 1,
      direct: hop.direct,
      hops: hop.hops,
    };
    if (!hop.direct) {
      // The edge is a straight line from (barRightX, sy) to (colX[1], sy):
      // 40% along it, then nudged if that anchor collides with one already placed.
      const raw = { x: barRightX + 0.4 * (colX[1] - barRightX), y: sy };
      const placed = placeTickDeterministically(raw, placedTicks);
      placedTicks.push(placed);
      edge.tickX = placed.x;
      edge.tickY = placed.y;
    }
    edges.push(edge);
  });
  for (const [bomId, supId] of supplierOfBom) {
    edges.push({ source: supId, target: bomId, col: 1, weight: 1, direct: true, hops: 1 });
  }

  const height = sharedSpan + RADIUS[1] * 6;

  return { nodes, edges, width, height, colX };
}

// ---- full-network background layout (context texture behind the toggle) --
// Deliberately NOT the flow's own column/rank layout: this is inert
// decoration, not a spatially-consistent view of the same nodes, so a plain
// deterministic ring placement (evenly spaced by index, no jitter needed
// since even spacing already prevents exact coincidence) is enough. No
// simulation. Positions ARE emitted in the flow's world-coordinate space
// (center + radius passed in) so the caller can paint this layer through the
// exact same pan/zoom transform as the foreground, instead of drifting out
// of sync while panning.

export interface BackgroundNode {
  id: string;
  x: number;
  y: number;
}

export interface BackgroundEdge {
  source: string;
  target: string;
}

const BG_RING_R: Record<number, number> = { 0: 0, 1: 0.32, 2: 0.62, 3: 0.94 };

export function buildBackgroundLayout(
  nodes: Array<{ id: string; ring: number }>,
  edges: Array<{ source: string; target: string }>,
  center: { x: number; y: number },
  radius: number
): { nodes: BackgroundNode[]; edges: BackgroundEdge[] } {
  const byRing = new Map<number, string[]>();
  for (const n of nodes) {
    const arr = byRing.get(n.ring) ?? [];
    arr.push(n.id);
    byRing.set(n.ring, arr);
  }
  for (const arr of byRing.values()) arr.sort();

  const pos = new Map<string, { x: number; y: number }>();
  for (const [ring, ids] of byRing) {
    const r = BG_RING_R[ring] ?? 0.94;
    ids.forEach((id, i) => {
      if (r === 0) {
        pos.set(id, { x: center.x, y: center.y });
        return;
      }
      const theta = (i / ids.length) * 2 * Math.PI;
      pos.set(id, {
        x: center.x + r * radius * Math.cos(theta),
        y: center.y + r * radius * Math.sin(theta),
      });
    });
  }

  return {
    nodes: nodes.map((n) => ({ id: n.id, ...(pos.get(n.id) ?? center) })),
    edges: edges.filter((e) => pos.has(e.source) && pos.has(e.target)),
  };
}
