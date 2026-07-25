import type { BomLine, Status } from "@/lib/types";

// ---------------------------------------------------------------------------
// Derived views for the EXPOSURE screen.
//
// The reconciliation pass removed every hardcoded count from lib/data; this
// module keeps that property. Two kinds of value live here:
//
//   1. AGGREGATES over real BOM fields (summarizeRows) — never a literal, always
//      reduced from the rows the table is showing.
//   2. SYNTHESIZED depth where the underlying data genuinely does not exist in
//      bom.ts (per-quarter lead-time history, named alternates). These are pure,
//      DETERMINISTIC functions of a line's real fields — no Math.random, no
//      Date.now (both throw here anyway) — so they are stable across every
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

const RANK: Record<Status, number> = { CLEAR: 0, AT_RISK: 1, EXPOSED: 2 };

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

export interface Alternate {
  mpn: string; // derived candidate part number (clearly a variant)
  source: string; // representative second-source channel
  status: Status; // independent exposure posture of the candidate
  betterThanPart: boolean; // strictly better exposure posture than the line
  pinCompatible: boolean; // drop-in footprint vs requires layout change
  requalWeeks: number; // requalification effort (DATA.md: substitution = requal)
  leadTimeWeeks: number; // candidate quoted lead time
}

// Representative second-source channels (generic, fictional — no real vendor,
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

function statusFromHash(h: number): Status {
  const r = h % 3;
  return r === 0 ? "CLEAR" : r === 1 ? "AT_RISK" : "EXPOSED";
}

// Two qualified substitute candidates for a part. This data is not in bom.ts, so
// it is constructed DETERMINISTICALLY from the line: MPNs are variants of the
// real MPN stem; each candidate's posture, pin-compatibility, requal effort and
// lead time are seeded by a stable per-(line, slot) hash. Alt 1 is pinned to the
// BEST posture (CLEAR) so any non-CLEAR part always has at least one strictly
// better option (the block is decision-useful); Alt 2 varies by part and may be
// equal or worse (honest: not every substitute clears the same risk).
export function alternatesFor(line: BomLine): Alternate[] {
  const stem = line.mpn.replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase();
  const partRank = RANK[line.status];

  const h1 = hashStr(line.id + "#1");
  const a1status: Status = "CLEAR";
  const a1: Alternate = {
    mpn: `${stem}-A${pick(h1, 1, 9)}`,
    source: ALT_SOURCES[h1 % ALT_SOURCES.length],
    status: a1status,
    betterThanPart: RANK[a1status] < partRank,
    pinCompatible: (h1 & 1) === 0,
    requalWeeks: pick(h1 >>> 3, 4, 16),
    leadTimeWeeks: altLead(line, a1status, h1),
  };

  const h2 = hashStr(line.id + "#2");
  const a2status = statusFromHash(h2);
  const a2: Alternate = {
    mpn: `${stem}-B${pick(h2, 1, 9)}`,
    source: ALT_SOURCES[(h2 >>> 2) % ALT_SOURCES.length],
    status: a2status,
    betterThanPart: RANK[a2status] < partRank,
    pinCompatible: (h2 & 1) === 0,
    requalWeeks: pick(h2 >>> 3, 4, 16),
    leadTimeWeeks: altLead(line, a2status, h2),
  };

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
// fields on the passed rows (themselves a filter of lib/data BOM) — no literal
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
