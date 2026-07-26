"use client";

import { useEffect, useMemo, useState } from "react";
import { CUSTOMER } from "@/lib/data/customer";
import {
  PORTFOLIO,
  PORTFOLIO_QUIET,
  riskLabel,
  rollup,
} from "@/lib/data/portfolio";
import { PortfolioAlert } from "@/components/portfolio/PortfolioAlert";
import { PortfolioTable } from "@/components/portfolio/PortfolioTable";
import { Metric } from "@/components/ui/Metric";
import { BAND_INSET } from "@/components/portfolio/layout";

/* ============================================================
   PORTFOLIO - the landing screen.

   The arc this screen has to carry, in one shot: a company lands on its
   own dashboard, an alert fires, and its product line goes hot. So the
   screen mounts quiet and resolves ONCE, ~900ms in, to the state where
   the Kaohsiung quarantine has already landed. One state change: the
   alert band swaps, the rollup recomputes, and the blotter goes critical
   in place. Nothing moves, nothing re-sorts, nothing animates in
   sequence, because the frame has to be right when it is paused.

   Quiet is not a second set of numbers. It is the same derivation with
   nothing inside the zone (see lib/data/portfolio.ts), which is what
   "before it happened" means, so the two states cannot disagree about
   anything except the incident.

   LAYOUT / 1920x1080. AppShell leaves this route 1872x1030 (nav rail 48,
   status bar 28, ticker 22). The panel is full bleed inside that, like
   every other screen: panels here carry no border and no gutter, so an
   inset one would read as a card floating on a darker plane. The 24px
   camera-safe margin is held by CONTENT instead: every band takes pl-4
   on a left edge that already starts 48px in, and BAND_INSET on the
   right (see components/portfolio/layout.ts for why that one is a
   calc). Vertically the header sits below the 28px status bar and the
   footer above the 22px ticker.

   The table's rows are flex-1, so seven products fill the remaining
   height exactly and nothing scrolls. Padding is not uniform (RULE 8):
   the bands frame at py-3, the dense row interior sits at py-1.5.

   Those two steps are set by 1280x700, not by 1920x1080. Because the rows
   are flex-1, their padding is a MINIMUM height, not their height: at
   1920 every row is 113px around the same content and the step makes no
   visible difference. At 1280x700 the seven rows share 418px, and the
   larger steps made each row demand more than it was given, which a flex
   column resolves by cropping the row's content rather than scrolling.
   The band copy is kept to one line at 1280px wide for the same reason.
   ============================================================ */

const RESOLVE_DELAY_MS = 900;

export default function PortfolioPage() {
  const [live, setLive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLive(true), RESOLVE_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const rows = live ? PORTFOLIO : PORTFOLIO_QUIET;
  const totals = useMemo(() => rollup(rows), [rows]);

  // The worst-hit product is row 1: the table is ranked by value at risk and
  // held in that order across both states, so the band and the blotter cannot
  // disagree about which product they are talking about.
  const worst = rows[0];

  // The incident colour is spent only when there is an incident.
  const tone = totals.exposedLines > 0 ? "var(--critical)" : "var(--text-primary)";

  return (
    <div className="h-full">
      <section className="flex h-full min-h-0 flex-col bg-panel">
        {/* screen header */}
        <div
          className="flex h-row shrink-0 items-center justify-between border-b border-rule pl-4"
          style={BAND_INSET}
        >
          <span className="label">
            Portfolio · {CUSTOMER.name} · {CUSTOMER.segment}
          </span>
          <span className="text-label tabular-nums text-dim">
            {totals.products} PRODUCTS · {totals.bomLines} BOM LINES ·{" "}
            {totals.exposedLines} EXPOSED
          </span>
        </div>

        {/* the alert band */}
        <PortfolioAlert live={live} totals={totals} worst={worst} />

        {/* rollup - the "this is your business" read, all of it reduced
            over the rows below, none of it authored */}
        <div
          className="flex shrink-0 items-stretch gap-4 border-b border-rule pl-4 py-3"
          style={BAND_INSET}
        >
          <Metric
            label="Products in line"
            value={String(totals.products)}
            sub="all resolved to line level"
            className="flex-1"
          />
          <div className="w-px shrink-0 bg-rule" />
          <Metric
            label="BOM lines"
            value={String(totals.bomLines)}
            sub={`across ${totals.products} bills of materials`}
            className="flex-1"
          />
          <div className="w-px shrink-0 bg-rule" />
          <Metric
            label="Lines exposed"
            value={String(totals.exposedLines)}
            sub={`of ${totals.bomLines} resolved lines`}
            tone={tone}
            className="flex-1"
          />
          <div className="w-px shrink-0 bg-rule" />
          <Metric
            label="Value at risk"
            value={riskLabel(totals.revenueAtRisk)}
            sub={`of ${riskLabel(totals.quarterlyBuildValue)} quarterly build`}
            tone={tone}
            className="flex-1"
          />
          <div className="w-px shrink-0 bg-rule" />
          <Metric
            label="Days to halt"
            value={String(totals.daysToHalt)}
            sub={`${totals.soonestHalt} · soonest in the line`}
            tone={tone}
            className="flex-1"
          />
        </div>

        {/* the table */}
        <PortfolioTable rows={rows} />

        {/* footer - deliberately short, and one line at 1280px wide. This
            band sits directly under the blotter, and every row it wraps to is
            a row of height taken off seven flex-1 rows that are already the
            tightest thing on the screen at 700px tall. */}
        <div className="shrink-0 border-t border-rule pl-4 py-2" style={BAND_INSET}>
          <span className="label">
            Ranked by value at risk. Every row opens its bill of materials. Days
            to halt is the runway left against Meridian&rsquo;s 10-week buffer.
          </span>
        </div>
      </section>
    </div>
  );
}
