import type { FeedEvent, Impact } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { TIER2_CATCHES } from "@/lib/data/actions";
import { assertConfidence, assertNoAdjacentRepeats } from "@/lib/data/confidence";

// Feed confidence is authored PER ROW, not derived from a single band.
//
// This used to return CORROBORATED for every row, so all ten items rendered
// CONF 90% — the loudest generated-data tell on the screen. A monitoring feed
// carries wildly different degrees of corroboration: a three-document customs
// notice and an unattributed berth-congestion report are not the same claim,
// and rendering them at the same number says the number is decorative.
//
// So each row carries its own `conf`, and the value tracks the row's actual
// evidence — how many documents back it, and how directly. Rows with no
// attached document sit in the MODELED bands on purpose (see confidence.ts's
// assertConfidence: the feed is provenance-agnostic per row). The guards at
// the bottom enforce the spread: every value legal, none forbidden, and no two
// adjacent rows sharing a number.
//
// Sources are authored per row too. Counts vary 0–3, and three rows carry NO
// source at all — an early signal that has not been tied to a document yet is
// a real state a monitor has to be able to show, and pretending otherwise is
// the same dishonesty as a uniform confidence.

// Primary event — invented for the demo (DATA.md §0, §2).
export const PRIMARY_EVENT = {
  id: "EVT-2026-0722-KHH",
  severity: "CRITICAL",
  timestamp: "2026-07-22T14:31:58Z",
  headline: "MARITIME QUARANTINE — KAOHSIUNG",
  body: "PRC customs inspection regime declared for outbound container traffic, Kaohsiung and adjacent anchorages. Air corridors unaffected. Ocean freight holding at berth.",
  sourceCount: 3,
  confidence: 93, // CONFIRMED band — customs bulletin, port feed and carrier advisory agree
  sourceIds: ["SRC-KHH-CUSTOMS", "SRC-PORT-KHH", "SRC-CARRIER-ADV"], // sourceCount: 3
  zone: { lat: 22.6, lng: 120.3, radiusKm: 180 },
} as const;

type FeedSeed = Omit<FeedEvent, "sourceIds" | "confidence"> & {
  /** Provenance documents backing this row. Empty = not yet attributed. */
  sources: string[];
  /** This row's own confidence. See the note above; never a shared constant. */
  conf: number;
};

// Six pre-existing rows + four that stream in on the demo timer.
// Mixed severity so the feed reads as a monitor, not a single-issue box.
//
// Body copy is deliberately uneven, because real feed copy is:
//   · rows 1 and 2 have no description at all — headline and nothing else
//   · rows 5 and 7 are clipped fragments off a wire, no terminal period
//   · rows 3 and 9 are written out in two full sentences
//   · row 8 carries an UPD correction stamp against its original text
// Do not "tidy" these into a consistent shape. The inconsistency is the point.
const FEED_SEED: FeedSeed[] = [
  {
    t: "13:58:12",
    sev: "INFO",
    head: "ALLOCATION NOTICE — POWER DISCRETES",
    body: "",
    sources: [], // channel chatter, no notice published yet
    conf: 71,
  },
  {
    t: "14:02:44",
    sev: "INFO",
    head: "FAB UTILIZATION — MATURE NODES",
    body: "",
    sources: ["SRC-FAB-UTIL"],
    conf: 82,
  },
  {
    t: "14:09:31",
    sev: "WARN",
    head: "LEAD TIME EXTENSION — OPTOCOUPLERS",
    body: "Quoted lead times are extending 3-5 weeks across the isolation component category. Three distributors have moved their quotes in the same direction inside a week.",
    sources: ["SRC-LEADTIME", "SRC-DIST-ALLOC", "SRC-SUBSTRATE-MKT"],
    conf: 91,
  },
  {
    t: "14:15:07",
    sev: "INFO",
    head: "EXPORT RULE — COMMENT PERIOD OPENS",
    body: "Proposed rule affecting ownership screening thresholds enters public comment.",
    sources: ["SRC-AFFIL-RULE"],
    conf: 84,
  },
  {
    t: "14:21:53",
    sev: "WARN",
    head: "TYPHOON ADVISORY — LUZON STRAIT",
    body: "Tropical system tracking north, shipping advisories issued, no closures",
    sources: [],
    conf: 63,
  },
  {
    t: "14:27:19",
    sev: "INFO",
    head: "PRICE MOVEMENT — SUBSTRATE",
    body: "BT substrate spot pricing up 2.1% month-over-month.",
    sources: ["SRC-SUBSTRATE-MKT", "SRC-MONITOR"],
    conf: 74,
  },
  {
    t: "14:30:02",
    sev: "WARN",
    head: "PORT CONGESTION — KAOHSIUNG",
    body: "Berth wait times extending, cause not yet attributed",
    sources: [], // this is the row the quarantine notice later explains
    conf: 58,
    arrivesAtMs: 3200,
  },
  {
    t: "14:31:11",
    sev: "WARN",
    head: "CARRIER ADVISORY — TW ROUTES",
    body: "Two carriers issue schedule reliability warnings for Taiwan-origin lanes. UPD 14:36Z — third carrier filed, count revised from two.",
    sources: ["SRC-CARRIER-ADV", "SRC-LOGI-NET"],
    conf: 88,
    arrivesAtMs: 5600,
  },
  {
    t: "14:31:34",
    sev: "CRITICAL",
    head: "OWNERSHIP RULE — AFFILIATES SCREENING RETURNS",
    body: "The 50% ownership threshold screening resumes Nov 10 2026, having been suspended under the Nov 2025 truce. Diligence and license obligations attach to affected suppliers.",
    sources: ["SRC-AFFIL-RULE", "SRC-CORP-REGISTRY", "SRC-IMPORT-REC"],
    conf: 96,
    arrivesAtMs: 6800,
  },
  {
    t: "14:31:58",
    sev: "CRITICAL",
    head: "MARITIME QUARANTINE — KAOHSIUNG",
    body: "PRC customs inspection regime on outbound container traffic, air corridors unaffected.",
    sources: ["SRC-KHH-CUSTOMS", "SRC-PORT-KHH", "SRC-CARRIER-ADV"],
    conf: 93,
    arrivesAtMs: 8000,
    isPrimary: true,
  },
];

// Attach provenance documents and per-row confidence.
export const FEED_EVENTS: FeedEvent[] = FEED_SEED.map(({ sources, conf, ...e }) => ({
  ...e,
  sourceIds: sources,
  confidence: conf,
}));

// Every rendered feed confidence must land in a band, must not be a forbidden
// value (90/100), and must differ from its neighbours. Throws at import, so a
// regression back to a uniform feed fails the build rather than the demo.
export const FEED_CONFIDENCE_OK = (() => {
  for (const e of FEED_EVENTS) assertConfidence(e.confidence, `FEED ${e.head}`);
  assertConfidence(PRIMARY_EVENT.confidence, "PRIMARY_EVENT");
  assertNoAdjacentRepeats(
    FEED_EVENTS.map((e) => e.confidence),
    "FEED_EVENTS"
  );
  return true;
})();

// Source counts must vary too — a feed where every row cites the same number
// of outlets is the same tell as one where every row cites the same
// confidence. Requires at least four distinct counts across the feed.
export const FEED_SOURCE_SPREAD_OK = (() => {
  const counts = FEED_EVENTS.map((e) => e.sourceIds.length);
  const distinct = new Set(counts).size;
  if (distinct < 4) {
    throw new Error(
      `FEED_EVENTS source counts are too uniform (${distinct} distinct values in ${counts.join(",")})`
    );
  }
  return { counts, distinct, unattributed: counts.filter((c) => c === 0).length };
})();

// Deliberately moderate — defensible against the $6.1M quarterly build and
// 52 days of inventory cover (DATA.md §3). Do not inflate.
export const IMPACT: Impact = {
  // Line counts derived from BOM so RADAR can't drift from EXPOSURE/RESOLVE.
  // "Exposed" is quarantine exposure only (14) — the 2 compliance-flagged lines
  // are logistics-CLEAR and live on the ownership axis, not here.
  bomLinesExposed: BOM.filter((b) => b.status === "EXPOSED").length, // 14
  bomLinesTotal: BOM.length, // 31
  buildAtRisk: 2_600_000,
  buildAtRiskLabel: "$2.6M",
  daysToHalt: 52,
  tier2Catches: TIER2_CATCHES, // 3 — tier-2 ERP-blind catches
};
