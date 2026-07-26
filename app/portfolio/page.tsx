"use client";

import { useEffect, useMemo, useState } from "react";
import { CUSTOMER } from "@/lib/data/customer";
import {
  FOCUS_INDEX,
  FOCUS_LIVE,
  FOCUS_QUIET,
  ESTIMATE_MARK,
  NO_VALUE,
  PORTFOLIO,
  riskLabel,
  rollup,
  splitExposure,
} from "@/lib/data/portfolio";
import { PortfolioAlert } from "@/components/portfolio/PortfolioAlert";
import { PortfolioTable } from "@/components/portfolio/PortfolioTable";
import { Metric } from "@/components/ui/Metric";
import { SplitMetric } from "@/components/portfolio/SplitMetric";
import { BAND_INSET } from "@/components/portfolio/layout";

/* ============================================================
   PORTFOLIO - the landing screen.

   The arc this screen has to carry, in one shot: a company lands on its
   own dashboard, an alert fires on one part, one product line goes hot.
   So the screen mounts quiet and resolves ONCE, ~900ms in, to the state
   where the Kaohsiung quarantine has already landed. One state change:
   the alert band swaps, the rollup recomputes, and MD-7200's row goes
   critical in place. Nothing moves, nothing re-sorts, nothing animates
   in sequence, because the frame has to be right when it is paused.

   LAYOUT / 1920x1080. AppShell leaves this route 1872x1030 (nav rail 48,
   status bar 28, ticker 22). The panel is full bleed inside that, like
   every other screen: panels here carry no border and no gutter, so an
   inset one would read as a card floating on a darker plane. The 24px
   camera-safe margin is held by CONTENT instead: every band takes pl-4
   on a left edge that already starts 48px in, and BAND_INSET on the
   right (see components/portfolio/layout.ts for why that one is a
   calc). Vertically the header sits below the 28px status bar and the
   footer above the 22px ticker. Measured extents are in the report.

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

  // The one substitution. Every other row is identical in both states.
  const rows = useMemo(
    () =>
      PORTFOLIO.map((p, i) =>
        i === FOCUS_INDEX ? (live ? FOCUS_LIVE : FOCUS_QUIET) : p
      ),
    [live]
  );

  const focus = rows[FOCUS_INDEX];
  const totals = useMemo(() => rollup(rows), [rows]);

  // Confirmed = the ingested product's real exposed lines. Screened = the
  // supplier-level estimates behind the other six. Kept apart because they
  // are not the same kind of claim, and reduced over the same `rows` the
  // table renders so the strip cannot drift from the blotter.
  const split = useMemo(() => splitExposure(rows), [rows]);

  // The incident colour is spent on confirmed exposure only. A screening
  // estimate is not an incident, and until the focus product goes hot the
  // strip has nothing observed to be alarmed about.
  const confirmedTone =
    split.confirmedLines > 0 ? "var(--critical)" : "var(--text-primary)";

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
            {totals.products} PRODUCTS · {totals.ingested} INGESTED ·{" "}
            {totals.bomLines} BOM LINES
          </span>
        </div>

        {/* the alert band */}
        <PortfolioAlert
          live={live}
          focus={focus}
          screenedProducts={split.screenedProducts}
        />

        {/* rollup - the "this is your business" read, all of it reduced
            over the rows below, none of it authored */}
        <div
          className="flex shrink-0 items-stretch gap-4 border-b border-rule pl-4 py-3"
          style={BAND_INSET}
        >
          <Metric
            label="Products in line"
            value={String(totals.products)}
            sub={`${totals.ingested} resolved to line level`}
            className="flex-1"
          />
          <div className="w-px shrink-0 bg-rule" />
          <Metric
            label="BOM lines"
            value={String(totals.bomLines)}
            sub={`${focus.bomLines} resolved · ${totals.bomLines - focus.bomLines} screened`}
            className="flex-1"
          />
          <div className="w-px shrink-0 bg-rule" />
          <SplitMetric
            label="Lines exposed"
            confirmed={String(split.confirmedLines)}
            screened={`${ESTIMATE_MARK}${split.screenedLines}`}
            sub={`of ${focus.bomLines} resolved lines`}
            tone={confirmedTone}
            className="flex-1"
          />
          <div className="w-px shrink-0 bg-rule" />
          <SplitMetric
            label="Value at risk"
            confirmed={riskLabel(split.confirmedValue)}
            screened={`${ESTIMATE_MARK}${riskLabel(split.screenedValue)}`}
            sub={`of ${riskLabel(totals.quarterlyBuildValue)} quarterly build`}
            tone={confirmedTone}
            className="flex-1"
          />
          <div className="w-px shrink-0 bg-rule" />
          <Metric
            label="Days to halt"
            value={focus.daysToHalt === null ? NO_VALUE : String(focus.daysToHalt)}
            sub={`${focus.code} · only ingested BOM`}
            tone={confirmedTone}
            className="flex-1"
          />
        </div>

        {/* the table */}
        <PortfolioTable rows={rows} />

        {/* footer - deliberately short. The fixed provenance badge owns the
            bottom-right corner, so this line must not run under it. */}
        <div className="shrink-0 border-t border-rule pl-4 py-2" style={BAND_INSET}>
          {/* One line at 1280px wide, not two. This band sits directly under
              the blotter, and every row it wraps to is a row of height taken
              off seven flex-1 rows that are already the tightest thing on the
              screen at 700px tall. */}
          <span className="label">
            Ranked by value at risk. {focus.code} opens on click;{" "}
            <span style={{ color: "var(--modeled)" }}>
              {ESTIMATE_MARK} and violet mark a modeled figure
            </span>
            . Days to halt needs a BOM ingest.
          </span>
        </div>
      </section>
    </div>
  );
}
