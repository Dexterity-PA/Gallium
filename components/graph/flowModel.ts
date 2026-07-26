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
import {
  buildContaminationSchedule,
  type ContaminationSchedule,
} from "@/components/graph/ContaminationSequence";
import { buildFlowLayout, type FlowEdge, type FlowLayout } from "@/components/graph/graphLayout";
import { graphTally, type GraphTally } from "@/components/graph/graphDerive";
import type { BomLine, Status } from "@/lib/types";
import {
  type ScenarioControlState,
  isDefaultScenarioControl,
} from "@/lib/data/scenario";
import { scenarioGraphView } from "@/lib/derive/scenario";

export const SCHEDULE = buildContaminationSchedule();
export const NODE_BY_ID = new Map(GRAPH.nodes.map((n) => [n.id, n]));

// The three-column exposure flow (BRIEF Screen 3 rebuild): one affected site
// feeds N suppliers, which feed M BOM lines. Layout is a pure function of
// column membership + rank (see graphLayout.ts). There is no simulation
// anywhere in this screen.
function layoutFor(schedule: ContaminationSchedule): FlowLayout {
  return buildFlowLayout({
    origin: {
      id: schedule.originId,
      label: schedule.originLabel,
      modeled: NODE_BY_ID.get(schedule.originId)?.provenance === "MODELED",
    },
    suppliers: schedule.tier2Ids.map((id) => ({
      id,
      label: NODE_BY_ID.get(id)?.label ?? id,
      modeled: NODE_BY_ID.get(id)?.provenance === "MODELED",
    })),
    bomLines: schedule.tier1Ids.map((id) => ({
      id,
      label: NODE_BY_ID.get(id)?.label ?? id,
      modeled: NODE_BY_ID.get(id)?.provenance === "MODELED",
    })),
    supplierOfBom: schedule.supplierOfBom,
    supplierHops: schedule.hopBySupplier,
  });
}

export const LAYOUT: FlowLayout = layoutFor(SCHEDULE);

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

// The foreground (toggle OFF) tally is counted off the exact objects the
// renderer iterates (layout.nodes / layout.edges), not a parallel
// re-derivation that could drift from them.
function foregroundTallyFor(
  layout: FlowLayout,
  status?: ReadonlyMap<string, Status>
): GraphTally {
  const nodesByStatus: Record<Status, number> = { CLEAR: 0, AT_RISK: 0, EXPOSED: 0 };
  for (const n of layout.nodes) {
    const real = NODE_BY_ID.get(n.id);
    if (real) nodesByStatus[status?.get(n.id) ?? real.status] += 1;
  }
  let observedEdges = 0;
  let modeledEdges = 0;
  for (const e of layout.edges) {
    if (renderedEdgeProvenance(e) === "MODELED") modeledEdges += 1;
    else observedEdges += 1;
  }
  const edgeTotal = observedEdges + modeledEdges;
  return {
    nodeTotal: layout.nodes.length,
    nodesByStatus,
    edgeTotal,
    observedEdges,
    modeledEdges,
    observedPerModeled: modeledEdges > 0 ? observedEdges / modeledEdges : 0,
    observedSharePct: edgeTotal > 0 ? (observedEdges / edgeTotal) * 100 : 0,
  };
}

export const FOREGROUND_TALLY: GraphTally = foregroundTallyFor(LAYOUT);

// The two base scopes this screen can be in, named once so the panel header
// and the on-canvas stats block use the same word for the same thing.
export const SCOPE_LABEL = {
  foreground: "EXPOSED PATH",
  full: "FULL NETWORK",
} as const;

/* ---- the scenario view ------------------------------------------------
   Everything the GRAPH screen draws for one scenario, in one object, so the
   header, the stats block and the canvas keep the no-disagreement property
   while the control moves. The default control returns the exact module
   constants above (same object identity); any other control derives the
   contamination path from the scenario's exposure set and origin.

   Exposure does not depend on duration (a longer hold does not discover new
   paths; see lib/derive/scenario.ts), so views cache on origin x severity:
   27 possible layouts, built on demand. */
export interface FlowView {
  /** Remount key for the canvas: changing it replays the sequence. */
  key: string;
  schedule: ContaminationSchedule;
  layout: FlowLayout;
  foregroundTally: GraphTally;
  fullTally: GraphTally;
  /** Scenario node statuses, undefined at the default (use GRAPH's own). */
  status: ReadonlyMap<string, Status> | null;
}

export const DEFAULT_FLOW_VIEW: FlowView = {
  key: "default",
  schedule: SCHEDULE,
  layout: LAYOUT,
  foregroundTally: FOREGROUND_TALLY,
  fullTally: FULL_TALLY,
  status: null,
};

const viewCache = new Map<string, FlowView>();

export function flowViewFor(control: ScenarioControlState): FlowView {
  if (isDefaultScenarioControl(control)) return DEFAULT_FLOW_VIEW;
  const key = `${control.originId}|${control.severity}`;
  const hit = viewCache.get(key);
  if (hit) return hit;
  const view = scenarioGraphView(control);
  const schedule = buildContaminationSchedule({
    originId: control.originId,
    status: view.status,
  });
  const layout = layoutFor(schedule);
  const built: FlowView = {
    key,
    schedule,
    layout,
    foregroundTally: foregroundTallyFor(layout, view.status),
    fullTally: graphTally(view.status),
    status: view.status,
  };
  viewCache.set(key, built);
  return built;
}

/** Guard hook (lib/derive/guards.ts): the scenario path at the default
 *  control, built WITHOUT the identity shortcut, so drift between the model
 *  and the scripted constants fails the build. */
export function computeDefaultFlowView(control: ScenarioControlState): {
  schedule: ContaminationSchedule;
  foregroundTally: GraphTally;
  fullTally: GraphTally;
} {
  const view = scenarioGraphView(control);
  const schedule = buildContaminationSchedule({
    originId: control.originId,
    status: view.status,
  });
  const layout = layoutFor(schedule);
  return {
    schedule,
    foregroundTally: foregroundTallyFor(layout, view.status),
    fullTally: graphTally(view.status),
  };
}

/* ---- the focused part -------------------------------------------------
   App-level focus (lib/focus) lands here as path MEMBERSHIP in the flow:
   the focused BOM line's node, the one supplier standing behind it, and the
   origin site, plus the two rendered edges linking them. Focus is a third
   state layered over whichever base scope (foreground / full network) the
   user is in: the path holds full weight on the canvas, everything else
   drops to context weight, and clearing focus returns to the untouched base
   scope. Nothing about the base view is recomputed.

   A BOM line's graph node is `G-${line.id}` (lib/data/graph.ts buildGraph;
   the same convention components/exposure/derive.ts and WorldMap already
   rely on). A line whose node is not in the schedule's tier1 set has no
   path in the CURRENT scenario's flow (only exposed, origin-reachable lines
   are drawn), so focusPathFor returns null and the caller degrades: base
   rendering intact, reason stated quietly, nothing drawn that the data
   does not support. */
export interface FocusPath {
  mpn: string;
  originId: string;
  supplierId: string;
  bomNodeId: string;
  /** Membership set for the canvas dim layer. An edge is on the path iff
   *  BOTH its endpoints are members (the flow only has adjacent-column
   *  edges, so this cannot capture a stray edge). */
  nodeIds: ReadonlySet<string>;
}

export function focusPathFor(view: FlowView, line: BomLine | null): FocusPath | null {
  if (!line) return null;
  const bomNodeId = `G-${line.id}`;
  const { schedule } = view;
  if (!schedule.tier1Ids.includes(bomNodeId)) return null;
  const supplierId = schedule.supplierOfBom.get(bomNodeId);
  if (!supplierId) return null;
  return {
    mpn: line.mpn,
    originId: schedule.originId,
    supplierId,
    bomNodeId,
    nodeIds: new Set([schedule.originId, supplierId, bomNodeId]),
  };
}

// Counted off the exact layout objects the renderer holds at full weight,
// same construction rule as foregroundTallyFor: no parallel re-derivation.
function focusTallyFor(view: FlowView, path: FocusPath): GraphTally {
  const filtered: FlowLayout = {
    ...view.layout,
    nodes: view.layout.nodes.filter((n) => path.nodeIds.has(n.id)),
    edges: view.layout.edges.filter(
      (e) => path.nodeIds.has(e.source) && path.nodeIds.has(e.target)
    ),
  };
  return foregroundTallyFor(filtered, view.status ?? undefined);
}

export type ScopeFocus =
  | { kind: "path"; mpn: string; tally: GraphTally }
  | { kind: "no-path"; mpn: string; reason: string };

/** Everything the header and the stats block say about the current scope,
 *  from ONE call. The page computes this once and hands it to the canvas,
 *  so the two surfaces cannot disagree; they are reading the same object. */
export interface ScopeView {
  scope: string;
  tally: GraphTally;
  /** Path membership for the canvas dim layer; null when nothing is
   *  focused OR the focused part has no path in this scenario's flow. */
  focusPath: FocusPath | null;
  /** What the focused state adds to the readouts; null when unfocused. */
  focus: ScopeFocus | null;
}

// The single tally path for this screen. The base scope's label and tally
// are untouched by focus (focus dims context, it does not change what is
// rendered), so with focusedPart null this returns exactly the pre-focus
// header and stats content.
export function tallyForScope(
  view: FlowView,
  fullNetwork: boolean,
  focusedPart: BomLine | null = null
): ScopeView {
  const scope = fullNetwork ? SCOPE_LABEL.full : SCOPE_LABEL.foreground;
  const tally = fullNetwork ? view.fullTally : view.foregroundTally;
  if (!focusedPart) return { scope, tally, focusPath: null, focus: null };
  const path = focusPathFor(view, focusedPart);
  if (!path) {
    return {
      scope,
      tally,
      focusPath: null,
      focus: {
        kind: "no-path",
        mpn: focusedPart.mpn,
        reason: "not on this scenario's contamination path",
      },
    };
  }
  return {
    scope,
    tally,
    focusPath: path,
    focus: { kind: "path", mpn: focusedPart.mpn, tally: focusTallyFor(view, path) },
  };
}
