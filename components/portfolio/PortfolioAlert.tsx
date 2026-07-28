"use client";

import Link from "next/link";
import { PRIMARY_EVENT } from "@/lib/data/event";
import {
  riskLabel,
  type PortfolioProduct,
  type PortfolioRollup,
} from "@/lib/data/portfolio";
import { BAND_INSET } from "@/components/portfolio/layout";

/* ============================================================
   The single alert band. It is the reason this screen is a landing
   screen rather than a table.

   Both states occupy the SAME height and the same two lines. The screen
   resolves from quiet to live once, on mount, and if the band grew or
   appeared at that moment the rows below it would resize too, which is a
   second event competing with the first. Holding the box and swapping
   only its contents keeps it to one change, and keeps the frame readable
   when it is paused.

   WHAT IT SAYS. The portfolio-wide figure, then the product carrying most
   of it. Every product has a resolved BOM, so the total is a confirmed
   count of exposed lines and a confirmed slice of the quarter's build,
   not a supplier-level screen with a caveat attached. The band used to
   have to hedge in violet about screened products; there is nothing left
   to hedge about, so it states the number and names the worst hit.
   ============================================================ */

// PRIMARY_EVENT.headline is the authored event name and stays the source of
// truth for it; the separator is normalized on the way out so the band reads
// in this screen's punctuation.
const EVENT_NAME = PRIMARY_EVENT.headline.replace(/\s*\u2014\s*/g, " · ");

export function PortfolioAlert({
  live,
  totals,
  worst,
  simulatedLabel,
}: {
  live: boolean;
  /** Reduced over the rows the table renders. Never authored. */
  totals: PortfolioRollup;
  /** The product carrying the most value at risk. */
  worst: PortfolioProduct;
  /** Non-null when the simulate control is off its default: the band names
   *  the simulated scenario instead of the scripted event, so the screen
   *  never attributes simulated numbers to the real incident. */
  simulatedLabel?: string | null;
}) {
  if (!live || (simulatedLabel && totals.exposedLines === 0)) {
    return (
      <div
        className="flex shrink-0 items-center justify-between border-b border-rule pl-4 py-3"
        style={BAND_INSET}
      >
        <div className="min-w-0">
          <div className="text-value leading-tight text-secondary">
            ● PORTFOLIO WATCH{simulatedLabel ? ` · ${simulatedLabel}` : ""}
          </div>
          <div className="text-body text-dim">
            {simulatedLabel
              ? `Simulated scenario touches no resolved supply path. ` +
                `${totals.products} products, ${totals.bomLines} lines, all clear of the affected node.`
              : `No active incident. Monitoring ${totals.products} products against ` +
                `${totals.bomLines} resolved bill-of-materials lines.`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-between gap-4 border-b border-rule pl-4 py-3"
      style={{
        ...BAND_INSET,
        borderLeft: "2px solid var(--critical)",
        background: "color-mix(in srgb, var(--critical) 8%, transparent)",
      }}
      role="status"
    >
      <div className="min-w-0">
        <div
          className="truncate text-value leading-tight"
          style={{ color: "var(--critical)", fontWeight: 600 }}
        >
          ▲ {simulatedLabel ?? EVENT_NAME}
        </div>
        {/* One template string, not a run of JSX text nodes. The band is a
            sentence with eight interpolations in it and JSX whitespace between
            an expression and the text after it is one edit away from
            disappearing, which is how "$6.3Mof this quarter" happens. */}
        <div className="truncate text-body text-primary">
          {`${totals.exposedLines} of ${totals.bomLines} lines exposed across ` +
            `${totals.products} products, ${riskLabel(totals.revenueAtRisk)} of ` +
            `this quarter\u2019s ${riskLabel(totals.quarterlyBuildValue)} build. ` +
            `${worst.code} is worst hit: ${worst.exposedLines} of ${worst.bomLines} ` +
            `lines, ${riskLabel(worst.revenueAtRisk)}, ${worst.daysToHalt} days to halt.`}
        </div>
      </div>

      <Link
        href="/app/radar"
        className="label shrink-0 border px-3 py-1.5 transition-colors hover:bg-elevated"
        style={{
          color: "var(--interactive)",
          borderColor: "var(--interactive-dim)",
          borderRadius: "var(--radius-max)",
        }}
      >
        OPEN RADAR ›
      </Link>
    </div>
  );
}
