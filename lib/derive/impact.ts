import type { BomLine } from "@/lib/types";
import { daysToHalt, type DaysToHaltBreakdown } from "@/lib/derive/halt";
import { BOM } from "@/lib/data/bom";
import { CUSTOMER } from "@/lib/data/customer";
import { GRAPH_ADJACENCY } from "@/lib/data/graph";
import {
  type ScenarioControlState,
  type ContainmentSeverity,
  isDefaultScenarioControl,
} from "@/lib/data/scenario";

/* ============================================================
   IMPACT DERIVATION: live math behind the RADAR Impact panel.

   Both buildAtRisk and daysToHalt were, until now, hardcoded constants in
   lib/data/event.ts with no visible derivation. This module replaces them
   with two auditable computations, plus the graph walk that lets the new
   scenario control (lib/data/scenario.ts) recompute all four Impact figures
   live against a hypothetical origin/severity/duration instead of the
   scripted BOM.status field.
   ============================================================ */

// ---- 1. buildAtRisk -----------------------------------------
//
// FORMULA:  buildAtRisk = CUSTOMER.focusProduct.quarterlyBuildValue
//                          × (exposedLines.length / BOM.length)
//
// What it represents: the slice of this quarter's $6.1M MD-7200 build value
// that is exposed, on the assumption that build value is spread evenly
// across the BOM's 31 lines (no single line dominates the unit's cost
// structure enough to justify a per-line weighting; see the BOM, where the
// priciest exposed line, BOM-01 at $28.40, is under 2% of a per-unit build
// value of ~$1,452). A unit cannot ship without EVERY line on its BOM, so
// "the build value exposed" is naturally the exposed line-fraction of the
// $6.1M total, the same 14/31 fraction already drawn as the EXPOSURE MAP
// segmented bar, just applied to dollars instead of segments.
//
// Baseline: 14 exposed / 31 total × $6,100,000 = $2,754,839 ≈ $2.8M
// (vs. today's hardcoded $2.6M, same order of magnitude, same story: a
// bit under half the quarter's build value is exposed).

export function buildAtRisk(exposedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return CUSTOMER.focusProduct.quarterlyBuildValue * (exposedCount / totalCount);
}

export function buildAtRiskLabel(n: number): string {
  return `$${(n / 1_000_000).toFixed(1)}M`;
}

// ---- 2. daysToHalt --------------------------------------------------------
//
// No on-hand-inventory/coverage field exists anywhere in the data layer
// (grepped BOM/customer/actions for "coverage"/"onHand"/"inventory"; the only
// hits are prose). So days-to-halt is derived from the most lead-time-
// constrained EXPOSED line, the same "Longest Pole" concept
// LeadTimePressure.tsx already surfaces, combined with a stated buffer
// assumption.
//
// The math itself now lives in lib/derive/halt.ts, which imports nothing but
// the BomLine type. That is what lets lib/data/event.ts derive
// IMPACT.daysToHalt instead of restating it as a literal: event.ts cannot
// import this module without creating the cycle
// event -> impact -> scenario -> event. See the header of halt.ts.
//
// Re-exported here so every existing import site keeps working unchanged.

export {
  BUFFER_WEEKS,
  BASELINE_LEAD_TIME_WEEKS,
  EROSION_DAYS_PER_OVERRUN_WEEK,
  BUFFER_DAYS,
  daysToHalt,
  recoveredDaysToHalt,
} from "@/lib/derive/halt";
export type { DaysToHaltBreakdown } from "@/lib/derive/halt";

// ---- 3. shared derived-impact shape ---------------------------------------
//
// A superset of the existing `Impact` type (lib/types.ts): every field
// Impact already declares is present with the same meaning, plus the
// breakdown fields the panel renders so the numbers are auditable on
// screen, not just in code comments. See the proposed lib/types.ts diff in
// the final report for promoting the breakdown fields into the shared type.

export interface DerivedImpact {
  bomLinesExposed: number;
  bomLinesTotal: number;
  buildAtRisk: number;
  buildAtRiskLabel: string;
  daysToHalt: number;
  tier2Catches: number;
  exposedLineIds: string[];
  halt: DaysToHaltBreakdown;
}

export function deriveImpact(exposedLines: BomLine[]): DerivedImpact {
  const totalCount = BOM.length;
  const exposedCount = exposedLines.length;
  const halt = daysToHalt(exposedLines);
  const risk = buildAtRisk(exposedCount, totalCount);
  return {
    bomLinesExposed: exposedCount,
    bomLinesTotal: totalCount,
    buildAtRisk: risk,
    buildAtRiskLabel: buildAtRiskLabel(risk),
    daysToHalt: halt.daysToHalt,
    tier2Catches: exposedLines.filter((b) => b.tier === 2 && b.erpBlind).length,
    exposedLineIds: exposedLines.map((b) => b.id),
    halt,
  };
}

/** The scripted baseline: today's hardcoded Kaohsiung quarantine, read
 *  straight off BOM.status (matches lib/data/event.ts IMPACT exactly). */
export function baselineImpact(): DerivedImpact {
  return deriveImpact(BOM.filter((b) => b.status === "EXPOSED"));
}

// ---- 4. the graph walk for the interactive control ------------------------
//
// Depth budget: containment severity sets a base hop count, and every
// DURATION_HOP_DAYS of selected duration adds one more hop, because a longer-
// running disruption has had more time to propagate outward through
// GRAPH_ADJACENCY. Capped at MAX_DEPTH so a maxed-out control (CRITICAL +
// 90 days) is a deliberate "everything is touched" extreme, not an
// unbounded walk.
const SEVERITY_BASE_DEPTH: Record<ContainmentSeverity, number> = {
  CONTAINED: 1,
  ESCALATING: 2,
  CRITICAL: 3,
};
const DURATION_HOP_DAYS = 15;
const MAX_DEPTH = 6;

function containmentDepth(severity: ContainmentSeverity, durationDays: number): number {
  const extra = Math.floor(durationDays / DURATION_HOP_DAYS);
  return Math.min(MAX_DEPTH, SEVERITY_BASE_DEPTH[severity] + extra);
}

/** BFS over GRAPH_ADJACENCY from `originId`, `maxDepth` hops out (undirected
 *  and is the same adjacency the graph screen's contamination BFS uses). */
function bfsReachable(originId: string, maxDepth: number): Set<string> {
  const visited = new Set<string>([originId]);
  let frontier = [originId];
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of GRAPH_ADJACENCY[id] ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

/** BOM lines reachable from the control's origin within its containment
 *  depth. Graph BOM-node ids are `G-${BomLine.id}` (see lib/data/graph.ts
 *  buildGraph), so strip the `G-` prefix to recover the BOM line id. */
export function reachableBomLines(control: ScenarioControlState): BomLine[] {
  const depth = containmentDepth(control.severity, control.durationDays);
  const reached = bfsReachable(control.originId, depth);
  const ids = new Set(
    [...reached].filter((id) => id.startsWith("G-BOM-")).map((id) => id.slice(2))
  );
  return BOM.filter((b) => ids.has(b.id));
}

/** The single entry point the ImpactSummary panel calls. At the control's
 *  default value this is IDENTICAL to baselineImpact() (short-circuited,
 *  not merely coincidentally equal). Reset is just setting the control
 *  back to DEFAULT_SCENARIO_CONTROL. Any other value runs the live graph
 *  walk above. */
export function deriveScenarioImpact(control: ScenarioControlState): DerivedImpact {
  if (isDefaultScenarioControl(control)) return baselineImpact();
  return deriveImpact(reachableBomLines(control));
}
