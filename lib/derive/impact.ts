import type { BomLine } from "@/lib/types";
import {
  scenarioExposedLines as scenarioExposedLinesImpl,
  scenarioHalt as scenarioHaltImpl,
  type ScenarioHaltBreakdown,
} from "@/lib/derive/scenario";
import { BOM } from "@/lib/data/bom";
import { CUSTOMER } from "@/lib/data/customer";
import {
  type ScenarioControlState,
  DEFAULT_SCENARIO_CONTROL,
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
  halt: ScenarioHaltBreakdown;
}

export function deriveImpact(exposedLines: BomLine[]): DerivedImpact {
  const totalCount = BOM.length;
  const exposedCount = exposedLines.length;
  // Runway carries the default scenario's hold accounting (excess hold 0),
  // so the structural figures are unchanged and the breakdown fields exist.
  const halt = scenarioHaltImpl(exposedLines, DEFAULT_SCENARIO_CONTROL);
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

// ---- 4. the scenario model entry points -----------------------------------
//
// The old code here was a hop-budget BFS over the undirected GRAPH_ADJACENCY:
// severity set a base depth, every 15 days of duration added a hop, capped at
// 6. It is gone because it was structurally dishonest twice over. The walk
// crossed the customer node (adjacent to all 31 BOM lines) and the decorative
// density-padding edges, so a maxed control saturated to 31/31 and marked the
// domestic PCB fab as exposed by a Kaohsiung quarantine; and duration spent
// as REACH never touched the halt math, so DAYS TO HALT sat at 51 across
// every duration. The replacement model lives in lib/derive/scenario.ts:
// exposure is supply-path membership inside a severity-scaled radius, and
// duration extends the shipment hold, which consumes buffer, which sets the
// halt. See that module's header for the causal chain.

export {
  affectedRadius,
  scenarioExposedLines,
  scenarioHalt,
  scenarioGraphView,
  effectiveHoldDays,
  excessHoldDays,
  ABSORBABLE_HOLD_DAYS,
  SEVERITY_THROUGHPUT_LOSS,
  type AffectedRadius,
  type ScenarioHaltBreakdown,
  type ScenarioGraphView,
} from "@/lib/derive/scenario";

/** The single entry point the Impact panel (and every simulate consumer)
 *  calls. No default-value short-circuit anymore: the model is run for every
 *  control, INCLUDING the default, and lib/derive/guards.ts fails the build
 *  if the default run does not reproduce baselineImpact() exactly. The
 *  scripted figures are the model at its default input, not a special case
 *  the model is excused from. */
export function deriveScenarioImpact(control: ScenarioControlState): DerivedImpact {
  const exposed = scenarioExposedLinesImpl(BOM, control);
  const halt = scenarioHaltImpl(exposed, control);
  const totalCount = BOM.length;
  const exposedCount = exposed.length;
  const risk = buildAtRisk(exposedCount, totalCount);
  return {
    bomLinesExposed: exposedCount,
    bomLinesTotal: totalCount,
    buildAtRisk: risk,
    buildAtRiskLabel: buildAtRiskLabel(risk),
    daysToHalt: halt.daysToHalt,
    tier2Catches: exposed.filter((b) => b.tier === 2 && b.erpBlind).length,
    exposedLineIds: exposed.map((b) => b.id),
    halt,
  };
}
