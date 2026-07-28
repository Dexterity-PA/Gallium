"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { SupplyGraph } from "@/components/graph/SupplyGraph";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { flowViewFor, tallyForScope } from "@/components/graph/flowModel";
import { useScenario } from "@/lib/hooks/useScenario";
import { useFocusedPart } from "@/lib/focus";

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

  // App-level focus is a third state layered over the base scope: the
  // focused part's origin > supplier > BOM chain holds full weight and the
  // rest drops to context weight. ONE tallyForScope call describes the
  // whole state; the header below and the stats block inside SupplyGraph
  // both read this same object, so they agree by construction. Clearing
  // focus leaves fullNetwork untouched: the user lands back in exactly the
  // base state they were in.
  const { focusedPart } = useFocusedPart();
  const scopeView = useMemo(
    () => tallyForScope(view, fullNetwork, focusedPart),
    [view, fullNetwork, focusedPart]
  );
  const { scope, tally, focus } = scopeView;
  const corner =
    focus?.kind === "path"
      ? `${scope} · ${tally.nodeTotal} NODES · ${tally.edgeTotal} EDGES · FOCUS ${focus.mpn}`
      : `${scope} · ${tally.nodeTotal} NODES · ${tally.edgeTotal} EDGES`;

  return (
    <div className="h-full">
      <Panel
        label="Supply Graph · Contamination Model"
        corner={corner}
        className="h-full"
        noPad
        bodyClassName="overflow-hidden"
      >
        <div className="relative h-full w-full">
          <SupplyGraph
            key={view.key}
            view={view}
            scopeView={scopeView}
            fullNetwork={fullNetwork}
            onToggleFullNetwork={() => setFullNetwork((v) => !v)}
          />
          <GraphLegend />
        </div>
      </Panel>
    </div>
  );
}
