import type { BomLine, Status } from "@/lib/types";
import { GRAPH, GRAPH_ADJACENCY, PROPAGATION_ORIGIN_ID, CUSTOMER_NODE_ID } from "@/lib/data/graph";

// ---------------------------------------------------------------------------
// Derived views for the EXPOSURE screen.
//
// The reconciliation pass removed every hardcoded count from lib/data; this
// module keeps that property. Two kinds of value live here:
//
//   1. AGGREGATES over real BOM fields (summarizeRows), never a literal, always
//      reduced from the rows the table is showing.
//   2. SYNTHESIZED depth where the underlying data genuinely does not exist in
//      bom.ts (per-quarter lead-time history, named alternates). These are pure,
//      DETERMINISTIC functions of a line's real fields: no Math.random, no
//      Date.now (both throw here anyway), so they are stable across every
//      render and identical on server and client. They are surfaced in the UI
//      as REPRESENTATIVE, never as observed per-part records.
// ---------------------------------------------------------------------------

// Deterministic 32-bit FNV-1a hash of a string. Seeds all per-part variation.
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Pick an integer in [lo, hi] from a hash. Guards lo <= hi at the call sites.
function pick(h: number, lo: number, hi: number): number {
  return lo + (h % (hi - lo + 1));
}

// ---- Job 1: lead-time history sparkline series ----------------------------

export interface LeadTimeHistory {
  series: number[]; // 8 quarters, oldest -> newest; last === leadTimeWeeks
  base: number; // pre-move baseline === leadTimeWeeks - leadTimeDelta (>= 1)
  now: number; // === leadTimeWeeks
  delta: number; // === leadTimeDelta
  riseStart: number; // index of the last baseline quarter (elbow)
  riseLen: number; // 2 or 3 quarters of recent movement
  min: number;
  max: number;
}

// Reconstruct a plausible 8-quarter lead-time history for a part. bom.ts has no
// history field, so the series is DERIVED from the line's real leadTimeWeeks and
// leadTimeDelta: a flat baseline (leadTimeWeeks - leadTimeDelta) held for the
// early quarters, then a linear ramp over the last 2-3 quarters up to the
// current leadTimeWeeks. The exact baseline wobble and ramp length are seeded by
// a stable hash of the line id, so each part reads differently but never changes
// between renders. A delta of 0 yields a flat line (honest: no spike). This
// mirrors the real March-2026 spike (20-25W norm -> ~40W) noted in DATA.md.
export function leadTimeHistory(line: BomLine): LeadTimeHistory {
  const N = 8;
  const h = hashStr(line.id);
  const now = line.leadTimeWeeks;
  const base = Math.max(1, now - line.leadTimeDelta);
  const riseLen = 2 + (h % 2); // 2 or 3
  const riseStart = N - 1 - riseLen; // last baseline index
  const series: number[] = [];
  for (let q = 0; q < N; q++) {
    if (q <= riseStart) {
      // Baseline era: hover around `base` with a tiny deterministic wobble,
      // seeded per (line, quarter), never below 1 week.
      const wob = [-1, 0, 1, 0][(h >>> (q * 2)) & 3];
      series.push(Math.max(1, base + wob));
    } else {
      // Recent move: linear ramp base -> now over the last riseLen quarters.
      const step = q - riseStart; // 1..riseLen
      series.push(Math.round(base + ((now - base) * step) / riseLen));
    }
  }
  series[N - 1] = now; // hard-pin the current quarter to the real value
  return {
    series,
    base,
    now,
    delta: line.leadTimeDelta,
    riseStart,
    riseLen,
    min: Math.min(...series),
    max: Math.max(...series),
  };
}

// ---- Job 2: qualified alternates ------------------------------------------
//
// A "qualified alternate" used to mean nothing more than a Status field with
// a nicer name. A CLEAR-postured candidate was presented as a fix with no
// check that its OWN backend, substrate or wafer fab actually sits outside
// the affected radius. Second sources routinely share a backend assembly
// site, substrate supplier or wafer fab with the part they replace, which an
// ERP cannot see (it only compares country-of-origin fields) and the old
// Status-only model could not see either. Every alternate below is now run
// through the graph: its own candidate site is checked against the affected
// radius AND against the site(s) behind the part it replaces, and only a
// real miss on both earns TRUE_ESCAPE.

export type AlternateVerdict =
  | "TRUE_ESCAPE" // shares no node with the affected radius or the replaced part
  | "SHARED_BACKEND" // collides on a backend assembly & test site
  | "SHARED_SUBSTRATE" // collides on a (modeled) substrate supplier cluster
  | "SHARED_WAFER_FAB"; // collides on a wafer fab / leadframe site

export interface Alternate {
  mpn: string; // derived candidate part number (clearly a variant)
  source: string; // representative second-source channel
  status: Status; // exposure posture, DERIVED from the verdict below, never independent of it
  pinCompatible: boolean; // drop-in footprint vs requires layout change
  requalWeeks: number; // requalification effort (DATA.md: substitution = requal)
  leadTimeWeeks: number; // candidate quoted lead time
  verdict: AlternateVerdict; // real supply-path escape verdict (see graph walk below)
  collidingNode: string | null; // the exact site name the verdict collides on, if any
  recoveredLines: number; // resolution delta: BOM lines this alternate actually clears
}

// ---- graph walk: does the candidate's own site actually escape? -----------
//
// Reuses the real GRAPH_ADJACENCY the scenario simulator's BFS
// (lib/derive/impact.ts bfsReachable) walks: same graph, same adjacency,
// no invented topology. That function is not exported (module-private to
// the scenario control), so rather than duplicate its frontier loop this
// walk is bounded to depth 1 from the propagation origin, which for a
// single hop is exactly its own neighbor set: GRAPH_ADJACENCY[originId].
// depth-1 is the right radius here: it is SEVERITY_BASE_DEPTH.CONTAINED,
// the scripted disruption's actual (not hypothetical-escalation) reach, and
// it reproduces precisely the site set buildGraph() itself marks EXPOSED via
// the zone-linkage edges fanning out of the origin.
const SITE_KINDS = new Set(["FAB", "BACKEND"]);
const nodeById = new Map(GRAPH.nodes.map((n) => [n.id, n]));
const SITE_POOL = GRAPH.nodes.filter(
  (n) => n.ring === 3 && SITE_KINDS.has(n.kind)
);
const AFFECTED_RADIUS: Set<string> = new Set(
  [PROPAGATION_ORIGIN_ID, ...(GRAPH_ADJACENCY[PROPAGATION_ORIGIN_ID] ?? [])].filter(
    (id) => SITE_POOL.some((n) => n.id === id)
  )
);

// The real site(s) behind a BOM line: its one supplier neighbor, then that
// supplier's site-tier (ring 3) neighbors. Two dictionary hops over the same
// exported adjacency map, not a second BFS, just reading the graph.
function siteNodesFor(lineId: string): Set<string> {
  const bomNodeId = `G-${lineId}`;
  const supplierIds = (GRAPH_ADJACENCY[bomNodeId] ?? []).filter((id) => id !== CUSTOMER_NODE_ID);
  const sites = new Set<string>();
  for (const supId of supplierIds) {
    for (const nb of GRAPH_ADJACENCY[supId] ?? []) {
      const node = nodeById.get(nb);
      if (node && node.ring === 3 && SITE_KINDS.has(node.kind)) sites.add(nb);
    }
  }
  return sites;
}

function verdictForNode(nodeId: string): Exclude<AlternateVerdict, "TRUE_ESCAPE"> {
  const node = nodeById.get(nodeId);
  if (node?.kind === "BACKEND") return "SHARED_BACKEND";
  if (node?.label.toLowerCase().includes("substrate")) return "SHARED_SUBSTRATE";
  return "SHARED_WAFER_FAB";
}

function escapeCheck(
  line: BomLine,
  candidateSiteId: string
): Pick<Alternate, "verdict" | "collidingNode" | "recoveredLines" | "status"> {
  const node = nodeById.get(candidateSiteId);
  const collides = siteNodesFor(line.id).has(candidateSiteId) || AFFECTED_RADIUS.has(candidateSiteId);
  if (!collides) {
    return { verdict: "TRUE_ESCAPE", collidingNode: null, recoveredLines: 1, status: "CLEAR" };
  }
  return {
    verdict: verdictForNode(candidateSiteId),
    collidingNode: node?.label ?? candidateSiteId,
    recoveredLines: 0,
    status: node?.status ?? "EXPOSED",
  };
}

// Surfaced next to every ranked-alternate list (EXPOSURE drawer, RESOLVE
// substitute card), the one-line reason this check has to run on the graph
// instead of trusting a supplier's stated country of origin.
export const ERP_BLIND_ALTERNATE_NOTE =
  "ERP tools compare country-of-origin fields. They cannot see a qualified alternate that still assembles at the same backend, substrate, or wafer fab.";

// Representative second-source channels (generic, fictional: no real vendor,
// no on-hand inventory claim).
const ALT_SOURCES = [
  "franchised distributor",
  "authorized 2nd-source",
  "cross-ref equivalent",
  "AVL-listed alternate",
];

// Candidate lead time scales with the candidate's OWN posture: a CLEAR second
// source quotes short, an EXPOSED one quotes near the stressed incumbent.
function altLead(line: BomLine, status: Status, h: number): number {
  const base = line.leadTimeWeeks;
  let lo: number;
  if (status === "CLEAR") {
    lo = 8;
    return pick(h, lo, 14);
  }
  if (status === "AT_RISK") {
    lo = Math.max(12, Math.round(base * 0.6));
  } else {
    lo = Math.max(18, Math.round(base * 0.85));
  }
  return pick(h, lo, lo + 6);
}

// Two qualified substitute candidates for a part. This data is not in bom.ts, so
// it is constructed DETERMINISTICALLY from the line: MPNs are variants of the
// real MPN stem; source/pin-compatibility/requal effort/lead time are seeded by
// a stable per-(line, slot) hash. What is NOT hashed anymore is the verdict:
// each candidate is assigned a real site out of SITE_POOL (same hash-seeded
// pick) and then run through escapeCheck against the actual graph, so
// status/verdict/collidingNode/recoveredLines all come from one consistent,
// evidenced source instead of an independent guess.
export function alternatesFor(line: BomLine): Alternate[] {
  const stem = line.mpn.replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase();

  const h1 = hashStr(line.id + "#1");
  const site1 = SITE_POOL[pick(h1 >>> 7, 0, SITE_POOL.length - 1)].id;
  const check1 = escapeCheck(line, site1);
  const a1: Alternate = {
    mpn: `${stem}-A${pick(h1, 1, 9)}`,
    source: ALT_SOURCES[h1 % ALT_SOURCES.length],
    pinCompatible: (h1 & 1) === 0,
    requalWeeks: pick(h1 >>> 3, 4, 16),
    leadTimeWeeks: altLead(line, check1.status, h1),
    ...check1,
  };

  const h2 = hashStr(line.id + "#2");
  const site2 = SITE_POOL[pick(h2 >>> 7, 0, SITE_POOL.length - 1)].id;
  const check2 = escapeCheck(line, site2);
  const a2: Alternate = {
    mpn: `${stem}-B${pick(h2, 1, 9)}`,
    source: ALT_SOURCES[(h2 >>> 2) % ALT_SOURCES.length],
    pinCompatible: (h2 & 1) === 0,
    requalWeeks: pick(h2 >>> 3, 4, 16),
    leadTimeWeeks: altLead(line, check2.status, h2),
    ...check2,
  };

  // ---- the demo moment (RULE: pinned in data, per AGENTS.md wave-2 brief) --
  // BOM-07 / ISO5852SDW is the centerpiece ERP-blind catch. Its two alternates
  // are pinned so the contrast is exact and reproducible on every render:
  // ISO5852SDW-A8 is a TRUE ESCAPE (different backend, clears the line);
  // ISO5852SDW-B2 is pin-compatible, quotes a shorter 29W lead time, and LOOKS
  // like a fix, but still assembles through Kaohsiung, so it recovers
  // nothing. No ERP catches this because ERPs compare country-of-origin
  // fields, not backend assembly sites.
  if (line.id === "BOM-07") {
    a1.mpn = `${stem}-A8`;
    a1.verdict = "TRUE_ESCAPE";
    a1.collidingNode = null;
    a1.recoveredLines = 1;
    a1.status = "CLEAR";

    const khh = nodeById.get(PROPAGATION_ORIGIN_ID);
    a2.mpn = `${stem}-B2`;
    a2.pinCompatible = true;
    a2.leadTimeWeeks = 29;
    a2.verdict = "SHARED_BACKEND";
    a2.collidingNode = khh?.label ?? "Kaohsiung backend A&T";
    a2.recoveredLines = 0;
    a2.status = khh?.status ?? "EXPOSED";
  }

  return [a1, a2];
}

// ---- Job 3: table summary row ---------------------------------------------

export interface RowSummary {
  totalRows: number; // lines currently shown
  exposedLines: number; // count of EXPOSED among shown lines
  exposedQtyPerUnit: number; // sum of qtyPerUnit over EXPOSED lines
  peakLeadTimeExposed: number; // max leadTimeWeeks over EXPOSED lines
  tier: [number, number, number]; // [T1, T2, T3] counts over shown lines
}

// Aggregate the currently-shown rows. Every number is reduced from real BOM
// fields on the passed rows (themselves a filter of lib/data BOM), with no literal
// anywhere. Recomputes as the filter changes, so the footer summarizes exactly
// what the table shows.
export function summarizeRows(rows: BomLine[]): RowSummary {
  const exposed = rows.filter((r) => r.status === "EXPOSED");
  const tier: [number, number, number] = [0, 0, 0];
  for (const r of rows) tier[r.tier - 1] += 1;
  return {
    totalRows: rows.length,
    exposedLines: exposed.length,
    exposedQtyPerUnit: exposed.reduce((s, r) => s + r.qtyPerUnit, 0),
    peakLeadTimeExposed: exposed.reduce((m, r) => Math.max(m, r.leadTimeWeeks), 0),
    tier,
  };
}
