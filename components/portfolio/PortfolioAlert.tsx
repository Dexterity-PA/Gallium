"use client";

import Link from "next/link";
import { PRIMARY_EVENT } from "@/lib/data/event";
import { riskLabel, type PortfolioProduct } from "@/lib/data/portfolio";
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
   ============================================================ */

// PRIMARY_EVENT.headline is the authored event name and stays the source of
// truth for it; the separator is normalized on the way out so the band reads
// in this screen's punctuation.
const EVENT_NAME = PRIMARY_EVENT.headline.replace(/\s*\u2014\s*/g, " · ");

export function PortfolioAlert({
  live,
  focus,
  screenedProducts,
}: {
  live: boolean;
  focus: PortfolioProduct;
  /** Non-ingested products carrying at least one screening hit. Derived. */
  screenedProducts: number;
}) {
  if (!live) {
    return (
      <div
        className="flex shrink-0 items-center justify-between border-b border-rule pl-4 py-3"
        style={BAND_INSET}
      >
        <div className="min-w-0">
          <div className="text-value leading-tight text-secondary">
            ● PORTFOLIO WATCH
          </div>
          <div className="text-body text-dim">
            No active incident. Monitoring seven products against the resolved{" "}
            {focus.code} bill of materials and supplier-level screens.
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
          ▲ {EVENT_NAME}
        </div>
        <div className="truncate text-body text-primary">
          {focus.code} is exposed: {focus.exposedLines} of {focus.bomLines} lines,{" "}
          {riskLabel(focus.revenueAtRisk)} of this quarter&rsquo;s build,{" "}
          {focus.daysToHalt} days to halt.{" "}
          {/* The screened clause is a claim about inferred data and is
              coloured as one (tokens.css RULE 2). It replaces a flat "no
              other product line is affected", which the six supplier
              screens in the table directly contradict. */}
          <span style={{ color: "var(--modeled)" }}>
            {screenedProducts === 0
              ? "No other product line screens as affected."
              : `Supplier screens flag ${screenedProducts} more product ` +
                `${screenedProducts === 1 ? "line" : "lines"}, none confirmed ` +
                `without a BOM ingest.`}
          </span>
        </div>
      </div>

      <Link
        href="/radar"
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
