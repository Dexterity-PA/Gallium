import { CUSTOMER } from "@/lib/data/customer";
import { PRODUCTS, type Product } from "@/lib/data/products";
import { productExposure, riskFor } from "@/lib/derive/exposure";
import { baselineImpact, buildAtRiskLabel } from "@/lib/derive/impact";
import {
  affectedRadius,
  scenarioStatus,
  scenarioHalt,
} from "@/lib/derive/scenario";
import {
  type ScenarioControlState,
  isDefaultScenarioControl,
} from "@/lib/data/scenario";

/* ============================================================
   PORTFOLIO - Meridian's product line, one row per product.

   This is the landing screen: the state a procurement lead sees before
   anyone has clicked anything. It answers "which of my products is on
   fire", which is the question a single-BOM view cannot answer.

   ONE TIER OF KNOWLEDGE, not two. Every product carries a resolved bill
   of materials now (lib/data/products.ts), so every figure in the table
   is the same kind of claim: exposed lines walked line by line, value at
   risk from the exposed fraction of the build, days to halt from the
   longest-lead exposed line against Meridian's buffer. There used to be a
   split here, an ingested product and six supplier-level screens with
   tildes and n/a in the days column, and it was the honest thing to show
   while six BOMs were missing. They are not missing.

   NOTHING BELOW IS AUTHORED except each product's quarterly build value,
   which is an ERP header record and not an exposure claim. Every row is
   lib/derive/exposure.ts run over that product's BOM, and the rollup is
   a reduction over the rows the table renders. See the guard at the
   bottom of this file.
   ============================================================ */

export type PortfolioStatus = "EXPOSED" | "MONITORED";

export interface PortfolioProduct {
  code: string;
  description: string;
  bomLines: number;
  /** This quarter's build value for the product. ERP header record. */
  quarterlyBuildValue: number;
  /** EXPOSED lines on the resolved BOM. Derived. */
  exposedLines: number;
  /** How many of those are MODELED sub-tier inputs rather than observed parts. */
  modeledExposed: number;
  /** Build value exposed. Derived. */
  revenueAtRisk: number;
  /** Runway in days, against the same buffer every other screen uses. */
  daysToHalt: number;
  status: PortfolioStatus;
}

function rowFor(p: Product): PortfolioProduct {
  const e = productExposure(p.lines, p.quarterlyBuildValue);
  return {
    code: p.code,
    description: p.description,
    bomLines: e.lines,
    quarterlyBuildValue: p.quarterlyBuildValue,
    exposedLines: e.exposedLines,
    modeledExposed: e.modeledExposed,
    revenueAtRisk: e.valueAtRisk,
    daysToHalt: e.daysToHalt,
    status: e.exposedLines > 0 ? "EXPOSED" : "MONITORED",
  };
}

/* ---- the two states ---------------------------------------------------
   The screen mounts quiet and resolves ONCE to the state where the
   Kaohsiung quarantine has already landed. Quiet is not a second set of
   authored numbers: it is the SAME computation with nothing inside the
   zone, which is what "before it happened" means. Days to halt therefore
   comes back at the full untouched buffer rather than as a literal 70,
   and value at risk at exactly nothing.
   ---------------------------------------------------------------------- */
function quietRowFor(p: Product): PortfolioProduct {
  const pre = p.lines.map((l) => ({ ...l, status: "CLEAR" as const }));
  const e = productExposure(pre, p.quarterlyBuildValue);
  return {
    code: p.code,
    description: p.description,
    bomLines: e.lines,
    quarterlyBuildValue: p.quarterlyBuildValue,
    exposedLines: e.exposedLines,
    modeledExposed: e.modeledExposed,
    revenueAtRisk: e.valueAtRisk,
    daysToHalt: e.daysToHalt,
    status: "MONITORED",
  };
}

/* ---- row order --------------------------------------------------------
   Ranked by value at risk, descending, computed ONCE against the live
   state and then held fixed. The screen resolves from quiet to live on
   mount, and if the sort were recomputed per state the whole table would
   reorder itself under the viewer as the alert fires. A table that
   re-sorts is a different (and worse) event than rows going hot in place.
   Ties break on build value.
   ---------------------------------------------------------------------- */
export const PORTFOLIO: PortfolioProduct[] = PRODUCTS.map(rowFor).sort(
  (a, b) => b.revenueAtRisk - a.revenueAtRisk || b.quarterlyBuildValue - a.quarterlyBuildValue
);

/** The same seven products in the same order, before the quarantine lands. */
export const PORTFOLIO_QUIET: PortfolioProduct[] = PORTFOLIO.map((row) => {
  const product = PRODUCTS.find((p) => p.code === row.code)!;
  return quietRowFor(product);
});

/* ---- the scenario view ------------------------------------------------
   All seven products run through the SAME exposure function the simulate
   control drives on RADAR: per-line supply-path membership inside the
   scenario's affected radius (lib/derive/scenario.ts), the same value-at-
   risk fraction, and the same hold-aware runway. Row order stays pinned to
   the default ranking so the table never re-sorts under the viewer while
   they move the control; rows go hot or cold in place.

   At the default control this reproduces PORTFOLIO exactly, and the guard
   in lib/derive/guards.ts fails the build if it ever stops doing so. */
export function portfolioFor(control: ScenarioControlState): PortfolioProduct[] {
  // Same-object return at the default is an identity optimization only:
  // computePortfolioFor(default) is guarded equal to PORTFOLIO, so this is
  // never a semantic special case.
  if (isDefaultScenarioControl(control)) return PORTFOLIO;
  return computePortfolioFor(control);
}

/** The un-shortcut computation, exported so lib/derive/guards.ts can prove
 *  the scenario path reproduces PORTFOLIO at the default control. */
export function computePortfolioFor(control: ScenarioControlState): PortfolioProduct[] {
  const radius = affectedRadius(control.originId, control.severity);
  return PORTFOLIO.map((row) => {
    const product = PRODUCTS.find((p) => p.code === row.code)!;
    const exposed = product.lines.filter(
      (l) => scenarioStatus(l, radius) === "EXPOSED"
    );
    const halt = scenarioHalt(exposed, control);
    return {
      code: product.code,
      description: product.description,
      bomLines: product.lines.length,
      quarterlyBuildValue: product.quarterlyBuildValue,
      exposedLines: exposed.length,
      modeledExposed: exposed.filter((l) => l.provenance === "MODELED").length,
      revenueAtRisk: riskFor(
        product.quarterlyBuildValue,
        exposed.length,
        product.lines.length
      ),
      daysToHalt: halt.daysToHalt,
      status: exposed.length > 0 ? "EXPOSED" : "MONITORED",
    };
  });
}

const FOCUS = CUSTOMER.focusProduct;

/** Index of the focus product. Its row still has to reconcile with EXPOSURE. */
export const FOCUS_INDEX = PORTFOLIO.findIndex((p) => p.code === FOCUS.line);

/** The worst-hit product, by value at risk. The alert band names it. */
export const WORST_HIT: PortfolioProduct = PORTFOLIO[0];

/* ---- rollup -----------------------------------------------------------
   Reduced over the rows above, never authored.
   ---------------------------------------------------------------------- */
export interface PortfolioRollup {
  products: number;
  bomLines: number;
  exposedLines: number;
  revenueAtRisk: number;
  quarterlyBuildValue: number;
  /** The soonest halt across the line, and the product that sets it. */
  daysToHalt: number;
  soonestHalt: string;
}

export function rollup(rows: PortfolioProduct[]): PortfolioRollup {
  const soonest = rows.reduce((a, b) => (b.daysToHalt < a.daysToHalt ? b : a), rows[0]);
  return rows.reduce<PortfolioRollup>(
    (acc, p) => ({
      ...acc,
      products: acc.products + 1,
      bomLines: acc.bomLines + p.bomLines,
      exposedLines: acc.exposedLines + p.exposedLines,
      revenueAtRisk: acc.revenueAtRisk + p.revenueAtRisk,
      quarterlyBuildValue: acc.quarterlyBuildValue + p.quarterlyBuildValue,
    }),
    {
      products: 0,
      bomLines: 0,
      exposedLines: 0,
      revenueAtRisk: 0,
      quarterlyBuildValue: 0,
      daysToHalt: soonest.daysToHalt,
      soonestHalt: soonest.code,
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

/* ---- guard ------------------------------------------------------------
   Two things have to hold, and both used to be checked against a split
   that no longer exists.

   1. The rollup is a reduction over the rendered rows and nothing else.
      Recomputed here the dumb way and compared, so a future edit that
      slips a constant into the strip fails at module load rather than on
      camera.
   2. MD-7200's row still agrees with EXPOSURE, RESOLVE and its own
      module-load guard. It is built from the derivation rather than
      copied, so it cannot silently drift, but the flagship's four numbers
      are quoted on four other screens and this is the cheapest place to
      catch a break.
   ---------------------------------------------------------------------- */
{
  const totals = rollup(PORTFOLIO);

  if (PORTFOLIO.length !== PRODUCTS.length) {
    throw new Error(
      `PORTFOLIO: ${PORTFOLIO.length} rows built from ${PRODUCTS.length} products`
    );
  }
  if (PORTFOLIO_QUIET.length !== PORTFOLIO.length) {
    throw new Error("PORTFOLIO: the quiet state does not cover every row");
  }

  const sum = (pick: (p: PortfolioProduct) => number) =>
    PORTFOLIO.reduce((n, p) => n + pick(p), 0);
  if (
    totals.bomLines !== sum((p) => p.bomLines) ||
    totals.exposedLines !== sum((p) => p.exposedLines) ||
    Math.abs(totals.revenueAtRisk - sum((p) => p.revenueAtRisk)) > 1 ||
    totals.quarterlyBuildValue !== sum((p) => p.quarterlyBuildValue)
  ) {
    throw new Error("PORTFOLIO: the rollup does not equal the sum over the rendered rows");
  }
  if (totals.daysToHalt !== Math.min(...PORTFOLIO.map((p) => p.daysToHalt))) {
    throw new Error("PORTFOLIO: the rollup runway is not the soonest halt in the line");
  }

  const live = PORTFOLIO[FOCUS_INDEX];
  const impact = baselineImpact();
  if (!live) {
    throw new Error("PORTFOLIO: focus product row is missing");
  }
  if (live.bomLines !== impact.bomLinesTotal) {
    throw new Error(
      `PORTFOLIO: ${FOCUS.line} BOM line count ${live.bomLines} does not match ` +
        `the resolved BOM (${impact.bomLinesTotal})`
    );
  }
  if (live.exposedLines !== impact.bomLinesExposed) {
    throw new Error(
      `PORTFOLIO: ${FOCUS.line} exposed count ${live.exposedLines} does not match ` +
        `EXPOSURE (${impact.bomLinesExposed})`
    );
  }
  if (live.daysToHalt !== impact.daysToHalt) {
    throw new Error(
      `PORTFOLIO: ${FOCUS.line} days-to-halt ${live.daysToHalt} does not match ` +
        `the derived figure (${impact.daysToHalt})`
    );
  }
  if (riskLabel(live.revenueAtRisk) !== impact.buildAtRiskLabel) {
    throw new Error(
      `PORTFOLIO: ${FOCUS.line} value at risk ${riskLabel(live.revenueAtRisk)} does ` +
        `not match the derived figure (${impact.buildAtRiskLabel})`
    );
  }
}
