"use client";

import { Panel } from "@/components/ui/Panel";
import { SupplyGraph } from "@/components/graph/SupplyGraph";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { GRAPH_STATS } from "@/lib/data/graph";

export default function GraphPage() {
  return (
    <div className="h-full">
      <Panel
        label="Supply Graph — Contamination Model"
        corner={`${GRAPH_STATS.nodes} NODES · ${GRAPH_STATS.edges} EDGES`}
        className="h-full"
        noPad
        bodyClassName="overflow-hidden"
      >
        <div className="relative h-full w-full">
          <SupplyGraph />
          <GraphLegend />
        </div>
      </Panel>
    </div>
  );
}
