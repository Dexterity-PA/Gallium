import type { Scenario } from "@/lib/types";
import { CUSTOMER } from "@/lib/data/customer";
import { PRIMARY_EVENT } from "@/lib/data/event";
import { QUARANTINE_ZONE, SITES } from "@/lib/data/sites";
import { GRAPH, PROPAGATION_ORIGIN_ID } from "@/lib/data/graph";

// The single source of truth for the scripted scenario. Facts that were
// scattered across customer / event / sites / demo are composed here so a
// live-data swap or a re-theming touches one definition, not five.
//
// FICTIONAL by construction (`fictional: true`). The demo labels it as such on
// screen; never present this as a real event.
export const SCENARIO: Scenario = {
  id: "SCN-KHH-2026-0722",
  fictional: true,
  title: "Kaohsiung maritime quarantine: MD-7200 exposure",
  // Matches DEMO_EPOCH_MS in lib/demo.ts (2026-07-22 14:32:07 UTC): 9s after
  // the primary event, so the demo freezes on a just-detected alert.
  asOf: "2026-07-22T14:32:07Z",
  customerName: CUSTOMER.name,
  focusProduct: `${CUSTOMER.focusProduct.line} · ${CUSTOMER.focusProduct.description}`,
  primaryEventId: PRIMARY_EVENT.id,
  zone: {
    lat: PRIMARY_EVENT.zone.lat,
    lng: PRIMARY_EVENT.zone.lng,
    radiusKm: PRIMARY_EVENT.zone.radiusKm,
    polygon: QUARANTINE_ZONE,
  },
  // Affiliates-screening 50% rule resumes (independent compliance axis).
  complianceRuleEffective: "2026-11-10",
  summary:
    "A PRC customs inspection regime halts outbound container traffic at " +
    "Kaohsiung. Air corridors are unaffected. The shock propagates through " +
    "the MD-7200 bill of materials via backend assembly & test and " +
    "distribution routing inside the zone, exposure most ERP-based tools " +
    "cannot see. A separate affiliates-screening rule resumes Nov 10 2026.",
};

/* ============================================================
   INTERACTIVE SCENARIO CONTROL: "what if" exploration layer.

   SCENARIO/PRIMARY_EVENT/IMPACT above stay exactly as scripted: the fixed,
   already-happened Kaohsiung quarantine the demo narrates. Everything below
   is a SEPARATE, adjustable control that lets the RADAR panel re-run the
   same live derivation (lib/derive/impact.ts) against a different origin
   node, containment severity, and disruption duration, walking outward
   through GRAPH_ADJACENCY from a chosen origin rather than reading the
   BOM's hardcoded `status` field. It proves the impact numbers are a live
   computation over the graph, not a picture.

   The control's DEFAULT value is defined to mean "no override": when the
   control is at its default, lib/derive/impact.ts short-circuits back to
   the scripted baseline (BOM.filter(status === "EXPOSED"), i.e. today's
   IMPACT) instead of running the graph walk. Reset just restores this
   default, so the historical Kaohsiung figures are always one click away
   and are never a special-cased duplicate of the walk logic.
   ============================================================ */

/** Containment severity: how far a disruption is treated as reaching through
 *  the network, expressed as a BFS hop budget over GRAPH_ADJACENCY. */
export type ContainmentSeverity = "CONTAINED" | "ESCALATING" | "CRITICAL";

export const SEVERITY_OPTIONS: { value: ContainmentSeverity; label: string }[] = [
  { value: "CONTAINED", label: "CONTAINED" },
  { value: "ESCALATING", label: "ESCALATING" },
  { value: "CRITICAL", label: "CRITICAL" },
];

/** Selectable disruption duration, in days. Longer duration = more time for
 *  the shock to propagate outward, so it adds BFS hops (see
 *  lib/derive/impact.ts DURATION_HOP_DAYS). */
export const DURATION_OPTIONS_DAYS: number[] = [7, 14, 30, 60, 90];

export interface ScenarioControlState {
  originId: string;
  severity: ContainmentSeverity;
  durationDays: number;
}

/** The control's neutral/unset position. lib/derive/impact.ts treats this
 *  exact value as "show the scripted baseline". See deriveScenarioImpact. */
export const DEFAULT_SCENARIO_CONTROL: ScenarioControlState = {
  originId: PROPAGATION_ORIGIN_ID,
  severity: "CRITICAL",
  durationDays: 30,
};

export function isDefaultScenarioControl(s: ScenarioControlState): boolean {
  return (
    s.originId === DEFAULT_SCENARIO_CONTROL.originId &&
    s.severity === DEFAULT_SCENARIO_CONTROL.severity &&
    s.durationDays === DEFAULT_SCENARIO_CONTROL.durationDays
  );
}

/** Selectable origin nodes for the control: the map/graph sites (lib/data/
 *  sites.ts) that also exist as nodes in GRAPH (lib/data/graph.ts), so any
 *  choice is guaranteed to have adjacency to walk from. Excludes the
 *  customer site (NODE-ROC), which is the destination, not a shock origin. */
const GRAPH_NODE_IDS = new Set(GRAPH.nodes.map((n) => n.id));
export const ORIGIN_OPTIONS: { id: string; label: string }[] = SITES.filter(
  (s) => !s.isCustomer && GRAPH_NODE_IDS.has(s.id)
).map((s) => ({ id: s.id, label: s.label }));
