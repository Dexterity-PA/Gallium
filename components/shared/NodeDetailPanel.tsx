"use client";

// Shared node-detail panel: the ONE detail surface reused by the RADAR map and
// the GRAPH canvas. Both build a `NodeDetail` and render it here; other agents
// link into this component and its `NodeDetail` props type, so keep both stable.
//
// Layout: absolute bottom-right inside the host's relative wrap (does not move
// with the map/graph). Sections render only when the builder supplies them:
//   identity → status/provenance/confidence → fields → SOURCES → supply path → edges
// Visual language preserved from the original graph panel (mono, dark, 9–11px).

import { useState } from "react";
import type { GraphNode, Provenance, Status, Site } from "@/lib/types";
import {
  connectedEdges,
  supplyPath,
  type ConnectedEdge,
  type PathStep,
} from "@/components/graph/graphDerive";
import { getSources } from "@/lib/data/sources";
import { SourcePanel } from "@/components/shared/SourcePanel";

// ---- shared props type (the contract other agents build against) ----
export interface NodeDetailField {
  label: string;
  value: string;
  tone?: string; // css color (e.g. "var(--critical)")
}

export interface NodeDetail {
  id: string;
  title: string;
  subtitle?: string; // e.g. "SUPPLIER · RING 2" or a site function
  status?: Status; // omitted where a status axis doesn't apply
  provenance: Provenance;
  confidence?: number; // ConfidenceBand value; omitted where N/A
  sourceIds: string[]; // resolved against lib/data/sources.ts
  fields?: NodeDetailField[]; // free key/value rows (map coords, parts affected…)
  supplyPath?: PathStep[]; // graph only
  edges?: ConnectedEdge[]; // graph only
  origin: "map" | "graph";
}

const STATUS_COLOR: Record<Status, string> = {
  CLEAR: "var(--text-dim)",
  AT_RISK: "var(--text-primary)",
  EXPOSED: "var(--critical)",
};
const STATUS_LABEL: Record<Status, string> = {
  CLEAR: "CLEAR",
  AT_RISK: "AT RISK",
  EXPOSED: "EXPOSED",
};
const TIER_TAG: Record<number, string> = {
  0: "R0 CUSTOMER",
  1: "R1 BOM",
  2: "R2 SUPPLIER",
  3: "R3 SITE",
};

// Violet ONLY for MODELED provenance (DESIGN §2).
const provColor = (p: Provenance) =>
  p === "MODELED" ? "var(--modeled)" : "var(--text-secondary)";
const conf = (c: number) => `${Math.round(c)}%`;

// ---- builders: each screen maps its own node into the shared shape ----

export function nodeDetailFromGraphNode(node: GraphNode): NodeDetail {
  return {
    id: node.id,
    title: node.label,
    subtitle: `${node.kind} · RING ${node.ring}`,
    status: node.status,
    provenance: node.provenance,
    sourceIds: node.sourceIds,
    supplyPath: supplyPath(node.id),
    edges: connectedEdges(node.id),
    origin: "graph",
  };
}

export function nodeDetailFromSite(
  site: Site,
  extra?: { affected?: number }
): NodeDetail {
  const fields: NodeDetailField[] = [];
  if (extra && typeof extra.affected === "number") {
    fields.push({
      label: "Parts Affected",
      value: String(extra.affected),
      tone: extra.affected > 0 ? "var(--critical)" : "var(--text-secondary)",
    });
  }
  fields.push({
    label: "Coordinates",
    value: `${site.lat.toFixed(2)}, ${site.lng.toFixed(2)}`,
  });
  return {
    id: site.id,
    title: site.label,
    subtitle: site.function ?? (site.isCustomer ? "Customer assembly" : undefined),
    status: site.exposed ? "EXPOSED" : site.isCustomer ? undefined : "CLEAR",
    provenance: "OBSERVED",
    sourceIds: site.sourceIds,
    fields,
    origin: "map",
  };
}

// ---- component ----

export function NodeDetailPanel({
  detail,
  onClose,
}: {
  detail: NodeDetail | null;
  onClose: () => void;
}) {
  // Hooks must run every render regardless of `detail`, so they sit above the
  // early return below. Reset during render (not in an effect) whenever the
  // selected node changes, so a stale panel never reopens on a new selection.
  const [sourcesOpen, setSourcesOpen] = useState<string[] | null>(null);
  const [sourcesOpenFor, setSourcesOpenFor] = useState<string | null>(null);
  if ((detail?.id ?? null) !== sourcesOpenFor) {
    setSourcesOpenFor(detail?.id ?? null);
    setSourcesOpen(null);
  }

  if (!detail) return null;

  const sources = getSources(detail.sourceIds);
  const path = detail.supplyPath ?? [];
  const edges = detail.edges ?? [];

  return (
    <div
      className="absolute bottom-6 right-2 z-20 flex w-[240px] flex-col border border-rule-strong bg-panel"
      // top clearance leaves the top-right widget (graph stats / map controls)
      // untouched; the body scrolls internally.
      style={{ maxHeight: "calc(100% - 200px)" }}
      // clicks inside the panel must not bubble to a host background-click that
      // would clear the selection (the RADAR map wraps this in such a handler).
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* header */}
      <div className="flex h-row shrink-0 items-center justify-between border-b border-rule px-2">
        <span className="label">
          Node Detail
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close node detail"
          className="text-body leading-none text-dim transition-colors hover:text-focus"
        >
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {/* identity */}
        <div
          className="truncate text-body font-medium text-primary"
          title={detail.title}
        >
          {detail.title}
        </div>
        {detail.subtitle ? (
          <div className="mt-1 label">
            {detail.subtitle}
          </div>
        ) : null}

        <div className="mt-1.5 space-y-1">
          {detail.status ? (
            <div className="flex items-center justify-between">
              <span className="label">
                Status
              </span>
              <span
                className="flex items-center gap-1 text-body"
                style={{ color: STATUS_COLOR[detail.status] }}
              >
                <span className="text-label leading-none" aria-hidden>
                  ●
                </span>
                {STATUS_LABEL[detail.status]}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="label">
              Provenance
            </span>
            <span
              className="text-body"
              style={{ color: provColor(detail.provenance) }}
            >
              {detail.provenance}
            </span>
          </div>
          {typeof detail.confidence === "number" ? (
            <div className="flex items-center justify-between">
              <span className="label">
                Confidence
              </span>
              <span className="text-body tabular-nums text-secondary">
                {conf(detail.confidence)}
              </span>
            </div>
          ) : null}
          {detail.fields?.map((f) => (
            <div key={f.label} className="flex items-center justify-between">
              <span className="label">
                {f.label}
              </span>
              <span
                className="text-body tabular-nums"
                style={{ color: f.tone ?? "var(--text-secondary)" }}
              >
                {f.value}
              </span>
            </div>
          ))}
        </div>

        {/* sources (Phase-1 provenance documents) */}
        {sources.length ? (
          <div className="mt-2 border-t border-rule pt-1.5">
            <button
              type="button"
              onClick={() => setSourcesOpen(detail.sourceIds)}
              className="mb-1 flex w-full items-center justify-between transition-opacity hover:opacity-70"
              title="View all provenance"
            >
              <span className="label">
                Sources
              </span>
              <span className="text-label tabular-nums text-dim">
                {sources.length}
              </span>
            </button>
            <div className="flex flex-col gap-1">
              {sources.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSourcesOpen([s.id])}
                  className="flex items-baseline gap-1.5 text-left transition-opacity hover:opacity-70"
                >
                  <span
                    className="shrink-0 text-label leading-body"
                    style={{ color: provColor(s.provenance) }}
                    aria-hidden
                  >
                    {s.provenance === "MODELED" ? "◆" : "●"}
                  </span>
                  <span
                    className="truncate text-label leading-body text-secondary"
                    title={`${s.title} · ${s.publisher}`}
                  >
                    {s.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* supply path (graph) */}
        {path.length ? (
          <div className="mt-2 border-t border-rule pt-1.5">
            <div className="mb-1 label">
              Supply Path
            </div>
            <div className="flex flex-col">
              {path.map((step) => (
                <div key={step.node.id}>
                  {step.edge ? (
                    <div className="flex items-center gap-1 pl-1 text-label leading-body">
                      <span className="text-dim" aria-hidden>
                        │
                      </span>
                      <span style={{ color: provColor(step.edge.provenance) }}>
                        {step.edge.provenance === "MODELED" ? "MOD" : "OBS"}
                      </span>
                      <span className="tabular-nums text-dim">
                        {conf(step.edge.confidence)}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className={`flex items-baseline gap-1.5 py-1 ${
                      step.isSelected
                        ? "border-l-2 border-focus bg-elevated pl-1"
                        : "border-l-2 border-transparent pl-1"
                    }`}
                  >
                    <span className="shrink-0 label">
                      {TIER_TAG[step.node.ring] ?? `R${step.node.ring}`}
                    </span>
                    <span
                      className="truncate text-label"
                      title={step.node.label}
                      style={{
                        color: step.isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {step.node.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* edges (graph) */}
        {edges.length ? (
          <div className="mt-2 border-t border-rule pt-1.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="label">
                Edges
              </span>
              <span className="text-label tabular-nums text-dim">
                {edges.length}
              </span>
            </div>
            <div className="max-h-[132px] overflow-y-auto pr-1">
              {edges.map((e, i) => (
                <div
                  key={`${e.neighbor.id}-${i}`}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <span
                    className="truncate text-label text-secondary"
                    title={e.neighbor.label}
                  >
                    {e.neighbor.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="text-label"
                      style={{ color: provColor(e.provenance) }}
                    >
                      {e.provenance === "MODELED" ? "MOD" : "OBS"}
                    </span>
                    <span className="w-[36px] text-right text-label tabular-nums text-dim">
                      {conf(e.confidence)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <SourcePanel
        sourceIds={sourcesOpen}
        onClose={() => setSourcesOpen(null)}
        context={detail.title}
      />
    </div>
  );
}
