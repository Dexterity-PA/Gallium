import type { Action } from "@/lib/types";
import { BOM } from "@/lib/data/bom";

// Resolution actions (DATA.md §8). Post-reconciliation the four actions
// recover 6 + 3 + 2 (logistics) + 2 (compliance) = 13 = OBSERVED_RESOLVABLE.
// Of the 16 lines requiring action, the 3 MODELED tier-3 lines are flagged,
// not resolved (they cannot be; see ResolutionBar). Keep counts consistent;
// they are all derived below and asserted in rollup.ts.
//
// The 4th action (ACT-LICENSE) is a COMPLIANCE / affiliates-screening item on a
// SEPARATE axis from the logistics recovery: its two covered lines are ownership-
// FLAGGED and logistics-CLEAR (not quarantine-exposed). It now DOES count toward
// action (recovers: 2 / covers: [BOM-27, BOM-31]), folding into the 13 OBSERVED
// RESOLVABLE and the 16 LINES_REQUIRING_ACTION totals. Its "COVERS 2 LINES"
// header is derived from `recovers` (ActionCard LICENSE special-case), kept
// neutral (not green) so it still reads as the distinct compliance axis.
//
// `covers` is the canonical action → BOM-line mapping (moved here from the
// former components/resolve/coverage.ts). Each array holds the exact lines the
// action recovers; lengths are 6 / 3 / 2 / 2 = 13 RESOLVABLE lines, none double-
// covered. All RESOLVE behaviour derives from it (see components/resolve/
// rollup.ts). Do NOT add the 3 MODELED lines (BOM-12/13/14) to any action:
// they are flagged, never resolved.
export const ACTIONS: Action[] = [
  {
    id: "ACT-EXPEDITE",
    kind: "EXPEDITE",
    title: "AIR FREIGHT REROUTE",
    recovers: 6,
    // Backend A&T at Kaohsiung / Hsinchu with finished goods on hand (BOM-01..04)
    // plus the two Taipei-distribution lines that fly out of the same airport
    // (BOM-10, BOM-11). All physically air-freightable out of the zone.
    covers: ["BOM-01", "BOM-02", "BOM-03", "BOM-04", "BOM-10", "BOM-11"],
    rationale:
      "Units already fabbed and in finished goods at Kaohsiung. Air corridors unaffected by quarantine.",
    metrics: [
      { label: "UNITS", value: "4,200" },
      { label: "INCREMENTAL COST", value: "$18,400" },
      { label: "TRANSIT", value: "4 DAYS", note: "vs 31 sea" },
      { label: "SCHEDULE IMPACT", value: "NONE" },
    ],
    cta: "GENERATE FREIGHT AUTHORIZATION",
  },
  {
    id: "ACT-SUBSTITUTE",
    kind: "SUBSTITUTE",
    title: "QUALIFIED ALTERNATE",
    recovers: 3,
    // The isolated gate-drive cluster: the three tier-2 ERP-blind catches, all
    // assembled at Kaohsiung: gate driver (BOM-07), gate-drive supply
    // transformer (BOM-08), gate-network resistor array (BOM-09). A drop-in
    // alternate moves the whole cluster to a backend outside the zone.
    covers: ["BOM-07", "BOM-08", "BOM-09"],
    rationale:
      "Alternate isolated gate driver, form-fit-function compatible. Different backend assembly footprint, no quarantine exposure.",
    metrics: [
      { label: "PIN COMPATIBLE", value: "YES" },
      { label: "ISOLATION RATING", value: "MEETS SPEC" },
      { label: "RE-QUALIFICATION", value: "3 WEEKS", warn: true },
      { label: "UNIT DELTA", value: "+$0.42" },
    ],
    warning:
      "IEC 61800-5-1 re-qualification required. Timeline assumes existing test capacity.",
    cta: "OPEN QUALIFICATION PACKET",
  },
  {
    id: "ACT-BUYAHEAD",
    kind: "BUY_AHEAD",
    title: "INVENTORY POSITION",
    recovers: 2,
    // The DC-link capacitor bank: film cap (BOM-05, $6.20) and electrolytic
    // (BOM-06, $3.10). Highest unit cost of the distribution-routed group by an
    // order of magnitude, which is what makes the capital number land.
    covers: ["BOM-05", "BOM-06"],
    rationale:
      "Lead times on affected categories forecast to extend. Historical precedent: March 2026 spike, 20-25W to 40W across top components.",
    metrics: [
      { label: "RECOMMENDED BUY", value: "11 WEEKS COVERAGE" },
      { label: "CAPITAL REQUIRED", value: "$310,000" },
      { label: "IF DELAYED 14D", value: "EST. +$95,000" },
    ],
    cta: "EXPORT PURCHASE REQUISITION",
  },
  {
    id: "ACT-LICENSE",
    kind: "LICENSE",
    title: "LICENSE PAPERWORK",
    recovers: 2,
    // Compliance axis. These two supplier lines are ownership-FLAGGED (the 50%
    // affiliates threshold), NOT quarantine-exposed, since they are logistics-CLEAR.
    // Post-reconciliation they DO count toward action: the resolution total is
    // 16 lines requiring action (14 exposed + 2 compliance) and 13 OBSERVED
    // RESOLVABLE (11 logistics + 2 compliance). Both ids are provenance OBSERVED
    // and carry ownership==="FLAGGED", which is exactly what the rollup.ts guard
    // now checks. Keep in sync with OWNERSHIP_FLAGGED in lib/data/bom.ts.
    covers: ["BOM-27", "BOM-31"],
    rationale:
      "Two suppliers cross the 50% affiliates threshold. Screening obligation attaches Nov 10 2026.",
    metrics: [
      { label: "RED FLAG 29 DILIGENCE", value: "2 SUPPLIERS" },
      { label: "LICENSE DETERMINATION", value: "REQUIRED" },
      { label: "LEAD TIME TO DECISION", value: "6-8 WEEKS" },
      { label: "IF FILED AFTER OCT 15", value: "⚠ TIMELINE AT RISK", warn: true },
    ],
    cta: "GENERATE LICENSE PACKET",
  },
];

// Honest resolution accounting. The three actions resolve the OBSERVED exposed
// lines; the 3 MODELED tier-3 lines are only FLAGGED: the product cannot claim
// to have resolved exposure it merely inferred.
export const OBSERVED_EXPOSED = BOM.filter(
  (b) => b.status === "EXPOSED" && b.provenance === "OBSERVED"
).length; // 11
export const MODELED_FLAGGED = BOM.filter(
  (b) => b.status === "EXPOSED" && b.provenance === "MODELED"
).length; // 3

/* ============================================================
   RECONCILED LINE LEDGER: the single source of truth for every
   line count shown on RADAR, EXPOSURE and RESOLVE. Derived from
   BOM + ACTIONS so the four screens cannot drift apart.

   16 lines requiring action
     = 14 quarantine-exposed        (11 OBSERVED + 3 MODELED)
     +  2 compliance-flagged        (ownership FLAGGED, logistics-CLEAR)

   Of the 16:
     13 OBSERVED RESOLVABLE  = 11 logistics OBSERVED + 2 compliance
      3 MODELED FLAGGED      = the tier-3 inferred lines (never resolved)

   Recovery must sum to OBSERVED_RESOLVABLE: 6 + 3 + 2 + 2 = 13.
   ============================================================ */

/** Ownership-FLAGGED lines (50% affiliates threshold). Logistics-CLEAR. */
export const COMPLIANCE_FLAGGED = BOM.filter(
  (b) => b.ownership === "FLAGGED"
).length; // 2

/** Every line that needs an action: quarantine-exposed OR ownership-flagged. */
export const LINES_REQUIRING_ACTION = BOM.filter(
  (b) => b.status === "EXPOSED" || b.ownership === "FLAGGED"
).length; // 16

/** The OBSERVED lines an action can resolve: logistics observed + compliance. */
export const OBSERVED_RESOLVABLE = OBSERVED_EXPOSED + COMPLIANCE_FLAGGED; // 13

/** Tier-2 lines the platform caught that the customer ERP was blind to. */
export const TIER2_CATCHES = BOM.filter(
  (b) => b.tier === 2 && b.erpBlind
).length; // 3

export const TOTAL_RECOVERED = ACTIONS.reduce((n, a) => n + a.recovers, 0); // 13
