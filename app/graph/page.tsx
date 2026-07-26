"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { SupplyGraph } from "@/components/graph/SupplyGraph";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { SCOPE_LABEL, tallyForScope } from "@/components/graph/flowModel";

export default function GraphPage() {
  // The full-network toggle lives here, not inside SupplyGraph, because the
  // panel header has to describe the same view the canvas is drawing. One piece
  // of state, one tally lookup, so the header and the on-canvas stats block
  // cannot report different sizes for the same picture.
  const [fullNetwork, setFullNetwork] = useState(false);
  const tally = tallyForScope(fullNetwork);
  const scope = fullNetwork ? SCOPE_LABEL.full : SCOPE_LABEL.foreground;

  return (
    <div className="h-full">
      <Panel
        label="Supply Graph · Contamination Model"
        corner={`${scope} · ${tally.nodeTotal} NODES · ${tally.edgeTotal} EDGES`}
        className="h-full"
        noPad
        bodyClassName="overflow-hidden"
      >
        <div className="relative h-full w-full">
          <SupplyGraph
            fullNetwork={fullNetwork}
            onToggleFullNetwork={() => setFullNetwork((v) => !v)}
          />
          <GraphLegend />
        </div>
      </Panel>
    </div>
  );
}
