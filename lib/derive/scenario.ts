import type { BomLine, Status, SupplyPathNode } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { GRAPH, FREIGHT_LANE, CUSTOMER_NODE_ID } from "@/lib/data/graph";
import {
  type ContainmentSeverity,
  type ScenarioControlState,
  DEFAULT_SCENARIO_CONTROL,
} from "@/lib/data/scenario";
import {
  BUFFER_DAYS,
  daysToHalt,
  type DaysToHaltBreakdown,
} from "@/lib/derive/halt";

/* ============================================================
   THE SCENARIO MODEL: what a disruption of a given origin, severity and
   duration physically does to a bill of materials.

   This replaces the old hop-budget BFS over GRAPH_ADJACENCY, which had two
   structural lies in it:

     1. It walked an UNDIRECTED adjacency that includes the customer node
        (connected to all 31 BOM lines) and the decorative density-padding
        edges, so at depth 6 it reached the entire network and marked the
        domestic PCB fab as exposed by a Kaohsiung quarantine.
     2. It spent duration as extra hops, so a longer disruption REACHED
        further instead of LASTING longer, and never touched the halt math.

   The model here is the causal chain, each step its own named function:

     duration x severity  ->  effectiveHoldDays   (how long freight stops)
     hold beyond what the buffer absorbs  ->  excessHoldDays
     structural lead-time overrun + excess hold  ->  bufferConsumedDays
     buffer minus consumption  ->  daysToHalt  (clamped to [0, buffer])

   Exposure is path membership, not graph distance: a line is exposed if
   and only if one of its OWN supply-path stages sits inside the affected
   radius. Severity widens the radius (site, then the site's modeled input
   clusters, then the whole export corridor); duration NEVER widens it. A
   longer quarantine holds the same paths longer, it does not discover new
   ones. That asymmetry is what the old model got backwards.
   ============================================================ */

// ---- 1. the affected radius ------------------------------------------------
//
// Which physical places a disruption at `originId` reaches, per severity.
//
//   CONTAINED   the site runs at reduced capacity. Only lines with a stage
//               at the site itself feel it.
//   ESCALATING  the site is substantially impaired. Reaches the next tier
//               up its own supply chain: for the Kaohsiung backend that is
//               the modeled substrate / leadframe / assembly-materials
//               clusters feeding it, plus the port it ships from.
//   CRITICAL    the site is down. Every path that routes through it is cut,
//               and for a Taiwan origin that is the island's whole export
//               corridor (Kaohsiung + Hsinchu + Taipei): outbound freight
//               for all three clears through the quarantined port, which is
//               exactly why the scripted event exposes Taipei distribution.
//
// For origins that are not the quarantine story (Dallas, Penang, ...), the
// radius is the site itself at every severity: there is no modeled cluster
// behind them in this dataset and no shared corridor in front of them.
// Severity still changes throughput loss (see effectiveHoldDays), so the
// halt figures move even where the exposure set cannot.

export interface AffectedRadius {
  originId: string;
  severity: ContainmentSeverity;
  /** Lowercase tokens matched against OBSERVED supply-path stage sites. */
  observedTokens: readonly string[];
  /** Whether the modeled TW zone clusters are inside the radius. */
  includesModeledZone: boolean;
  /** Graph/map site node ids inside the radius (node coloring, lanes). */
  siteIds: readonly string[];
}

const TAIWAN_CORRIDOR_TOKENS = ["kaohsiung", "hsinchu", "taipei"] as const;
const ZONE_SITE_IDS = [
  "NODE-KHH-ASE",
  "NODE-PORT-KHH",
  "NODE-ZONE-MDL",
  "NODE-LF",
  "NODE-SUBS",
  "NODE-HSC",
  "NODE-TPE",
] as const;

/** Region token per selectable origin site (lib/data/scenario.ts
 *  ORIGIN_OPTIONS). Matched by substring against supply-path site strings,
 *  the same convention lib/derive/exposure.ts ZONE_REGIONS already uses. */
const ORIGIN_TOKEN: Record<string, string> = {
  "NODE-KHH-ASE": "kaohsiung",
  "NODE-HSC": "hsinchu",
  "NODE-TPE": "taipei",
  "NODE-DAL": "dallas",
  "NODE-PEN": "penang",
  "NODE-SGP": "singapore",
  "NODE-KUM": "kumamoto",
  "NODE-DRE": "dresden",
  "NODE-CHI": "chicago",
};

export function affectedRadius(
  originId: string,
  severity: ContainmentSeverity
): AffectedRadius {
  if (originId === "NODE-KHH-ASE") {
    if (severity === "CONTAINED") {
      return {
        originId,
        severity,
        observedTokens: ["kaohsiung"],
        includesModeledZone: false,
        siteIds: ["NODE-KHH-ASE"],
      };
    }
    if (severity === "ESCALATING") {
      return {
        originId,
        severity,
        observedTokens: ["kaohsiung"],
        includesModeledZone: true,
        siteIds: [
          "NODE-KHH-ASE",
          "NODE-PORT-KHH",
          "NODE-ZONE-MDL",
          "NODE-LF",
          "NODE-SUBS",
        ],
      };
    }
    return {
      originId,
      severity,
      observedTokens: TAIWAN_CORRIDOR_TOKENS,
      includesModeledZone: true,
      siteIds: ZONE_SITE_IDS,
    };
  }
  const token = ORIGIN_TOKEN[originId];
  return {
    originId,
    severity,
    observedTokens: token ? [token] : [],
    includesModeledZone: false,
    siteIds: [originId],
  };
}

// ---- 2. exposure: path membership against the radius ----------------------
//
// A stage is inside the radius when either
//   - it is an OBSERVED stage whose site string names an affected region, or
//   - it is a MODELED zone-cluster stage (its inQuarantineZone flag is the
//     authored verdict that the inferred cluster sits in the TW zone) and
//     the radius includes the modeled clusters.
// A line with no supply path can never be exposed: the model only claims
// what a path it has actually resolved can support. That is the supply-path
// invariant, and it is what keeps the domestic PCB fab CLEAR at 90D CRITICAL.

export function stageInRadius(stage: SupplyPathNode, radius: AffectedRadius): boolean {
  if (stage.provenance === "MODELED") {
    return radius.includesModeledZone && stage.inQuarantineZone;
  }
  const site = stage.site.toLowerCase();
  return radius.observedTokens.some((t) => site.includes(t));
}

export function lineInRadius(line: BomLine, radius: AffectedRadius): boolean {
  return (line.supplyPath ?? []).some((s) => stageInRadius(s, radius));
}

/** The scenario counterpart of lib/derive/exposure.ts deriveStatus: same
 *  three-way rule, with the zone generalized to the scenario's radius. */
export function scenarioStatus(line: BomLine, radius: AffectedRadius): Status {
  if (lineInRadius(line, radius)) return "EXPOSED";
  return line.leadTimeDelta > 0 ? "AT_RISK" : "CLEAR";
}

export function scenarioExposedLines(
  lines: readonly BomLine[],
  control: ScenarioControlState
): BomLine[] {
  const radius = affectedRadius(control.originId, control.severity);
  return lines.filter((l) => lineInRadius(l, radius));
}

// ---- 3. duration: the hold, and what it does to the buffer ----------------
//
// A quarantine of N days at a site holds parts awaiting shipment and parts
// in transit for N days, then adds congestion recovery on top. Severity
// scales how much of the site's throughput is actually stopped.

/** Fraction of throughput lost at each severity. CONTAINED keeps the site
 *  running degraded; CRITICAL is a full stop. */
export const SEVERITY_THROUGHPUT_LOSS: Record<ContainmentSeverity, number> = {
  CONTAINED: 0.35,
  ESCALATING: 0.7,
  CRITICAL: 1,
};

/** Congestion recovery after reopening: every 2 days of hold leave 1 more
 *  day of backlog to clear (0.5x), on top of the hold itself. */
export const CONGESTION_RECOVERY_RATIO = 0.5;

/** Days of shipment delay the disruption imposes on paths in the radius. */
export function effectiveHoldDays(
  severity: ContainmentSeverity,
  durationDays: number
): number {
  return Math.round(
    durationDays * SEVERITY_THROUGHPUT_LOSS[severity] * (1 + CONGESTION_RECOVERY_RATIO)
  );
}

/** The hold the 10-week buffer is sized to absorb without extra erosion.
 *  Calibrated as the scripted event's own effective hold (30D CRITICAL,
 *  45 days): the recorded baseline consumes no excess by definition, and
 *  every day of hold beyond it comes off the runway one for one. */
export const ABSORBABLE_HOLD_DAYS = effectiveHoldDays(
  DEFAULT_SCENARIO_CONTROL.severity,
  DEFAULT_SCENARIO_CONTROL.durationDays
);

export function excessHoldDays(
  severity: ContainmentSeverity,
  durationDays: number
): number {
  return Math.max(0, effectiveHoldDays(severity, durationDays) - ABSORBABLE_HOLD_DAYS);
}

/** Full runway accounting for a scenario. Extends the structural breakdown
 *  (lib/derive/halt.ts, unchanged) with the duration channel. */
export interface ScenarioHaltBreakdown extends DaysToHaltBreakdown {
  /** Days of shipment delay the scenario imposes (duration x severity). */
  holdDays: number;
  absorbableHoldDays: number;
  /** Hold beyond what the buffer was sized to absorb. */
  excessHoldDays: number;
  /** erosionDays (structural lead-time overrun) + excessHoldDays. */
  bufferConsumedDays: number;
  /** True when consumption reaches the whole buffer: the line stops. */
  lineStops: boolean;
}

export function scenarioHalt(
  exposedLines: BomLine[],
  control: ScenarioControlState
): ScenarioHaltBreakdown {
  const structural = daysToHalt(exposedLines);
  const holdDays = effectiveHoldDays(control.severity, control.durationDays);
  // A hold that touches no line on this BOM consumes nothing.
  const excess =
    exposedLines.length > 0 ? excessHoldDays(control.severity, control.durationDays) : 0;
  const consumed = structural.erosionDays + excess;
  const days = Math.min(BUFFER_DAYS, Math.max(0, BUFFER_DAYS - consumed));
  return {
    ...structural,
    daysToHalt: days,
    holdDays,
    absorbableHoldDays: ABSORBABLE_HOLD_DAYS,
    excessHoldDays: excess,
    bufferConsumedDays: consumed,
    lineStops: days === 0,
  };
}

// ---- 4. the graph view of a scenario --------------------------------------
//
// Node statuses for GRAPH and the RADAR map, derived from the same exposure
// set every other screen reads. At the default control this reproduces the
// statuses lib/data/graph.ts builds (guarded in lib/derive/guards.ts), so
// the default frame is pixel-identical; any other control recolors the
// network from the scenario instead of the scripted event.

const SUPPLIER_OF_BOM_NODE: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const e of GRAPH.edges) {
    if (e.source.startsWith("G-BOM-") && e.target.startsWith("S-")) {
      m.set(e.source, e.target);
    }
  }
  return m;
})();

const STATUS_RANK: Record<Status, number> = { CLEAR: 0, AT_RISK: 1, EXPOSED: 2 };
function worst(a: Status, b: Status): Status {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export interface ScenarioGraphView {
  /** node id -> status under this scenario, for every GRAPH node. */
  status: ReadonlyMap<string, Status>;
  /** Scenario counterpart of lib/data/graph.ts EXPOSED_PATH_NODE_IDS, in
   *  GRAPH.nodes order: exposed nodes + customer + (for the quarantine
   *  origin) the stuck freight's own lane. */
  exposedPathIds: string[];
  /** Scenario counterpart of EXPOSED_BOM_NODE_IDS, in BOM order. */
  exposedBomNodeIds: string[];
}

const BOM_BY_NODE_ID = new Map(BOM.map((b) => [`G-${b.id}`, b]));

export function scenarioGraphView(control: ScenarioControlState): ScenarioGraphView {
  const radius = affectedRadius(control.originId, control.severity);
  const status = new Map<string, Status>();
  const supplierStatus = new Map<string, Status>();
  const exposedBomNodeIds: string[] = [];

  for (const n of GRAPH.nodes) {
    const line = BOM_BY_NODE_ID.get(n.id);
    if (line) {
      const s = scenarioStatus(line, radius);
      status.set(n.id, s);
      if (s === "EXPOSED") exposedBomNodeIds.push(n.id);
      const sup = SUPPLIER_OF_BOM_NODE.get(n.id);
      if (sup) supplierStatus.set(sup, worst(supplierStatus.get(sup) ?? "CLEAR", s));
    }
  }
  const anyExposed = exposedBomNodeIds.length > 0;
  const inRadius = new Set(radius.siteIds);
  for (const n of GRAPH.nodes) {
    if (status.has(n.id)) continue;
    if (n.id === CUSTOMER_NODE_ID) {
      status.set(n.id, anyExposed ? "AT_RISK" : "CLEAR");
    } else if (n.id.startsWith("S-")) {
      status.set(n.id, supplierStatus.get(n.id) ?? "CLEAR");
    } else {
      status.set(n.id, inRadius.has(n.id) ? "EXPOSED" : "CLEAR");
    }
  }

  const keep = new Set<string>([CUSTOMER_NODE_ID]);
  // The stuck freight's route belongs to the quarantine origin's story only.
  if (control.originId === DEFAULT_SCENARIO_CONTROL.originId && anyExposed) {
    for (const id of FREIGHT_LANE) keep.add(id);
  }
  for (const n of GRAPH.nodes) if (status.get(n.id) === "EXPOSED") keep.add(n.id);
  const exposedPathIds = GRAPH.nodes.filter((n) => keep.has(n.id)).map((n) => n.id);

  return { status, exposedPathIds, exposedBomNodeIds };
}
