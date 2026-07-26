"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { SupplyGraph } from "@/components/graph/SupplyGraph";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { SCOPE_LABEL, flowViewFor } from "@/components/graph/flowModel";
import { useScenario } from "@/lib/hooks/useScenario";

export default function GraphPage() {
  // The full-network toggle lives here, not inside SupplyGraph, because the
  // panel header has to describe the same view the canvas is drawing. One piece
  // of state, one tally lookup, so the header and the on-canvas stats block
  // cannot report different sizes for the same picture.
  const [fullNetwork, setFullNetwork] = useState(false);

  // The contamination path is the CURRENT scenario's path (RADAR's simulate
  // control), derived through the same model every other screen reads. At the
  // default control this is the exact scripted view; the canvas is keyed on
  // the view so a scenario change replays the reveal from a clean frame.
  const { control } = useScenario();
  const view = useMemo(() => flowViewFor(control), [control]);
  const tally = fullNetwork ? view.fullTally : view.foregroundTally;
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
            key={view.key}
            view={view}
            fullNetwork={fullNetwork}
            onToggleFullNetwork={() => setFullNetwork((v) => !v)}
          />
          <GraphLegend />
        </div>
      </Panel>
    </div>
  );
}
