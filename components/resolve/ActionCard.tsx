"use client";

import { useState } from "react";
import type { Action } from "@/lib/types";
import { ACTION_CODE, linesFor } from "@/components/resolve/rollup";

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

export function ActionCard({
  action,
  actioned,
  onGenerate,
  onHover,
}: {
  action: Action;
  actioned: boolean;
  onGenerate: (a: Action) => void;
  onHover?: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const covered = linesFor(action.id);

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
        {action.kind === "LICENSE" ? (
          // Compliance axis. Derived from `recovers` (now 2 — part of the 13
          // OBSERVED RESOLVABLE). Kept neutral rather than green and worded
          // "COVERS" not "+N" so it reads as the separate affiliates axis, not
          // a freight/inventory recovery.
          <span className="shrink-0 tabular-nums text-body font-medium text-secondary">
            COVERS {action.recovers} LINES
          </span>
        ) : (
          <span className="shrink-0 tabular-nums text-body font-medium text-focus">
            +{action.recovers} LINES
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
            {action.metrics.map((m, i) => (
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

          {/* which exposed lines this action actually clears */}
          <div className="flex items-baseline gap-3 px-2 py-1.5">
            <span className="shrink-0 label">
              Covers
            </span>
            <span
              className="overflow-hidden text-ellipsis whitespace-nowrap text-label"
              style={{
                // LICENSE covers no BOM lines (compliance axis); stay neutral —
                // never green — since nothing here resolves an observed line.
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
                  : `● ${action.recovers} OBSERVED LINES RESOLVED`}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
