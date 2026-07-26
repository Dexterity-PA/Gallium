"use client";

import { useMemo } from "react";
import { HINDSIGHT_EVENTS, LEAD_HEADLINE, MEDIAN_LEAD_DAYS } from "@/lib/data/hindsight";
import { CUSTOMER } from "@/lib/data/customer";
import { computeLeadDomain } from "@/components/hindsight/domain";
import { Panel } from "@/components/ui/Panel";
import { Metric } from "@/components/ui/Metric";
import { HindsightTable } from "@/components/hindsight/HindsightTable";

// HINDSIGHT is the credibility screen. Everywhere else in the app makes a
// claim at one instant; this is the one place the claim is checked against
// what actually happened. A single panel, not the three-column instrument
// layout RADAR/RESOLVE use, because there is one thing to look at: the
// record, laid out as a ledger.
//
// There used to be a LEAD TIME DISTRIBUTION strip under the table. It is gone
// and nothing replaced it. It restated the four deltas already stacked in the
// LEAD column, and its horizontal axis with a median marker on it read as a
// draggable slider, inviting a click that did nothing. computeLeadDomain
// stays: the per-row LEAD bars inside the table are still drawn against it.
//
// HEIGHT. The panel is no longer h-full. With the strip gone there is nothing
// below the table to anchor to the bottom of the window, so a full-height
// panel is four rows of ledger followed by a field of empty --bg-panel
// stretched down to the ticker. The panel now ends where the record ends, and
// the page scrolls if a future event count outgrows the window.
//
// LAYOUT CONTRACT. Every horizontal inset on this screen is owned by the
// panel, never by the viewport. This panel's right edge sits flush against the
// window, so a clearance measured against the window is indistinguishable from
// a real one at 1920 and quietly wrong at 2560. The chain is:
//
//   panel edge -> p-2  (8px, the panel's own gutter)
//              -> px-4 (16px, the band inset every band shares)
//              -> pr-4 (16px, the trailing padding inside the band)
//
// so the right-most glyph on the screen (the lead delta in the table) lands
// 40px inside the panel at any width, and the left-most (the date column)
// lands 24px inside it. tokens.css has no single step at 24px or 40px and
// RULE 7 forbids inventing one, so both are reached by stacking sanctioned
// steps.

export default function HindsightPage() {
  const domain = useMemo(() => computeLeadDomain(HINDSIGHT_EVENTS), []);
  const caught = HINDSIGHT_EVENTS.filter((e) => e.outcome === "CAUGHT").length;
  const missed = HINDSIGHT_EVENTS.filter((e) => e.outcome !== "CAUGHT").length;

  return (
    <div className="h-full overflow-auto">
      <Panel
        label={`Hindsight, ${CUSTOMER.focusProduct.line} detection record`}
        corner={`${HINDSIGHT_EVENTS.length} EVENTS · MEDIAN ${MEDIAN_LEAD_DAYS}D`}
        noPad
        bodyClassName="flex flex-col"
      >
        <div className="flex flex-col p-2">
          {/* Framing band takes the larger steps, the dense region below it
              takes the smaller ones (RULE 8). */}
          <div className="shrink-0 border-b border-rule px-4 pb-3 pt-1">
            <Metric
              label="Lead time vs. benchmark"
              value={LEAD_HEADLINE}
              size="lg"
              sub={`${caught} CAUGHT · ${missed} MISSED · MEDIAN OF ${HINDSIGHT_EVENTS.length} VERIFIED EVENTS`}
            />
          </div>

          <div className="px-4 pb-2 pt-2">
            <HindsightTable events={HINDSIGHT_EVENTS} domain={domain} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
