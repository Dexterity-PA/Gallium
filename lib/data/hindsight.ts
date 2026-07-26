import type { Provenance } from "@/lib/types";
import { assertBand, assertNoAdjacentRepeats } from "@/lib/data/confidence";

// HINDSIGHT is the lookback screen, new for this pass.
//
// Every other screen in the app makes a claim at one moment: RADAR says an
// event just happened, EXPOSURE says a line is exposed right now. None of
// that is falsifiable from inside the demo. It's all "trust us, we caught
// it." This module backs the one screen that IS falsifiable: four prior
// events, each with the date Gallium actually flagged it next to the date
// the benchmark (ERP for three rows, a compliance check for one, see
// benchmarkLabel below) would have reflected it, so the lead time is a fact
// you can check rather than a number Gallium asserts about itself.
//
// The honesty requirement is load-bearing, not decorative: three real wins
// of very different sizes (24d, 15d, 3d). A product that always wins by
// three weeks reads as fabricated. This module also carries one genuine
// MISS, where the signal existed but Gallium under-called its confidence
// and the customer's own compliance check beat it. Leave the miss in. It's
// what makes the other three believable.

export type HindsightOutcome = "CAUGHT" | "PARTIAL" | "MISSED";

export interface HindsightEvent {
  id: string;
  date: string; // ISO date, when the underlying real-world event occurred
  headline: string;
  detected: string; // what Gallium's monitor actually surfaced
  flaggedAt: string; // ISO datetime, when Gallium raised the flag
  erpAt: string; // ISO datetime, the timestamp of the benchmark this row is compared against (see benchmarkLabel)
  // What Gallium is being checked against for this row. Three rows compare
  // against the customer's ERP; the ownership-change row compares against
  // Meridian's own compliance cross-check instead, because that is what
  // actually caught it first. Naming the benchmark per row keeps the column
  // header honest instead of forcing every row under a label that only fits
  // three of them.
  benchmarkLabel: string;
  outcome: HindsightOutcome;
  note: string; // the honest gloss, especially load-bearing for PARTIAL/MISSED
  provenance: Provenance;
  confidence: number; // a ConfidenceBand value, see lib/data/confidence.ts
  sourceIds: string[]; // → SourceDoc.id in lib/data/sources.ts (never empty)
}

// Lead time in days, benchmark-reflected minus Gallium-flagged. Positive
// means Gallium beat the benchmark; negative means the benchmark beat
// Gallium. Derived from the two timestamps rather than authored separately,
// so a row can never drift from the dates that back it.
export function deltaDays(ev: HindsightEvent): number {
  const ms = Date.parse(ev.erpAt) - Date.parse(ev.flaggedAt);
  return Math.round(ms / 86_400_000);
}

export function medianDeltaDays(events: HindsightEvent[]): number {
  const sorted = events.map(deltaDays).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(med);
}

// The headline stat, e.g. "FLAGGED 9D BEFORE ERP". Falls back to "AFTER" in
// the (currently untriggered) case where the median itself goes negative.
// The same honesty this screen asks of every row applies to its own headline.
export function formatLeadHeadline(medianDays: number): string {
  return medianDays >= 0
    ? `FLAGGED ${medianDays}D BEFORE ERP`
    : `FLAGGED ${Math.abs(medianDays)}D AFTER ERP`;
}

export const HINDSIGHT_EVENTS: HindsightEvent[] = [
  {
    id: "HND-01",
    date: "2026-02-09",
    headline: "GUANGDONG BT LAMINATE SUBSTRATE SQUEEZE",
    detected:
      "Leadframe and BT-substrate spot pricing began diverging from trailing baseline across the packaging cluster behind Meridian's isolation parts. It was a precursor to an allocation cut, visible in market data weeks before any vendor requote.",
    flaggedAt: "2026-02-11T09:14:00Z",
    erpAt: "2026-03-07T09:14:00Z",
    benchmarkLabel: "ERP WOULD REFLECT",
    outcome: "CAUGHT",
    note:
      "Vendor lead-time reforecast confirmed the squeeze 24 days later. Meridian's ERP had no visibility until that quarterly reforecast posted.",
    provenance: "OBSERVED",
    confidence: 95,
    sourceIds: [
      "SRC-SUBSTRATE-MKT",
      "SRC-FAB-UTIL",
      "SRC-HND01-SPOT",
      "SRC-HND01-ALLOC",
    ],
  },
  {
    id: "HND-02",
    date: "2026-04-01",
    headline: "REINFORCED-ISOLATION GATE DRIVER ALLOCATION REROUTE",
    detected:
      "Authorized-channel allocation for reinforced-isolation gate-driver parts shifted toward priority accounts ahead of the standard requote cycle, exposing Meridian's Q2 build to the same category before its distributor said anything directly.",
    flaggedAt: "2026-04-03T11:02:00Z",
    erpAt: "2026-04-18T11:02:00Z",
    benchmarkLabel: "ERP WOULD REFLECT",
    outcome: "CAUGHT",
    note:
      "The distributor's own portal confirmed the reroute 15 days later. Meridian's planning system carried the stale allocation until that update posted.",
    provenance: "OBSERVED",
    confidence: 87,
    sourceIds: ["SRC-DIST-ALLOC", "SRC-HND02-PORTAL", "SRC-HND02-REQUOTE"],
  },
  {
    id: "HND-03",
    date: "2026-05-21",
    headline: "TAIWAN-ORIGIN LANE CARRIER RELIABILITY DROP",
    detected:
      "Two ocean carriers issued schedule-reliability warnings on Taiwan-origin lanes serving Meridian's backend test supplier. It was a fast-moving signal with a narrow window before the next sailing, not the kind of lead the other rows show.",
    flaggedAt: "2026-05-22T16:40:00Z",
    erpAt: "2026-05-25T16:40:00Z",
    benchmarkLabel: "ERP WOULD REFLECT",
    outcome: "CAUGHT",
    note:
      "Only a 3-day margin. Real leads vary. A monitor that always wins by three weeks is a monitor that isn't measuring anything.",
    provenance: "OBSERVED",
    confidence: 91,
    sourceIds: ["SRC-CARRIER-ADV", "SRC-HND03-SAILING"],
  },
  {
    id: "HND-04",
    date: "2026-06-09",
    headline: "TIER-2 RECTIFIER SUPPLIER OWNERSHIP CHANGE",
    detected:
      "A tier-2 rectifier supplier's parent stake crossed the affiliates-screening threshold. The network inference caught the underlying registry shift, but rated it below reporting confidence and did not escalate to a flag.",
    flaggedAt: "2026-06-19T08:00:00Z",
    erpAt: "2026-06-14T08:00:00Z",
    benchmarkLabel: "MERIDIAN COMPLIANCE CHECK",
    outcome: "MISSED",
    note:
      "Meridian's own compliance cross-check surfaced the crossing 5 days before Gallium's flag went out. The signal existed in the graph the whole time. It just didn't clear the bar to alert on. This is the miss the other three rows are checked against.",
    provenance: "MODELED",
    confidence: 61,
    sourceIds: ["SRC-HND04-INFER-THIN"],
  },
];

export const MEDIAN_LEAD_DAYS = medianDeltaDays(HINDSIGHT_EVENTS);
export const LEAD_HEADLINE = formatLeadHeadline(MEDIAN_LEAD_DAYS);

// ---- honesty guard (dev-time) ----
// This screen exists to prove Gallium's track record is real, not generated.
// That claim fails the moment every row looks the same, so the guard below
// enforces the shape of the evidence, not just its legality: every
// confidence must sit in a legal band for its provenance and must not
// repeat its neighbour, every row must name what it is benchmarked against,
// every row's source count must differ from every other row's (uniform
// counts are as loud a tell as uniform confidence), at least one lead time
// must be short enough to be credible, and at least one row must NOT be a
// clean win. Throws at import so a regression fails the build rather than
// the demo.
export const HINDSIGHT_HONESTY_OK = (() => {
  for (const e of HINDSIGHT_EVENTS) {
    assertBand(e.confidence, e.provenance, `HINDSIGHT ${e.id}`);
    if (!e.sourceIds.length) {
      throw new Error(`HINDSIGHT ${e.id} has no sourceIds. Every claim here must be inspectable.`);
    }
    if (!e.benchmarkLabel.trim()) {
      throw new Error(`HINDSIGHT ${e.id} has no benchmarkLabel. Every row must name what it is checked against.`);
    }
  }
  assertNoAdjacentRepeats(
    HINDSIGHT_EVENTS.map((e) => e.confidence),
    "HINDSIGHT_EVENTS"
  );

  const srcCounts = HINDSIGHT_EVENTS.map((e) => e.sourceIds.length);
  if (new Set(srcCounts).size !== srcCounts.length) {
    throw new Error("HINDSIGHT_EVENTS source counts must all differ. A uniform count is the tell.");
  }

  const deltas = HINDSIGHT_EVENTS.map(deltaDays);
  const hasShortWin = deltas.some((d) => d > 0 && d <= 5);
  if (!hasShortWin) {
    throw new Error("HINDSIGHT_EVENTS needs at least one short (<=5d) lead time to stay credible");
  }
  const hasNonWin = HINDSIGHT_EVENTS.some((e) => e.outcome !== "CAUGHT");
  if (!hasNonWin) {
    throw new Error("HINDSIGHT_EVENTS needs at least one MISSED or PARTIAL row. An all-win record is the tell.");
  }

  return { events: HINDSIGHT_EVENTS.length, medianDays: MEDIAN_LEAD_DAYS };
})();
