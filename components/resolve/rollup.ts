import type { BomLine } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { ACTIONS, OBSERVED_RESOLVABLE } from "@/lib/data/actions";

/* ============================================================
   RESOLVE — rollup math & derived coverage helpers
   ------------------------------------------------------------
   The canonical action → BOM-line mapping now lives in
   lib/data/actions.ts as `Action.covers`. This module holds the
   *derived* view of it (reverse index, line-set constants,
   linesFor) plus the rollup arithmetic and the drift guard.

   Replaces the former components/resolve/coverage.ts, whose
   hardcoded ACTION_COVERAGE record has been promoted into the
   shared data contract.

   Coverage, line by line (same assignment as before):

   ACT-SUBSTITUTE  BOM-07/08/09 — the isolated gate-drive network
     (the three tier-2 ERP-blind Kaohsiung catches). 3 lines.
   ACT-EXPEDITE    BOM-01..04 (backend A&T, finished goods on hand)
     plus BOM-10/11 (Taipei-distribution, fly out of the same
     airport). 6 lines.
   ACT-BUYAHEAD    BOM-05/06 — the DC-link capacitor bank. 2 lines.

   Residual: BOM-12/13/14 are MODELED tier-3. No action claims
   them. They stay FLAGGED for the whole sequence — the product
   does not resolve exposure it merely inferred.
   ============================================================ */

/** action id → the BOM line ids it recovers, derived from Action.covers. */
export const ACTION_COVERAGE: Record<string, readonly string[]> =
  Object.fromEntries(ACTIONS.map((a) => [a.id, a.covers]));

/** Three-letter column code shown against each covered line. */
export const ACTION_CODE: Record<string, string> = {
  "ACT-EXPEDITE": "AIR",
  "ACT-SUBSTITUTE": "ALT",
  "ACT-BUYAHEAD": "BUY",
  // Compliance action (recovers 0 / covers []). Keyed here only so the log tag
  // and any header render a real code instead of `undefined`. It never appears
  // in ExposedLines (no line maps to it via LINE_TO_ACTION).
  "ACT-LICENSE": "LIC",
};

/** Reverse index: BOM line id -> the action that recovers it. */
export const LINE_TO_ACTION: Record<string, string> = ACTIONS.reduce<
  Record<string, string>
>((acc, action) => {
  action.covers.forEach((id) => {
    acc[id] = action.id;
  });
  return acc;
}, {});

/** The 14 exposed lines, in BOM order: 11 observed, then 3 modeled. */
export const EXPOSED_LINES: BomLine[] = BOM.filter((b) => b.status === "EXPOSED");
export const OBSERVED_LINES = EXPOSED_LINES.filter(
  (b) => b.provenance === "OBSERVED"
);
export const MODELED_LINES = EXPOSED_LINES.filter(
  (b) => b.provenance === "MODELED"
);
/**
 * Compliance lines: ownership-FLAGGED but NOT quarantine-exposed. A separate
 * axis from logistics exposure, resolved by the LICENSE action. These bring the
 * left rail to 16 (11 observed + 2 compliance + 3 modeled) and the resolvable
 * count to 13 (11 + 2). See LINES_REQUIRING_ACTION / OBSERVED_RESOLVABLE.
 */
export const COMPLIANCE_LINES = BOM.filter(
  (b) => b.ownership === "FLAGGED" && b.status !== "EXPOSED"
);

export function linesFor(actionId: string): BomLine[] {
  const ids = ACTION_COVERAGE[actionId] ?? [];
  return ids
    .map((id) => BOM.find((b) => b.id === id))
    .filter((b): b is BomLine => Boolean(b));
}

/* ---- rollup contributions (right panel) --------------------
   Every figure below is arithmetic on numbers that already exist
   in ACTIONS.metrics or bom.ts. Nothing is invented here.

   incrementalCost
     EXPEDITE   $18,400            INCREMENTAL COST, verbatim.
     SUBSTITUTE $0.42 unit delta x 6 pcs/unit (BOM-07 qtyPerUnit)
                x 4,200 units      = $10,584.
     BUY_AHEAD  $0                 the buy is capital, not expense.

   capital
     BUY_AHEAD  $310,000           CAPITAL REQUIRED, verbatim.

   scheduleWeeks
     SUBSTITUTE 3                  RE-QUALIFICATION, verbatim.
     others     0                  SCHEDULE IMPACT: NONE.

   daysGained (days-to-halt climbs by this as each action fires)
     EXPEDITE   31 - 4  = 27       sea transit collapses to air.
     SUBSTITUTE 3 x 7   = 21       the alternate turns an open-ended
                                   quarantine wait into a bounded
                                   3-week qualification path.
     BUY_AHEAD  11 x 7  = 77       11 weeks forward coverage.
   ------------------------------------------------------------ */

export interface ActionRollup {
  incrementalCost: number;
  capital: number;
  scheduleWeeks: number;
  daysGained: number;
}

export const ACTION_ROLLUP: Record<string, ActionRollup> = {
  "ACT-EXPEDITE": {
    incrementalCost: 18_400,
    capital: 0,
    scheduleWeeks: 0,
    daysGained: 31 - 4,
  },
  "ACT-SUBSTITUTE": {
    incrementalCost: Math.round(0.42 * 6 * 4200),
    capital: 0,
    scheduleWeeks: 3,
    daysGained: 3 * 7,
  },
  "ACT-BUYAHEAD": {
    incrementalCost: 0,
    capital: 310_000,
    scheduleWeeks: 0,
    daysGained: 11 * 7,
  },
  // Compliance action: recovers 2 lines but adds no cost/capital/schedule/days
  // — filing the affiliates-screening packet doesn't move the logistics halt
  // date. Present (not skipped) so its 2 covered lines DO count in the rollup's
  // line total (13 = 11 logistics + 2 compliance).
  "ACT-LICENSE": {
    incrementalCost: 0,
    capital: 0,
    scheduleWeeks: 0,
    daysGained: 0,
  },
};

export interface Rollup {
  lines: number;
  incrementalCost: number;
  capital: number;
  scheduleWeeks: number;
  daysGained: number;
}

export const EMPTY_ROLLUP: Rollup = {
  lines: 0,
  incrementalCost: 0,
  capital: 0,
  scheduleWeeks: 0,
  daysGained: 0,
};

export function rollup(actionedIds: ReadonlySet<string>): Rollup {
  return ACTIONS.filter((a) => actionedIds.has(a.id)).reduce<Rollup>(
    (acc, a) => {
      // Compliance actions (e.g. ACT-LICENSE) have no ACTION_ROLLUP entry — they
      // sit outside the logistics recovery accounting. Skip so a 0-line, 0-cost
      // action can be actioned without dereferencing undefined and crashing.
      const r = ACTION_ROLLUP[a.id];
      if (!r) return acc;
      return {
        // line count is canonical: it comes from the covers mapping
        lines: acc.lines + a.covers.length,
        incrementalCost: acc.incrementalCost + r.incrementalCost,
        capital: acc.capital + r.capital,
        // schedule impact is the longest single delay, not a sum
        scheduleWeeks: Math.max(acc.scheduleWeeks, r.scheduleWeeks),
        daysGained: acc.daysGained + r.daysGained,
      };
    },
    EMPTY_ROLLUP
  );
}

/** Currency, comma-separated, no cents (DESIGN.md §3). */
export function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/* ---- dev-time guard against silent drift -------------------
   Post-reconciliation the actions recover the OBSERVED_RESOLVABLE lines:
   6 + 3 + 2 (logistics) + 2 (compliance) = 13, derived — no magic number.
   Every covered line must be provenance OBSERVED and be resolvable, i.e.
   either quarantine-EXPOSED (logistics) or ownership-FLAGGED (compliance);
   a MODELED tier-3 line must never be covered. No line may be double-covered,
   and each action's covers length must equal its `recovers`. If actions.ts
   drifts, this throws at import. */
export const COVERAGE_ASSERTIONS = (() => {
  const covered = Object.values(ACTION_COVERAGE).flat();
  const isResolvable = (id: string) => {
    const b = BOM.find((x) => x.id === id);
    return (
      !!b &&
      b.provenance === "OBSERVED" &&
      (b.status === "EXPOSED" || b.ownership === "FLAGGED")
    );
  };
  const assertions = {
    covered: covered.length, // 13
    unique: new Set(covered).size, // 13 — no line claimed twice
    expected: OBSERVED_RESOLVABLE, // 13, derived from BOM
    countsMatch: ACTIONS.every(
      (a) => (ACTION_COVERAGE[a.id] ?? []).length === a.recovers
    ),
    allResolvable: covered.every(isResolvable),
  };
  if (
    assertions.covered !== assertions.expected ||
    assertions.unique !== assertions.covered ||
    !assertions.countsMatch ||
    !assertions.allResolvable
  ) {
    throw new Error(
      `RESOLVE coverage drift — expected ${OBSERVED_RESOLVABLE} OBSERVED RESOLVABLE lines (11 logistics + 2 compliance), no double-cover: ${JSON.stringify(
        assertions
      )}`
    );
  }
  return assertions;
})();
