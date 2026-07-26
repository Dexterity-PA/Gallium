"use client";

import { useState } from "react";
import type { Action, BomLine } from "@/lib/types";
import { ACTION_CODE } from "@/components/resolve/rollup";
import {
  scenarioMetricsFor,
  type PlannedAction,
  type Sufficiency,
} from "@/lib/derive/plan";
import {
  alternatesFor,
  ERP_BLIND_ALTERNATE_NOTE,
  type Alternate,
} from "@/components/exposure/derive";
import { CUSTOMER } from "@/lib/data/customer";
import { PathDiagram, type PathTone } from "@/components/resolve/PathDiagram";

interface RankedAlternate extends Alternate {
  forLine: string; // MPN of the covered line this candidate would replace
}

// Ranked by lines actually recovered (the graph-verified escape verdict),
// not by availability/posture. A pin-compatible, in-stock alternate that
// still routes through the same backend recovers nothing and ranks last.
function rankedAlternates(lines: BomLine[]): RankedAlternate[] {
  return lines
    .flatMap((line) =>
      alternatesFor(line).map((alt) => ({ ...alt, forLine: line.mpn }))
    )
    .sort(
      (a, b) => b.recoveredLines - a.recoveredLines || a.leadTimeWeeks - b.leadTimeWeeks
    );
}

// ---- per-action path diagrams -----------------------------------------
// Not the 25-node GRAPH screen: just the segment of it the action touches,
// built from data that already exists (BomLine.supplyPath, the Alternate
// verdict/collidingNode derived from GRAPH_ADJACENCY in
// components/exposure/derive.ts). BUY_AHEAD and LICENSE change a quantity or
// a filing, not a route, so neither gets one: see ActionCard's report to the
// orchestrator for that call.

// The zone-side node(s) a set of covered lines actually ships out of, read
// off each line's own supplyPath (the last, in-zone hop), not invented. AIR
// FREIGHT covers lines exiting from two different zone sites (Kaohsiung
// backend, Taipei distribution); both are named rather than picking one.
function zoneOriginLabel(lines: BomLine[]): string {
  const sites = new Set<string>();
  for (const l of lines) {
    const last = l.supplyPath?.[l.supplyPath.length - 1];
    if (last?.inQuarantineZone) sites.add(last.site.replace(/,\s*TW$/, ""));
  }
  if (sites.size === 0) return "KAOHSIUNG, TW";
  return `${Array.from(sites).join(" + ").toUpperCase()}, TW`;
}

// AIR FREIGHT REROUTE: same two endpoints before and after, only the leg
// between them changes, sea to air. State-driven off `actioned`, exactly the
// transition the card's own CTA performs.
function expediteDiagram(covered: BomLine[], actioned: boolean) {
  const tone: PathTone = actioned ? "focus" : "critical";
  return {
    nodes: [
      { label: zoneOriginLabel(covered), tone: "critical" as PathTone },
      { label: CUSTOMER.shortName, tone: "neutral" as PathTone },
    ],
    segmentTones: [tone],
    segmentNotes: [actioned ? "AIR · 4D" : "SEA · 31D"],
  };
}

// QUALIFIED ALTERNATE: the outcome of one candidate, in two node-hops. The
// candidate is neutral (an identity, not yet a verdict); the destination
// carries the verdict, --focus clear or --critical named-collision, read
// straight off Alternate.verdict / collidingNode.
function candidateOutcomeDiagram(alt: RankedAlternate) {
  const escaped = alt.verdict === "TRUE_ESCAPE";
  const tone: PathTone = escaped ? "focus" : "critical";
  return {
    nodes: [
      { label: alt.mpn, tone: "neutral" as PathTone },
      {
        label: escaped ? "CLEAR OF ZONE" : (alt.collidingNode ?? "BLOCKED"),
        tone,
      },
    ],
    segmentTones: [tone],
  };
}

// Full-width action row. Not a card: no box, no surface of its own. Rows are
// separated from each other by a single --rule hairline, and the only thing
// that changes when an action fires is a 2px --focus left rule. The metric
// block is a 4-across strip so the columns line up row to row (DESIGN.md
// §6.6) even when an action carries only three metrics.

function MetricCell({
  label,
  value,
  note,
  warn,
  first,
}: {
  label: string;
  value: string;
  note?: string;
  warn?: boolean;
  first: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-2 py-1.5"
      style={{ borderLeft: first ? "none" : "1px solid var(--rule)" }}
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap label">
        {label}
      </span>
      <span
        className="overflow-hidden text-ellipsis whitespace-nowrap tabular-nums text-body font-medium"
        style={{ color: warn ? "var(--critical)" : "var(--text-primary)" }}
      >
        {value}
        {note ? (
          <span className="ml-1 text-label font-normal text-dim">
            {note}
          </span>
        ) : null}
      </span>
    </div>
  );
}

const SUFFICIENCY_LABEL: Record<Sufficiency, string | null> = {
  SUFFICIENT_ALONE: "SUFFICIENT ALONE",
  ADDITIONAL_COVERAGE: "ADDITIONAL COVERAGE",
  COMPLIANCE_AXIS: null,
};

export function ActionCard({
  action,
  planned,
  actioned,
  showSufficiency,
  onGenerate,
  onHover,
}: {
  action: Action;
  /** This action's scenario-derived coverage and arithmetic (lib/derive/
   *  plan.ts). At the default scenario it reproduces the authored figures. */
  planned: PlannedAction;
  actioned: boolean;
  /** Sufficiency tags render only for a simulated (non-default) scenario,
   *  same convention as the Impact panel's (SIM) marker. */
  showSufficiency?: boolean;
  onGenerate: (a: Action) => void;
  onHover?: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const covered = planned.covers;
  const recovers = planned.recovers;
  const metrics = scenarioMetricsFor(planned);
  const sufficiencyLabel = showSufficiency ? SUFFICIENCY_LABEL[planned.sufficiency] : null;
  const alternates = action.kind === "SUBSTITUTE" ? rankedAlternates(covered) : [];

  // The demo-pinned pair (components/exposure/derive.ts): ISO5852SDW-A8
  // truly escapes, -B2 looks like a fix but still assembles at Kaohsiung.
  // Found by real verdict, not by hardcoding candidate MPNs here.
  const escapePair =
    action.kind === "SUBSTITUTE"
      ? (() => {
          const centerpiece = covered.find((l) => l.id === "BOM-07");
          if (!centerpiece) return null;
          const candidates = alternates.filter((a) => a.forLine === centerpiece.mpn);
          const escape = candidates.find((a) => a.verdict === "TRUE_ESCAPE");
          const collision = candidates.find((a) => a.verdict !== "TRUE_ESCAPE");
          if (!escape || !collision) return null;
          return { line: centerpiece, escape, collision };
        })()
      : null;

  return (
    <section
      className="border-b border-rule"
      style={{
        borderLeft: `2px solid ${actioned ? "var(--focus)" : "transparent"}`,
        transition: "border-color 200ms ease-out",
      }}
      onMouseEnter={() => onHover?.(action.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-2 py-1.5 text-left"
      >
        <span className="text-dim" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="shrink-0 text-label text-dim">
          {ACTION_CODE[action.id]}
        </span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-value uppercase text-primary">
          {action.title}
        </span>
        <span className="hidden shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-label text-dim lg:block lg:max-w-[46ch]">
          {action.rationale}
        </span>
        {actioned ? (
          <span className="shrink-0 text-label text-focus">
            ✓ ACTIONED
          </span>
        ) : null}
        {sufficiencyLabel ? (
          <span
            className="shrink-0 text-label"
            style={{
              color:
                planned.sufficiency === "SUFFICIENT_ALONE"
                  ? "var(--focus)"
                  : "var(--text-dim)",
            }}
          >
            {sufficiencyLabel}
          </span>
        ) : null}
        {action.kind === "LICENSE" ? (
          // Compliance axis. Derived from the plan's coverage (2, part of the
          // 13 OBSERVED RESOLVABLE). Kept neutral rather than green and worded
          // "COVERS" not "+N" so it reads as the separate affiliates axis, not
          // a freight/inventory recovery.
          <span className="shrink-0 tabular-nums text-body font-medium text-secondary">
            COVERS {recovers} LINES
          </span>
        ) : (
          <span className="shrink-0 tabular-nums text-body font-medium text-focus">
            +{recovers} LINES
          </span>
        )}
      </button>

      {open ? (
        <div className="border-t border-rule">
          <p className="px-2 py-1.5 text-body leading-relaxed text-secondary">
            {action.rationale}
          </p>

          {/* 4-across metric strip */}
          <div
            className="grid border-y border-rule"
            style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
          >
            {metrics.map((m, i) => (
              <MetricCell
                key={m.label}
                label={m.label}
                value={m.value}
                note={m.note}
                warn={m.warn}
                first={i === 0}
              />
            ))}
          </div>

          {/* path diagram: what the action does to the lines it covers.
              State-driven off `actioned`, not decorative: the sea leg is
              literally replaced by the air leg the moment this fires. */}
          {action.kind === "EXPEDITE" ? (
            <div className="border-b border-rule px-2 py-1.5">
              <PathDiagram {...expediteDiagram(covered, actioned)} size="md" />
            </div>
          ) : null}

          {/* the sharpest insight in the product: two qualified candidates
              for the same part, one clears the zone, one silently doesn't.
              Unmistakable side by side, colliding node named. */}
          {escapePair ? (
            <div className="border-b border-rule px-2 py-1.5">
              <div className="mb-1.5 text-label text-dim">
                {escapePair.line.mpn} · two qualified candidates
              </div>
              <div className="grid grid-cols-2 gap-3" style={{ minWidth: 0 }}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-label" style={{ color: "var(--focus)" }}>
                    ESCAPES
                  </span>
                  <PathDiagram
                    nodes={[
                      { label: escapePair.escape.mpn, tone: "neutral" },
                      { label: "CLEAR OF ZONE", tone: "focus" },
                    ]}
                    segmentTones={["focus"]}
                    size="md"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-label" style={{ color: "var(--critical)" }}>
                    STILL BLOCKED
                  </span>
                  <PathDiagram
                    nodes={[
                      { label: escapePair.collision.mpn, tone: "neutral" },
                      {
                        label: escapePair.collision.collidingNode ?? "BLOCKED",
                        tone: "critical",
                      },
                    ]}
                    segmentTones={["critical"]}
                    size="md"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* which exposed lines this action actually clears */}
          <div className="flex items-baseline gap-3 px-2 py-1.5">
            <span className="shrink-0 label">
              Covers
            </span>
            <span
              className="overflow-hidden text-ellipsis whitespace-nowrap text-label"
              style={{
                // LICENSE covers no BOM lines (compliance axis); stay neutral,
                // never green, since nothing here resolves an observed line.
                color:
                  action.kind === "LICENSE"
                    ? "var(--text-secondary)"
                    : actioned
                      ? "var(--focus)"
                      : "var(--text-secondary)",
                transition: "color 200ms ease-out",
              }}
            >
              {action.kind === "LICENSE"
                ? "2 SUPPLIERS · AFFILIATES SCREENING · RED FLAG 29"
                : covered.map((l) => l.mpn).join("  ·  ")}
            </span>
          </div>

          {action.kind === "SUBSTITUTE" ? (
            <div className="border-t border-rule px-2 py-1.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="label">
                  Qualified alternates · ranked by lines recovered
                </span>
                <span className="shrink-0 tabular-nums text-label text-focus">
                  {alternates.filter((a) => a.recoveredLines > 0).length}/
                  {alternates.length} RECOVER A LINE
                </span>
              </div>
              {alternates.map((alt) => (
                <div
                  key={`${alt.forLine}-${alt.mpn}`}
                  className="flex items-center gap-2 border-b border-rule py-1 text-label"
                >
                  <span className="shrink-0 text-secondary">{alt.forLine}</span>
                  <div className="min-w-0 flex-1">
                    <PathDiagram {...candidateOutcomeDiagram(alt)} />
                  </div>
                  <span
                    className="tabular-nums shrink-0"
                    style={{ color: alt.recoveredLines > 0 ? "var(--focus)" : "var(--text-dim)" }}
                  >
                    +{alt.recoveredLines} LINE{alt.recoveredLines === 1 ? "" : "S"}
                  </span>
                </div>
              ))}
              <div className="mt-1.5 text-label leading-relaxed text-dim">
                {ERP_BLIND_ALTERNATE_NOTE}
              </div>
            </div>
          ) : null}

          {action.warning ? (
            <div className="px-2 pb-1.5">
              {/* a rule, not a box: the caution reads off the left edge so it
                  does not become a second card inside the row */}
              <div
                className="pl-2 text-label leading-body text-critical"
                style={{ borderLeft: "2px solid var(--critical)" }}
              >
                ⚠ {action.warning}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 px-2 pb-2">
            <button
              type="button"
              onClick={() => onGenerate(action)}
              className="label flex h-row items-center px-2 text-focus transition-colors"
              style={{ border: "1px solid var(--focus)" }}
            >
              {action.cta}
            </button>
            {actioned ? (
              <span className="text-label text-focus">
                {action.kind === "LICENSE"
                  ? "● LICENSE PACKET GENERATED"
                  : `● ${recovers} OBSERVED LINES RESOLVED`}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
