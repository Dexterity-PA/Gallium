import { CUSTOMER } from "@/lib/data/customer";
import { deriveImpact, baselineImpact, buildAtRiskLabel } from "@/lib/derive/impact";

/* ============================================================
   PORTFOLIO - Meridian's product line, one row per product.

   This is the landing screen: the state a procurement lead sees before
   anyone has clicked anything. It answers "which of my products is on
   fire", which is the question a single-BOM view cannot answer.

   TWO TIERS OF KNOWLEDGE, and the table is explicit about which is which.

     INGESTED (MD-7200 only). Its bill of materials has been resolved line
     by line, so every figure on that row is the real derivation the rest
     of the app runs on. Nothing about MD-7200 is authored here: the row
     is built from lib/derive/impact.ts and lib/data/customer.ts at module
     load, so it cannot drift from the EXPOSURE screen. See MD7200 below
     and the guard at the bottom of this file.

     SCREENED (the other six). Their BOMs have not been ingested. What
     Meridian's ERP does hold for them is a header record: line count and
     quarterly build value. Gallium screens each product's supplier list
     against the quarantine zone, which yields an ESTIMATED exposed-line
     count and therefore an estimated value at risk. It does NOT yield
     days-to-halt, because that needs per-line lead times, which need the
     BOM. So `daysToHalt` is null on all six and the UI says so rather
     than inventing a number.

   The six products are fictional, like the rest of the scenario. Their
   exposure is deliberately uneven: two clean, two mild, two significant.
   A product line where every product carries the same exposure is not a
   product line, it is a template.
   ============================================================ */

export type PortfolioStatus = "EXPOSED" | "MONITORED" | "NOT INGESTED";

export interface PortfolioProduct {
  code: string;
  description: string;
  bomLines: number;
  /** This quarter's build value for the product. ERP header record. */
  quarterlyBuildValue: number;
  /** Line-level BOM ingest complete. Only the focus product is. */
  ingested: boolean;
  /** EXPOSED lines. Derived for the ingested row, screened estimate otherwise. */
  exposedLines: number;
  /** Build value exposed. See riskFor(). */
  revenueAtRisk: number;
  /** null when it cannot be computed without per-line lead times. */
  daysToHalt: number | null;
  status: PortfolioStatus;
}

// The same formula lib/derive/impact.ts buildAtRisk() applies to MD-7200,
// generalized to a product that carries its own build value: a unit cannot
// ship without every line on its BOM, so the value exposed is the exposed
// fraction of lines applied to the quarter's build. Using one formula for
// all seven rows is the point. A second, nicer-looking formula for the six
// screened products would make the column incomparable down its own length.
function riskFor(quarterlyBuildValue: number, exposed: number, lines: number): number {
  if (lines <= 0) return 0;
  return quarterlyBuildValue * (exposed / lines);
}

/* ---- the six screened products ----------------------------------------
   Authored: line count, quarterly build value, and the screening hit count.
   Everything else on these rows is computed from those three fields.

   Spread, by design:
     MD-5100  significant   9 of 27 lines, a third of the build exposed
     MX-880   significant  10 of 41
     MD-3400  mild          3 of 23
     PS-2400  mild          2 of 37
     MD-9600  clean         0 of 52  (the largest build in the line, untouched)
     HV-1150  clean         0 of 19
   ---------------------------------------------------------------------- */
interface ScreenedSeed {
  code: string;
  description: string;
  bomLines: number;
  quarterlyBuildValue: number;
  /** Supplier-list screening hits against the quarantine zone. */
  screenedExposedLines: number;
}

const SCREENED: ScreenedSeed[] = [
  {
    code: "MD-5100",
    description: "3-phase VFD, 400 VAC, 11 kW class",
    bomLines: 27,
    quarterlyBuildValue: 4_400_000,
    screenedExposedLines: 9,
  },
  {
    code: "MX-880",
    description: "Active front end, regenerative line module",
    bomLines: 41,
    quarterlyBuildValue: 3_200_000,
    screenedExposedLines: 10,
  },
  {
    code: "MD-3400",
    description: "Single-phase micro drive, 2.2 kW class",
    bomLines: 23,
    quarterlyBuildValue: 2_600_000,
    screenedExposedLines: 3,
  },
  {
    code: "PS-2400",
    description: "Pump control panel, soft start and bypass",
    bomLines: 37,
    quarterlyBuildValue: 1_900_000,
    screenedExposedLines: 2,
  },
  {
    code: "MD-9600",
    description: "3-phase VFD, 690 VAC, 160 kW class",
    bomLines: 52,
    quarterlyBuildValue: 5_800_000,
    screenedExposedLines: 0,
  },
  {
    code: "HV-1150",
    description: "HVAC fan-coil drive, 1.5 kW class",
    bomLines: 19,
    quarterlyBuildValue: 2_200_000,
    screenedExposedLines: 0,
  },
];

const SCREENED_ROWS: PortfolioProduct[] = SCREENED.map((s) => ({
  code: s.code,
  description: s.description,
  bomLines: s.bomLines,
  quarterlyBuildValue: s.quarterlyBuildValue,
  ingested: false,
  exposedLines: s.screenedExposedLines,
  revenueAtRisk: riskFor(s.quarterlyBuildValue, s.screenedExposedLines, s.bomLines),
  daysToHalt: null, // needs per-line lead times, which need the BOM
  status: "NOT INGESTED",
}));

/* ---- MD-7200: the ingested row ----------------------------------------
   Not authored. Both states below are read out of the same derivation the
   EXPOSURE and RADAR screens run on, so this row cannot say something the
   BOM does not. `live` is baselineImpact() (the scripted Kaohsiung
   quarantine, BOM.filter(status === "EXPOSED")); `quiet` is the same
   derivation with no exposed lines, which is how the pre-incident days-to-
   halt figure comes out at the full untouched buffer instead of a literal.
   ---------------------------------------------------------------------- */
const LIVE_IMPACT = baselineImpact();
const QUIET_IMPACT = deriveImpact([]);

const FOCUS = CUSTOMER.focusProduct;

function focusRow(
  exposedLines: number,
  revenueAtRisk: number,
  days: number,
  status: PortfolioStatus
): PortfolioProduct {
  return {
    code: FOCUS.line,
    description: FOCUS.description,
    bomLines: FOCUS.bomLines,
    quarterlyBuildValue: FOCUS.quarterlyBuildValue,
    ingested: true,
    exposedLines,
    revenueAtRisk,
    daysToHalt: days,
    status,
  };
}

/** MD-7200 after the Kaohsiung quarantine lands. Every figure derived. */
export const FOCUS_LIVE: PortfolioProduct = focusRow(
  LIVE_IMPACT.bomLinesExposed,
  LIVE_IMPACT.buildAtRisk,
  LIVE_IMPACT.daysToHalt,
  "EXPOSED"
);

/** MD-7200 before it lands: ingested and watched, nothing exposed yet. */
export const FOCUS_QUIET: PortfolioProduct = focusRow(
  QUIET_IMPACT.bomLinesExposed,
  QUIET_IMPACT.buildAtRisk,
  QUIET_IMPACT.daysToHalt,
  "MONITORED"
);

/* ---- row order --------------------------------------------------------
   Ranked by value at risk, descending, computed ONCE against the live
   state and then held fixed. The screen resolves from quiet to live on
   mount, and if the sort were recomputed per state MD-7200 would leap
   from last place to first as the alert fires. A table that reorders
   itself under the viewer is a different (and worse) event than a row
   going hot in place. Ties break on build value, so the two clean
   products sit largest-first rather than in authoring order.
   ---------------------------------------------------------------------- */
export const PORTFOLIO: PortfolioProduct[] = [FOCUS_LIVE, ...SCREENED_ROWS].sort(
  (a, b) => b.revenueAtRisk - a.revenueAtRisk || b.quarterlyBuildValue - a.quarterlyBuildValue
);

/** Index of the one ingested, clickable row. Drives the swap on mount. */
export const FOCUS_INDEX = PORTFOLIO.findIndex((p) => p.code === FOCUS.line);

/* ---- rollup -----------------------------------------------------------
   Reduced over the rows above, never authored. `ingestedCount` is what
   makes the screen a sales argument rather than a status board: one of
   seven products is actually resolved.
   ---------------------------------------------------------------------- */
export interface PortfolioRollup {
  products: number;
  ingested: number;
  bomLines: number;
  exposedLines: number;
  revenueAtRisk: number;
  quarterlyBuildValue: number;
}

/* ---- confirmed vs screened --------------------------------------------
   The rollup above sums all seven rows, which is the right reduction for
   PRODUCTS and BOM LINES: a line count is a line count whether or not the
   BOM behind it has been ingested.

   It is the WRONG reduction for exposure. Six of the seven products carry
   a supplier-level screen, not a resolved BOM, so a combined exposed-line
   or value-at-risk total is mostly inferred while presenting as a single
   fact. Summed, the largest figure on the screen would also be its least
   supported one, and it would contradict the alert band in the same frame.

   So exposure splits in two and never recombines. Confirmed is the
   ingested product, line by line. Screened is everything the supplier
   lists merely suggest. Both come off the same rows the table renders,
   so the strip cannot drift from the blotter under it.
   ---------------------------------------------------------------------- */
export interface ExposureSplit {
  /** Exposed lines on the resolved BOM. Observed. */
  confirmedLines: number;
  /** Build value behind those lines. Observed. */
  confirmedValue: number;
  /** Exposed lines suggested by supplier screening. Inferred. */
  screenedLines: number;
  /** Build value behind those. Inferred. */
  screenedValue: number;
  /** How many non-ingested products returned at least one screening hit. */
  screenedProducts: number;
}

export function splitExposure(rows: PortfolioProduct[]): ExposureSplit {
  const split: ExposureSplit = {
    confirmedLines: 0,
    confirmedValue: 0,
    screenedLines: 0,
    screenedValue: 0,
    screenedProducts: 0,
  };

  for (const p of rows) {
    if (p.ingested) {
      split.confirmedLines += p.exposedLines;
      split.confirmedValue += p.revenueAtRisk;
    } else {
      split.screenedLines += p.exposedLines;
      split.screenedValue += p.revenueAtRisk;
      // A product screened clean is not a screened product with exposure,
      // and the alert band counts affected lines, not scanned ones.
      if (p.exposedLines > 0) split.screenedProducts += 1;
    }
  }

  return split;
}

export function rollup(rows: PortfolioProduct[]): PortfolioRollup {
  return rows.reduce<PortfolioRollup>(
    (acc, p) => ({
      products: acc.products + 1,
      ingested: acc.ingested + (p.ingested ? 1 : 0),
      bomLines: acc.bomLines + p.bomLines,
      exposedLines: acc.exposedLines + p.exposedLines,
      revenueAtRisk: acc.revenueAtRisk + p.revenueAtRisk,
      quarterlyBuildValue: acc.quarterlyBuildValue + p.quarterlyBuildValue,
    }),
    {
      products: 0,
      ingested: 0,
      bomLines: 0,
      exposedLines: 0,
      revenueAtRisk: 0,
      quarterlyBuildValue: 0,
    }
  );
}

/* ---- formatting -------------------------------------------------------
   Non-zero values go through the app's existing buildAtRiskLabel, so
   MD-7200 reads the same string here that RADAR's impact panel reads.
   Zero gets "$0" rather than "$0.0M": a clean product's value at risk is
   exactly nothing, and one decimal place of nothing invites a second look.
   ---------------------------------------------------------------------- */
export function riskLabel(n: number): string {
  return n <= 0 ? "$0" : buildAtRiskLabel(n);
}

/** Shown wherever a figure is a supplier-level screen, not a line-level fact. */
export const ESTIMATE_MARK = "~";

/** No value, and no honest way to compute one. */
export const NO_VALUE = "n/a";

/* ---- guard ------------------------------------------------------------
   The whole point of the MD-7200 row is that it agrees with EXPOSURE. It
   is built from the derivation rather than copied, so it cannot silently
   drift, but a guard that fails loudly at module load beats trusting that
   nobody ever pastes a literal in here later. Mirrors the drift guards
   already in lib/data.
   ---------------------------------------------------------------------- */
{
  const live = PORTFOLIO[FOCUS_INDEX];
  if (!live) {
    throw new Error("PORTFOLIO: focus product row is missing");
  }
  if (live.bomLines !== LIVE_IMPACT.bomLinesTotal) {
    throw new Error(
      `PORTFOLIO: ${FOCUS.line} BOM line count ${live.bomLines} does not match ` +
        `the resolved BOM (${LIVE_IMPACT.bomLinesTotal})`
    );
  }
  if (live.exposedLines !== LIVE_IMPACT.bomLinesExposed) {
    throw new Error(
      `PORTFOLIO: ${FOCUS.line} exposed count ${live.exposedLines} does not match ` +
        `EXPOSURE (${LIVE_IMPACT.bomLinesExposed})`
    );
  }
  if (live.daysToHalt !== LIVE_IMPACT.daysToHalt) {
    throw new Error(
      `PORTFOLIO: ${FOCUS.line} days-to-halt ${live.daysToHalt} does not match ` +
        `the derived figure (${LIVE_IMPACT.daysToHalt})`
    );
  }
  if (riskLabel(live.revenueAtRisk) !== LIVE_IMPACT.buildAtRiskLabel) {
    throw new Error(
      `PORTFOLIO: ${FOCUS.line} value at risk ${riskLabel(live.revenueAtRisk)} does ` +
        `not match the derived figure (${LIVE_IMPACT.buildAtRiskLabel})`
    );
  }
  if (PORTFOLIO.filter((p) => p.ingested).length !== 1) {
    throw new Error("PORTFOLIO: exactly one product may be line-level ingested");
  }

  // Every authored product reaches the table. The header claims a product
  // count and the blotter has to render that many rows; a filter or slice
  // that quietly drops one is how row 7 goes missing.
  if (PORTFOLIO.length !== SCREENED.length + 1) {
    throw new Error(
      `PORTFOLIO: ${PORTFOLIO.length} rows built from ${SCREENED.length + 1} products`
    );
  }

  // The split is a partition, not a reinterpretation: it must account for
  // exactly what the rollup sums and nothing more. If these ever disagree,
  // the strip is showing a number no row supports.
  const split = splitExposure(PORTFOLIO);
  const totals = rollup(PORTFOLIO);
  if (split.confirmedLines + split.screenedLines !== totals.exposedLines) {
    throw new Error(
      `PORTFOLIO: exposure split (${split.confirmedLines} + ${split.screenedLines}) ` +
        `does not account for ${totals.exposedLines} exposed lines`
    );
  }
  // Sub-dollar tolerance: the screened values are fractions of a build.
  if (Math.abs(split.confirmedValue + split.screenedValue - totals.revenueAtRisk) > 1) {
    throw new Error(
      "PORTFOLIO: exposure split does not account for the total value at risk"
    );
  }
  if (split.confirmedLines !== LIVE_IMPACT.bomLinesExposed) {
    throw new Error(
      `PORTFOLIO: confirmed exposure ${split.confirmedLines} does not match ` +
        `EXPOSURE (${LIVE_IMPACT.bomLinesExposed})`
    );
  }
}
