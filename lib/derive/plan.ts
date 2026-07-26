import type { Action, BomLine } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { ACTIONS } from "@/lib/data/actions";
import {
  type ScenarioControlState,
  DEFAULT_SCENARIO_CONTROL,
} from "@/lib/data/scenario";
import {
  affectedRadius,
  scenarioStatus,
  scenarioHalt,
  effectiveHoldDays,
  excessHoldDays,
  type ScenarioHaltBreakdown,
} from "@/lib/derive/scenario";
import { recoveredDaysToHalt, BUFFER_DAYS } from "@/lib/derive/halt";
import { money } from "@/components/resolve/rollup";

/* ============================================================
   THE RESOLUTION PLAN: what the four authored actions are worth under a
   given scenario, derived instead of restated.

   Until now RESOLVE proposed the same four actions with the same day counts
   regardless of scenario, because every figure was authored against the one
   scripted event. This module keeps the authored actions as the CATALOG
   (what Meridian could do) and derives everything scenario-shaped:

     - which lines each action covers is the intersection of its authored
       coverage with the scenario's exposed set (compliance is its own axis
       and does not move with logistics scenarios)
     - AIR FREIGHT is a one-time rescue of finished goods already fabbed at
       the backend: one sea-transit pipeline of stock, 27 days, and never
       more, however long the quarantine runs
     - INVENTORY POSITION buys forward channel coverage sized to the hold
       the scenario actually imposes, capped at the 11 weeks of depth the
       channel holds, with capital scaling in proportion
     - QUALIFIED ALTERNATE structurally escapes the zone: its worth grows
       one for one with the excess hold, because the escaped source does
       not feel the quarantine at all
     - LICENSE PAPERWORK is driven by the ownership rule, not by the
       quarantine, and is deliberately duration-independent

   Every derived figure reproduces the authored one at the default control;
   lib/derive/guards.ts fails the build otherwise.
   ============================================================ */

// ---- calibration constants -------------------------------------------------

/** Sea transit the air reroute collapses (31 days to 4). Also the depth of
 *  the finished-goods pool at the backend: what is sitting there is one
 *  transit pipeline's worth of production, so the rescue is worth the
 *  transit delta once and cannot be repeated. */
export const SEA_TRANSIT_DAYS = 31;
export const AIR_TRANSIT_DAYS = 4;
export const AIR_FREIGHT_GAIN_DAYS = SEA_TRANSIT_DAYS - AIR_TRANSIT_DAYS; // 27

/** Requalification path for the alternate: 3 weeks (IEC 61800-5-1). */
export const REQUAL_DAYS = 3 * 7;

/** Forward-coverage sizing: the position covers the scenario's hold plus
 *  one restock margin (the 32 days that separate the authored 11-week
 *  position from the scripted 45-day hold: sea transit plus processing).
 *  The channel holds 11 weeks of depth; demand beyond that is flagged as
 *  capped, not silently filled. */
export const RESTOCK_MARGIN_DAYS = 32;
export const CHANNEL_DEPTH_WEEKS = 11;
export const CAPITAL_PER_COVERAGE_WEEK = 310_000 / CHANNEL_DEPTH_WEEKS;

/** Authored freight cost for the full six-line, 4,200-unit lift. Scales
 *  with how many covered lines the scenario actually exposes. */
export const AIR_FREIGHT_FULL_COST = 18_400;
const AIR_FREIGHT_FULL_LINES = 6;

/** Alternate unit-cost delta: +$0.42 on the gate driver, 6 per unit,
 *  4,200 units. Charged only when the gate-drive cluster is exposed. */
export const ALT_UNIT_DELTA = 0.42;
export const ALT_UNITS = 4_200;

export type Sufficiency =
  | "SUFFICIENT_ALONE"
  | "ADDITIONAL_COVERAGE"
  | "COMPLIANCE_AXIS";

export interface PlannedAction {
  action: Action;
  /** Lines this action recovers UNDER THIS SCENARIO. */
  covers: BomLine[];
  recovers: number;
  /** False when the scenario exposes none of the action's lines: the
   *  resolver has nothing for this action to do and does not propose it. */
  active: boolean;
  daysGained: number;
  incrementalCost: number;
  capital: number;
  scheduleWeeks: number;
  /** BUY_AHEAD only: the coverage the scenario demands, in weeks. */
  coverageWeeks: number | null;
  /** BUY_AHEAD only: demand exceeded channel depth and was capped. */
  coverageCapped: boolean;
  sufficiency: Sufficiency;
}

export interface ScenarioPlan {
  control: ScenarioControlState;
  halt: ScenarioHaltBreakdown;
  exposed: BomLine[];
  observedExposed: BomLine[];
  modeledExposed: BomLine[];
  complianceLines: BomLine[];
  /** observedExposed + compliance: what actions can actually resolve. */
  observedResolvable: number;
  linesRequiringAction: number;
  actions: PlannedAction[];
  /** Actions the resolver proposes (active only). */
  proposed: PlannedAction[];
  /** Sum of proposed logistics day gains. */
  totalDaysGained: number;
  /** The gap the plan has to close: buffer days consumed by the scenario. */
  gapDays: number;
  /** Whether the full proposed set closes the gap. False is a real state
   *  and the product says so instead of manufacturing a plan. */
  planCloses: boolean;
}

const BY_ID = new Map(BOM.map((b) => [b.id, b]));

function coveredUnder(action: Action, exposedIds: ReadonlySet<string>): BomLine[] {
  if (action.kind === "LICENSE") {
    // Compliance axis: ownership-FLAGGED lines, untouched by the quarantine
    // scenario. The rule attaches on its own schedule.
    return action.covers
      .map((id) => BY_ID.get(id))
      .filter((b): b is BomLine => Boolean(b));
  }
  return action.covers
    .map((id) => BY_ID.get(id))
    .filter((b): b is BomLine => Boolean(b) && exposedIds.has(b!.id));
}

export function scenarioPlan(control: ScenarioControlState): ScenarioPlan {
  const radius = affectedRadius(control.originId, control.severity);
  const exposed = BOM.filter((b) => scenarioStatus(b, radius) === "EXPOSED");
  const exposedIds = new Set(exposed.map((b) => b.id));
  const observedExposed = exposed.filter((b) => b.provenance === "OBSERVED");
  const modeledExposed = exposed.filter((b) => b.provenance === "MODELED");
  const complianceLines = BOM.filter(
    (b) => b.ownership === "FLAGGED" && !exposedIds.has(b.id)
  );
  const halt = scenarioHalt(exposed, control);
  const hold = effectiveHoldDays(control.severity, control.durationDays);
  const excess = exposed.length > 0 ? excessHoldDays(control.severity, control.durationDays) : 0;
  const gapDays = halt.bufferConsumedDays;

  const actions: PlannedAction[] = ACTIONS.map((action) => {
    const covers = coveredUnder(action, exposedIds);
    const active = covers.length > 0;
    let daysGained = 0;
    let incrementalCost = 0;
    let capital = 0;
    let scheduleWeeks = 0;
    let coverageWeeks: number | null = null;
    let coverageCapped = false;

    if (active && action.kind === "EXPEDITE") {
      // One-time rescue of the finished-goods pool: worth the sea/air delta
      // once, regardless of how long the quarantine runs. Freight cost
      // scales with the lines actually lifted.
      daysGained = AIR_FREIGHT_GAIN_DAYS;
      incrementalCost = Math.round(
        (AIR_FREIGHT_FULL_COST * covers.length) / AIR_FREIGHT_FULL_LINES
      );
    } else if (active && action.kind === "SUBSTITUTE") {
      // The structural escape: a 3-week qualification buys a source the
      // quarantine cannot touch, so its worth grows one for one with the
      // excess hold. At the default scenario that is the authored 21 days.
      daysGained = REQUAL_DAYS + excess;
      scheduleWeeks = 3;
      const driver = covers.find((b) => b.id === "BOM-07");
      incrementalCost = driver
        ? Math.round(ALT_UNIT_DELTA * driver.qtyPerUnit * ALT_UNITS)
        : 0;
    } else if (active && action.kind === "BUY_AHEAD") {
      // Forward coverage sized to the hold, capped at channel depth.
      const demandedWeeks = Math.ceil((hold + RESTOCK_MARGIN_DAYS) / 7);
      coverageCapped = demandedWeeks > CHANNEL_DEPTH_WEEKS;
      coverageWeeks = Math.min(demandedWeeks, CHANNEL_DEPTH_WEEKS);
      daysGained = coverageWeeks * 7;
      capital = Math.round(coverageWeeks * CAPITAL_PER_COVERAGE_WEEK);
    }

    return {
      action,
      covers,
      recovers: covers.length,
      active: action.kind === "LICENSE" ? covers.length > 0 : active,
      daysGained,
      incrementalCost,
      capital,
      scheduleWeeks,
      coverageWeeks,
      coverageCapped,
      sufficiency: "ADDITIONAL_COVERAGE" as Sufficiency,
    };
  });

  // Sufficiency: an action is sufficient on its own when its day gain alone
  // covers everything the scenario has consumed. Compliance sits on its own
  // axis and is never scored against the logistics gap.
  for (const a of actions) {
    if (a.action.kind === "LICENSE") {
      a.sufficiency = "COMPLIANCE_AXIS";
    } else if (a.active && a.daysGained >= gapDays && gapDays > 0) {
      a.sufficiency = "SUFFICIENT_ALONE";
    } else {
      a.sufficiency = "ADDITIONAL_COVERAGE";
    }
  }

  const proposed = actions.filter((a) => a.active);
  const totalDaysGained = proposed
    .filter((a) => a.action.kind !== "LICENSE")
    .reduce((n, a) => n + a.daysGained, 0);
  const planCloses = exposed.length === 0 || totalDaysGained >= gapDays;

  return {
    control,
    halt,
    exposed,
    observedExposed,
    modeledExposed,
    complianceLines,
    observedResolvable: observedExposed.length + complianceLines.length,
    linesRequiringAction: exposed.length + complianceLines.length,
    actions,
    proposed,
    totalDaysGained,
    gapDays,
    planCloses,
  };
}

/** Projected runway once a set of actioned ids has fired, under the plan's
 *  scenario. Same recovery cap as ever: actions restore routes, they do not
 *  manufacture inventory, so the projection never exceeds the buffer. */
export function projectedDays(plan: ScenarioPlan, actionedIds: ReadonlySet<string>): number {
  const gained = plan.proposed
    .filter((a) => a.action.kind !== "LICENSE" && actionedIds.has(a.action.id))
    .reduce((n, a) => n + a.daysGained, 0);
  return recoveredDaysToHalt(plan.halt.daysToHalt, gained);
}

export const DEFAULT_PLAN: ScenarioPlan = scenarioPlan(DEFAULT_SCENARIO_CONTROL);

/** True when the buffer cap will bind for this actioned set. */
export function capBinds(plan: ScenarioPlan, actionedIds: ReadonlySet<string>): boolean {
  const gained = plan.proposed
    .filter((a) => a.action.kind !== "LICENSE" && actionedIds.has(a.action.id))
    .reduce((n, a) => n + a.daysGained, 0);
  return plan.halt.daysToHalt + gained > BUFFER_DAYS;
}

/** The authored metric strip with the scenario-derived figures patched in
 *  (freight cost, coverage weeks, capital). Shared by the action card, the
 *  document modal and the PDF so the three cannot disagree. At the default
 *  scenario every patched string equals the authored one byte for byte. */
export function scenarioMetricsFor(planned: PlannedAction): Action["metrics"] {
  const action = planned.action;
  return action.metrics.map((m) => {
    if (action.kind === "EXPEDITE" && m.label === "INCREMENTAL COST") {
      return { ...m, value: money(planned.incrementalCost) };
    }
    if (action.kind === "BUY_AHEAD" && m.label === "RECOMMENDED BUY" && planned.coverageWeeks) {
      return {
        ...m,
        value: `${planned.coverageWeeks} WEEKS COVERAGE`,
        note: planned.coverageCapped ? "CHANNEL DEPTH CAP" : m.note,
      };
    }
    if (action.kind === "BUY_AHEAD" && m.label === "CAPITAL REQUIRED") {
      return { ...m, value: money(planned.capital) };
    }
    return m;
  });
}

/** What the RESOLVE documents need to know about the scenario: the covered
 *  lines, the patched metrics, and the resolvable totals. */
export interface DocScope {
  lines: BomLine[];
  metrics: Action["metrics"];
  recovers: number;
  observedTotal: number;
}

export function docScopeFor(plan: ScenarioPlan, actionId: string): DocScope | null {
  const planned = plan.actions.find((a) => a.action.id === actionId);
  if (!planned) return null;
  return {
    lines: planned.covers,
    metrics: scenarioMetricsFor(planned),
    recovers: planned.recovers,
    observedTotal: plan.observedExposed.length,
  };
}
