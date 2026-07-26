import { BOM } from "@/lib/data/bom";
import { GRAPH, EXPOSED_PATH_NODE_IDS } from "@/lib/data/graph";
import {
  ORIGIN_OPTIONS,
  SEVERITY_OPTIONS,
  DURATION_OPTIONS_DAYS,
  DEFAULT_SCENARIO_CONTROL,
  type ScenarioControlState,
  type ContainmentSeverity,
} from "@/lib/data/scenario";
import { deriveScenarioImpact, baselineImpact } from "@/lib/derive/impact";
import { scenarioGraphView } from "@/lib/derive/scenario";
import { scenarioPlan, projectedDays } from "@/lib/derive/plan";
import { BUFFER_DAYS } from "@/lib/derive/halt";
import { PORTFOLIO, computePortfolioFor, rollup, riskLabel } from "@/lib/data/portfolio";
import {
  SCHEDULE,
  FOREGROUND_TALLY,
  FULL_TALLY,
  computeDefaultFlowView,
} from "@/components/graph/flowModel";

/* ============================================================
   SCENARIO INVARIANT GUARDS. Module-load, like every other guard in this
   codebase: drift fails the build, not the demo.

   The old guards pinned fixed values. A dynamic model needs INVARIANT
   guards, exercised across the full cross product of affected node (9),
   severity (3) and duration (5): 135 scenarios, every one of them run
   through the same deriveScenarioImpact / scenarioPlan / portfolio the
   screens read.

   What must hold:

     1. PINNED DEFAULT. At Kaohsiung backend A&T, CRITICAL, 30D, the model
        reproduces the scripted build exactly: RADAR (14/31, $2.8M, 51D),
        RESOLVE (13 recovered, $28,984, $310,000, +3 weeks, 70D capped),
        PORTFOLIO (7 products, 230 lines, 45 exposed, $6.3M of $26.2M),
        GRAPH (25N/24E exposed path, 90N/162E full network), and the
        16-line reconciliation (11 observed + 3 modeled + 2 compliance).
     2. MONOTONIC IN DURATION. Exposure, value at risk and buffer consumed
        never decrease with duration; days to halt never increases.
     3. MONOTONIC IN SEVERITY. Same, CONTAINED -> ESCALATING -> CRITICAL.
     4. SUPPLY PATHS RESPECTED. A line whose supply path never touches the
        affected radius is never exposed. The domestic PCB fab (BOM-23),
        the US heatsink (BOM-24) and the Malaysian connector (BOM-26) stay
        CLEAR at every scenario including 90D CRITICAL.
     5. NO SATURATION. 31/31 is unreachable because lines without a
        resolved path cannot be claimed; the exposure count is asserted
        against the authored path data, not a ceiling.
     6. DAYS TO HALT BOUNDED to [0, 70]; RECOVERY BOUNDED to 70 at every
        scenario; the plan's closes/does-not-close verdict is arithmetic,
        never asserted.
     7. PORTFOLIO ROLLUP equals the sum over rendered rows at EVERY
        scenario, and the graph view's exposed BOM nodes equal the
        impact's exposed lines at every scenario.
   ============================================================ */

const SEVERITIES: ContainmentSeverity[] = SEVERITY_OPTIONS.map((s) => s.value);

function fail(msg: string): never {
  throw new Error(`SCENARIO GUARD: ${msg}`);
}

function assertEq(actual: unknown, expected: unknown, what: string): void {
  if (actual !== expected) fail(`${what}: expected ${expected}, got ${actual}`);
}

export const SCENARIO_GUARDS_OK = (() => {
  // ---- 1. the pinned default ---------------------------------------------
  const def = DEFAULT_SCENARIO_CONTROL;
  const impact = deriveScenarioImpact(def);
  const base = baselineImpact();
  if (JSON.stringify(impact) !== JSON.stringify(base)) {
    fail("the model at the default control does not reproduce the scripted baseline");
  }
  assertEq(impact.bomLinesExposed, 14, "default exposed lines");
  assertEq(impact.bomLinesTotal, 31, "default BOM total");
  assertEq(impact.buildAtRiskLabel, "$2.8M", "default value at risk");
  assertEq(impact.daysToHalt, 51, "default days to halt");
  assertEq(impact.tier2Catches, 3, "default tier-2 catches");
  assertEq(impact.halt.excessHoldDays, 0, "default excess hold");
  assertEq(impact.halt.holdDays, 45, "default effective hold");

  const plan = scenarioPlan(def);
  assertEq(plan.observedExposed.length, 11, "default observed exposed");
  assertEq(plan.modeledExposed.length, 3, "default modeled exposed");
  assertEq(plan.complianceLines.length, 2, "default compliance lines");
  assertEq(plan.observedResolvable, 13, "default observed resolvable");
  assertEq(plan.linesRequiringAction, 16, "default lines requiring action");
  const byKind = new Map(plan.actions.map((a) => [a.action.kind, a]));
  const air = byKind.get("EXPEDITE")!;
  const alt = byKind.get("SUBSTITUTE")!;
  const buy = byKind.get("BUY_AHEAD")!;
  const lic = byKind.get("LICENSE")!;
  assertEq(air.recovers, 6, "default AIR coverage");
  assertEq(air.daysGained, 27, "default AIR days gained");
  assertEq(air.incrementalCost, 18_400, "default AIR incremental cost");
  assertEq(alt.recovers, 3, "default ALT coverage");
  assertEq(alt.daysGained, 21, "default ALT days gained");
  assertEq(alt.incrementalCost, 10_584, "default ALT unit-delta cost");
  assertEq(alt.scheduleWeeks, 3, "default ALT schedule weeks");
  assertEq(buy.recovers, 2, "default BUY coverage");
  assertEq(buy.daysGained, 77, "default BUY days gained");
  assertEq(buy.capital, 310_000, "default BUY capital");
  assertEq(buy.coverageWeeks, 11, "default BUY coverage weeks");
  assertEq(buy.coverageCapped, false, "default BUY cap flag");
  assertEq(lic.recovers, 2, "default LICENSE coverage");
  assertEq(
    plan.actions.reduce((n, a) => n + a.recovers, 0),
    13,
    "default total recovered"
  );
  assertEq(
    air.incrementalCost + alt.incrementalCost,
    28_984,
    "default total incremental cost"
  );
  const allIds = new Set(plan.actions.map((a) => a.action.id));
  assertEq(projectedDays(plan, allIds), 70, "default full-set projected runway (cap)");
  if (!plan.planCloses) fail("default plan must close its own gap");

  const rows = computePortfolioFor(def);
  if (JSON.stringify(rows) !== JSON.stringify(PORTFOLIO)) {
    fail("computePortfolioFor(default) does not reproduce PORTFOLIO");
  }
  const totals = rollup(rows);
  assertEq(totals.products, 7, "default portfolio products");
  assertEq(totals.bomLines, 230, "default portfolio BOM lines");
  assertEq(totals.exposedLines, 45, "default portfolio exposed lines");
  assertEq(riskLabel(totals.revenueAtRisk), "$6.3M", "default portfolio value at risk");
  assertEq(riskLabel(totals.quarterlyBuildValue), "$26.2M", "default portfolio build");

  const view = scenarioGraphView(def);
  for (const n of GRAPH.nodes) {
    if (view.status.get(n.id) !== n.status) {
      fail(`default graph status for ${n.id}: model says ${view.status.get(n.id)}, graph says ${n.status}`);
    }
  }
  if (view.exposedPathIds.join(",") !== EXPOSED_PATH_NODE_IDS.join(",")) {
    fail("default exposed path ids do not reproduce EXPOSED_PATH_NODE_IDS");
  }

  const flow = computeDefaultFlowView(def);
  assertEq(flow.foregroundTally.nodeTotal, 25, "default exposed-path node count");
  assertEq(flow.foregroundTally.edgeTotal, 24, "default exposed-path edge count");
  assertEq(flow.fullTally.nodeTotal, 90, "default full-network node count");
  assertEq(flow.fullTally.edgeTotal, 162, "default full-network edge count");
  if (
    flow.schedule.tier1Ids.join(",") !== SCHEDULE.tier1Ids.join(",") ||
    flow.schedule.tier2Ids.join(",") !== SCHEDULE.tier2Ids.join(",") ||
    flow.schedule.headerLabel !== SCHEDULE.headerLabel
  ) {
    fail("default contamination schedule does not reproduce the scripted one");
  }
  assertEq(FOREGROUND_TALLY.nodeTotal, 25, "scripted foreground node count");
  assertEq(FULL_TALLY.edgeTotal, 162, "scripted full edge count");

  // ---- 2..7. the cross product -------------------------------------------
  const NEVER_EXPOSED = ["BOM-23", "BOM-24", "BOM-25", "BOM-26"];
  const pathless = new Set(
    BOM.filter((b) => !b.supplyPath || b.supplyPath.length === 0).map((b) => b.id)
  );
  // Independent ceiling for the no-saturation check: only lines with a
  // resolved supply path can EVER be exposed, whatever the radius does.
  const maxExposable = BOM.length - pathless.size;
  if (maxExposable >= BOM.length) fail("every line has a path; saturation ceiling is meaningless");

  // Authored-flag cross-check for the quarantine corridor: at Kaohsiung
  // CRITICAL the model's exposure must equal the AUTHORED in-zone path set
  // (the inQuarantineZone flags), an independent encoding of the same fact.
  const authoredZoneIds = BOM.filter((b) =>
    (b.supplyPath ?? []).some((s) => s.inQuarantineZone)
  )
    .map((b) => b.id)
    .join(",");

  const cell = (originId: string, severity: ContainmentSeverity, durationDays: number) => {
    const control: ScenarioControlState = { originId, severity, durationDays };
    const i = deriveScenarioImpact(control);
    const p = scenarioPlan(control);
    const g = scenarioGraphView(control);
    const label = `${originId}/${severity}/${durationDays}D`;

    // bounds
    if (i.daysToHalt < 0 || i.daysToHalt > BUFFER_DAYS) {
      fail(`${label}: days to halt ${i.daysToHalt} outside [0, ${BUFFER_DAYS}]`);
    }
    if (i.halt.bufferConsumedDays < 0) fail(`${label}: negative buffer consumption`);

    // supply paths respected + no saturation
    for (const id of i.exposedLineIds) {
      if (pathless.has(id)) fail(`${label}: ${id} exposed without a resolved supply path`);
    }
    for (const id of NEVER_EXPOSED) {
      if (i.exposedLineIds.includes(id)) {
        fail(`${label}: ${id} (domestic/out-of-zone) marked exposed`);
      }
    }
    if (i.bomLinesExposed > maxExposable) {
      fail(`${label}: exposure ${i.bomLinesExposed} exceeds the path-backed ceiling ${maxExposable}`);
    }
    if (originId === "NODE-KHH-ASE" && severity === "CRITICAL") {
      if (i.exposedLineIds.join(",") !== authoredZoneIds) {
        fail(`${label}: corridor exposure does not equal the authored in-zone path set`);
      }
    }

    // recovery bounded
    const ids = new Set(p.actions.map((a) => a.action.id));
    const projected = projectedDays(p, ids);
    if (projected > BUFFER_DAYS) fail(`${label}: projected runway ${projected} exceeds the buffer`);

    // the plan's verdict is arithmetic
    const gains = p.proposed
      .filter((a) => a.action.kind !== "LICENSE")
      .reduce((n, a) => n + a.daysGained, 0);
    const closes = p.exposed.length === 0 || gains >= p.gapDays;
    if (closes !== p.planCloses) fail(`${label}: planCloses disagrees with its own arithmetic`);

    // graph view consistency with the impact derivation
    if (g.exposedBomNodeIds.length !== i.bomLinesExposed) {
      fail(`${label}: graph exposed BOM nodes (${g.exposedBomNodeIds.length}) != impact (${i.bomLinesExposed})`);
    }

    // portfolio rollup equals the sum over rendered rows
    const r = computePortfolioFor(control);
    const t = rollup(r);
    const sum = (pick: (x: (typeof r)[number]) => number) => r.reduce((n, x) => n + pick(x), 0);
    if (
      t.products !== r.length ||
      t.bomLines !== sum((x) => x.bomLines) ||
      t.exposedLines !== sum((x) => x.exposedLines) ||
      Math.abs(t.revenueAtRisk - sum((x) => x.revenueAtRisk)) > 1
    ) {
      fail(`${label}: portfolio rollup does not equal the sum over its rows`);
    }

    return i;
  };

  let cells = 0;
  for (const origin of ORIGIN_OPTIONS) {
    // monotone in duration, per severity
    for (const severity of SEVERITIES) {
      let prev: ReturnType<typeof cell> | null = null;
      for (const d of DURATION_OPTIONS_DAYS) {
        const cur = cell(origin.id, severity, d);
        cells++;
        if (prev) {
          const label = `${origin.id}/${severity}: ${d}D vs previous duration`;
          if (cur.bomLinesExposed < prev.bomLinesExposed) fail(`${label}: exposure decreased`);
          if (cur.buildAtRisk < prev.buildAtRisk - 1e-6) fail(`${label}: value at risk decreased`);
          if (cur.halt.bufferConsumedDays < prev.halt.bufferConsumedDays) {
            fail(`${label}: buffer consumption decreased`);
          }
          if (cur.daysToHalt > prev.daysToHalt) fail(`${label}: days to halt increased`);
        }
        prev = cur;
      }
    }
    // monotone in severity, per duration
    for (const d of DURATION_OPTIONS_DAYS) {
      let prev: ReturnType<typeof cell> | null = null;
      for (const severity of SEVERITIES) {
        const cur = cell(origin.id, severity, d);
        if (prev) {
          const label = `${origin.id}/${d}D: ${severity} vs previous severity`;
          if (cur.bomLinesExposed < prev.bomLinesExposed) fail(`${label}: exposure decreased`);
          if (cur.buildAtRisk < prev.buildAtRisk - 1e-6) fail(`${label}: value at risk decreased`);
          if (cur.halt.bufferConsumedDays < prev.halt.bufferConsumedDays) {
            fail(`${label}: buffer consumption decreased`);
          }
          if (cur.daysToHalt > prev.daysToHalt) fail(`${label}: days to halt increased`);
        }
        prev = cur;
      }
    }
  }

  // the extremes the brief names
  const maxed = deriveScenarioImpact({
    originId: "NODE-KHH-ASE",
    severity: "CRITICAL",
    durationDays: 90,
  });
  assertEq(maxed.bomLinesExposed, 14, "90D CRITICAL exposure (path set, not saturation)");
  assertEq(maxed.daysToHalt, 0, "90D CRITICAL days to halt (line stops)");
  if (!maxed.halt.lineStops) fail("90D CRITICAL must report the line stopping");

  return { cells, maxExposable };
})();
