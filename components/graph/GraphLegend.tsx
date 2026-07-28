// Graph legend for the three-column exposure flow (DESIGN/BRIEF Screen 3
// rebuild). Bottom-left, always visible. A footnote, not a panel: three
// rows, each folding a second, shorter explanation into its phrasing.
//
// Rendered from app/app/graph/page.tsx (outside components/graph/, so it can't
// take a prop from SupplyGraph without editing a file out of scope). The
// full-network node count is read directly from GRAPH here instead, the
// same source SupplyGraph's own full-network tally derives from, so the two
// can't drift apart even though they're computed in different places.

import type { ReactNode } from "react";
import { GRAPH } from "@/lib/data/graph";

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="w-[78px] shrink-0 tracking-[0.06em] text-secondary">{term}</span>
      <span className="text-dim">{children}</span>
    </div>
  );
}

export function GraphLegend() {
  const fullNetworkNodeCount = GRAPH.nodes.length;
  return (
    <div
      className="pointer-events-none absolute left-2 z-10 max-w-[520px] select-none border border-rule bg-[color-mix(in_srgb,var(--bg-base)_85%,transparent)] px-2 py-1 text-[9px] leading-[1.5] tracking-[0.02em]"
      // bottom takes the 24px safe inset: with the ticker band gone this
      // panel's bottom edge is the viewport's, and bottom-2 put the legend's
      // last line 8px off the glass.
      style={{ bottom: "var(--safe-inset)" }}
    >
      <div className="flex flex-col gap-0.5">
        <Row term="COLUMNS">
          site → suppliers → BOM lines · tick + number = hops via a zone site
        </Row>
        <Row term="EDGE WEIGHT">
          heavier / brighter = more lines · heavy ring = feeds &gt;1 line
        </Row>
        <Row term="FULL NETWORK">
          off by default, shows all {fullNetworkNodeCount} nodes as faint context when on
        </Row>
        {/* The distinction the product actually turns on, and the only one the
            legend used to leave unstated: whether a link is something we saw or
            something we inferred. Named in the colours themselves rather than
            with swatches, which keeps it to the one row it is worth. */}
        <Row term="COLOUR">
          <span style={{ color: "var(--critical)" }}>red</span> = observed exposure ·{" "}
          <span style={{ color: "var(--modeled)" }}>violet</span> = modeled from industry
          structure
        </Row>
      </div>
    </div>
  );
}
