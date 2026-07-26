"use client";

import { useMemo } from "react";
import { HINDSIGHT_EVENTS, LEAD_HEADLINE, MEDIAN_LEAD_DAYS } from "@/lib/data/hindsight";
import { CUSTOMER } from "@/lib/data/customer";
import { computeLeadDomain } from "@/components/hindsight/domain";
import { Panel } from "@/components/ui/Panel";
import { Metric } from "@/components/ui/Metric";
import { HindsightTable } from "@/components/hindsight/HindsightTable";
import { LeadTimeDistribution } from "@/components/hindsight/LeadTimeDistribution";

// HINDSIGHT is the credibility screen. Everywhere else in the app makes a
// claim at one instant; this is the one place the claim is checked against
// what actually happened. A single panel, not the three-column instrument
// layout RADAR/RESOLVE use, because there is one thing to look at: the
// record, laid out as a ledger (table + a distribution strip beneath it),
// not a stack of cards. The domain behind every lead-time visual is computed
// once here and handed to both the table and the strip, so they read the
// same four numbers rather than each computing their own.
//
// LAYOUT CONTRACT. Every horizontal inset on this screen is owned by the
// panel, never by the viewport. This panel's right edge sits flush against the
// window, so a clearance measured against the window is indistinguishable from
// a real one at 1920 and quietly wrong at 2560. The chain is now:
//
//   panel edge -> p-2  (8px, the panel's own gutter)
//              -> px-4 (16px, the band inset every band shares)
//              -> pr-4 (16px, the trailing padding inside the band)
//
// so the two right-most glyphs on the screen (the lead delta in the table and
// the axis maximum in the strip) both land 40px inside the panel at any width,
// and the two left-most (the date column and the axis minimum) both land 24px
// inside it. tokens.css has no single step at 24px or 40px and RULE 7 forbids
// inventing one, so both are reached by stacking sanctioned steps.
//
// BADGE_CLEARANCE is the vertical half of the same problem. ProvenanceBadge is
// fixed to the viewport, not to this panel: it is ~16px tall, sits --sp-1 above
// the ticker, and floats over whatever the panel paints in its bottom-right
// corner. The strip's axis labels were finishing 6px above it, which reads on
// camera as the disclaimer sitting on the axis. This inset holds them clear.
const BADGE_CLEARANCE = "calc(var(--sp-5) + var(--sp-4))"; // 16 + 12 = 28px

export default function HindsightPage() {
  const domain = useMemo(() => computeLeadDomain(HINDSIGHT_EVENTS), []);
  const caught = HINDSIGHT_EVENTS.filter((e) => e.outcome === "CAUGHT").length;
  const missed = HINDSIGHT_EVENTS.filter((e) => e.outcome !== "CAUGHT").length;

  return (
    <div className="h-full">
      <Panel
        label={`Hindsight, ${CUSTOMER.focusProduct.line} detection record`}
        corner={`${HINDSIGHT_EVENTS.length} EVENTS · MEDIAN ${MEDIAN_LEAD_DAYS}D`}
        className="h-full"
        noPad
        bodyClassName="flex min-h-0 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col p-2">
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

          <div className="min-h-0 flex-1 overflow-auto px-4 pt-2">
            <HindsightTable events={HINDSIGHT_EVENTS} domain={domain} />
          </div>

          <div
            className="shrink-0 border-t border-rule px-4 pt-3"
            style={{ paddingBottom: BADGE_CLEARANCE }}
          >
            <LeadTimeDistribution events={HINDSIGHT_EVENTS} domain={domain} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
