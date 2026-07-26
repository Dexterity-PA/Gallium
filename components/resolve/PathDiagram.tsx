import { Fragment } from "react";

// Compact path diagram: a handful of node chips joined by labeled
// connectors. Not the 25-node GRAPH screen, just the segment of it that one
// action or one candidate actually touches. Every label passed in here is
// read off real data (BomLine.supplyPath, the Alternate verdict/collidingNode
// derived in components/exposure/derive.ts from GRAPH_ADJACENCY). This
// component only lays the strings out, it does not invent topology.
//
// Two semantic tones, matching RULE 4's two-per-panel budget: --critical for
// "still in / still routes through the quarantine zone", --focus for
// "clear of it". A third, neutral tone (--text-secondary / --rule-strong)
// carries everything that is neither, e.g. the candidate part itself before
// its verdict is drawn.

export type PathTone = "critical" | "focus" | "neutral";

export interface PathNode {
  label: string;
  tone?: PathTone;
}

export interface PathDiagramProps {
  nodes: PathNode[]; // at least 2
  segmentTones: PathTone[]; // nodes.length - 1
  segmentNotes?: (string | undefined)[]; // same length as segmentTones
  size?: "sm" | "md";
}

const TONE_COLOR: Record<PathTone, string> = {
  critical: "var(--critical)",
  focus: "var(--focus)",
  neutral: "var(--text-secondary)",
};

const TONE_BORDER: Record<PathTone, string> = {
  critical: "var(--critical)",
  focus: "var(--focus)",
  neutral: "var(--rule-strong)",
};

export function PathDiagram({
  nodes,
  segmentTones,
  segmentNotes,
  size = "sm",
}: PathDiagramProps) {
  const pad = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";
  return (
    <div className="flex min-w-0 items-center gap-1">
      {nodes.map((node, i) => {
        // Every node but the last keeps its natural width: candidate MPNs
        // and short identifiers are never the thing that runs long. The
        // last node carries the outcome (a real site name, e.g. "Kaohsiung
        // backend A&T") and is the one that has to give: it shrinks and
        // truncates instead of pushing the card wider than its column, which
        // is what actually overflowed the ALT comparison at 1280px.
        const isLast = i === nodes.length - 1;
        return (
          <Fragment key={i}>
            <span
              className={`${isLast ? "min-w-0 overflow-hidden text-ellipsis" : "shrink-0"} whitespace-nowrap text-label ${pad}`}
              style={{
                border: `1px solid ${TONE_BORDER[node.tone ?? "neutral"]}`,
                color: TONE_COLOR[node.tone ?? "neutral"],
              }}
              title={node.label}
            >
              {node.label}
            </span>
            {i < segmentTones.length ? (
              <span className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-2">
                {segmentNotes?.[i] ? (
                  <span
                    className="whitespace-nowrap text-label"
                    style={{ color: TONE_COLOR[segmentTones[i]] }}
                  >
                    {segmentNotes[i]}
                  </span>
                ) : null}
                <span style={{ color: TONE_COLOR[segmentTones[i]] }}>{"→"}</span>
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
