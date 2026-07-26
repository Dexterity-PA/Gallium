"use client";

// The lookback ledger. A real <table>, the same convention BomTable (the
// EXPOSURE screen) already establishes for dense tabular data: a <colgroup>
// fixes each column's width once, so DATE / FLAGGED / BENCHMARK / LEAD line
// up down every row instead of each row laying itself out independently.
// Only the EVENT cell's description and note are width-capped (max-w-prose);
// every other column spans its own real, aligned width.
//
// There are only four rows and every field the brief asks for (date,
// detection, both timestamps, delta, outcome) sits in view at once, not
// behind a click. The one thing that IS a click is provenance: every row's
// SRC/CONF button opens the same SourcePanel every other screen uses, so "we
// caught this" is inspectable rather than asserted.
//
// Two guards against the row silently going missing again: `ordered.length`
// is checked against `events.length` before render (catches a data-layer
// regression like an accidental filter), and a ref-based effect checks the
// actual mounted <tr> count after render (catches a rendering-layer
// regression, e.g. a duplicate key). The data-layer one throws unconditionally,
// matching the guard style lib/data/hindsight.ts already uses; the DOM-layer
// one throws in development and logs in production, for the reason given at
// its call site.

import { useEffect, useRef, useState } from "react";
import type { HindsightEvent } from "@/lib/data/hindsight";
import { deltaDays } from "@/lib/data/hindsight";
import type { LeadDomain } from "@/components/hindsight/domain";
import { SourcePanel } from "@/components/shared/SourcePanel";
import { outcomeTone, outcomeGlyph } from "@/components/hindsight/outcome";
import { formatDate, formatTimestamp, deltaLabel } from "@/components/hindsight/format";

// No column carries left padding: the band around this table already owns the
// inset, so a cell's content starts exactly on its column edge and its header
// label starts on the same pixel. Trailing padding is per-column, and the two
// outer columns take the larger step so the DATE and LEAD glyphs keep real
// clearance from the panel edge rather than borrowing it from the viewport.
const COLUMNS = [
  { key: "date", label: "Date", width: "108px", align: "left", pad: "pr-3" },
  { key: "event", label: "Event", width: "auto", align: "left", pad: "pr-4" },
  { key: "flagged", label: "Flagged", width: "168px", align: "left", pad: "pr-3" },
  { key: "benchmark", label: "Benchmark", width: "212px", align: "left", pad: "pr-3" },
  { key: "lead", label: "Lead", width: "224px", align: "right", pad: "pr-4" },
] as const;

// The per-row lead bar: a thin track spanning the cell, a zero tick, and a
// filled segment from zero to this event's delta, coloured by outcome. Same
// domain the strip below uses, passed in as a prop, so the two cannot
// disagree about where a delta sits.
function LeadBar({ delta, domain, tone }: { delta: number; domain: LeadDomain; tone: string }) {
  const zeroPct = domain.toPct(0);
  const deltaPct = domain.toPct(delta);
  const left = Math.min(zeroPct, deltaPct);
  const width = Math.max(0.5, Math.abs(deltaPct - zeroPct));
  return (
    <div className="relative mt-1.5 h-1 bg-rule">
      <div
        className="absolute inset-y-0 rounded-max"
        style={{ left: `${left}%`, width: `${width}%`, background: tone }}
      />
      <div className="absolute inset-y-0 w-px bg-rule-strong" style={{ left: `${zeroPct}%` }} />
    </div>
  );
}

function Row({ ev, domain }: { ev: HindsightEvent; domain: LeadDomain }) {
  const [srcOpen, setSrcOpen] = useState(false);
  const delta = deltaDays(ev);
  const tone = outcomeTone(ev.outcome);

  return (
    <tr className="border-b border-rule">
      <td className="py-2 pr-3 align-top">
        <div className="text-label tabular-nums text-dim">{formatDate(ev.date)}</div>
        <div className="mt-1 flex items-center gap-1.5 text-label" style={{ color: tone }}>
          {outcomeGlyph(ev.outcome)} {ev.outcome}
        </div>
      </td>

      <td className="py-2 pr-4 align-top">
        <div className="text-value uppercase leading-tight text-primary">{ev.headline}</div>
        {/* Detection and the honesty note sit side by side rather than stacked.
            The EVENT column is ~1100px wide but each block reads at ~65ch, so
            stacking them spent ~650px of dead width to buy ~40px of row height
            and left the screen reading half empty. Side by side, each block
            keeps its own measure and the row loses a third of its height. */}
        <div className="mt-1 flex items-start gap-4">
          <p className="min-w-0 max-w-prose flex-1 text-body leading-snug text-secondary">
            {ev.detected}
          </p>
          <p className="min-w-0 max-w-prose flex-1 border-l-2 border-rule pl-2 text-label leading-body text-dim">
            {ev.note}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSrcOpen(true)}
          className="label mt-1.5 block text-left text-interactive transition-opacity hover:opacity-70"
        >
          SRC {ev.sourceIds.length} · CONF {ev.confidence}%
        </button>
        <SourcePanel
          sourceIds={srcOpen ? ev.sourceIds : null}
          onClose={() => setSrcOpen(false)}
          context={ev.headline}
        />
      </td>

      <td className="py-2 pr-3 align-top text-body tabular-nums text-primary">
        {formatTimestamp(ev.flaggedAt)}
      </td>

      <td className="py-2 pr-3 align-top">
        <div className="label">{ev.benchmarkLabel}</div>
        <div className="mt-1 text-body tabular-nums text-primary">
          {formatTimestamp(ev.erpAt)}
        </div>
      </td>

      <td className="py-2 pr-4 align-top">
        <div
          className="text-right tabular-nums leading-none"
          style={{ color: tone, fontSize: "20px", fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          {deltaLabel(delta)}
        </div>
        <LeadBar delta={delta} domain={domain} tone={tone} />
      </td>
    </tr>
  );
}

export function HindsightTable({
  events,
  domain,
}: {
  events: HindsightEvent[];
  domain: LeadDomain;
}) {
  const ordered = [...events].sort((a, b) => (a.date < b.date ? 1 : -1));

  // Data-layer guard: sort() can reorder but never drop, so this can only
  // fire if a future edit adds a filter/slice ahead of it.
  if (ordered.length !== events.length) {
    throw new Error(
      `HindsightTable: computed ${ordered.length} rows for ${events.length} events`
    );
  }

  const bodyRef = useRef<HTMLTableSectionElement>(null);

  // Rendering-layer guard: checks what actually mounted, not just what was
  // asked for, so a duplicate key or a conditional return inside Row would
  // be caught here even though the data-layer check above would miss it.
  //
  // It throws in development only. A throw from an effect unmounts the tree,
  // so in production the cost of this guard firing is a blank panel mid
  // recording, strictly worse than the missing row it is reporting, which at
  // least leaves a readable ledger on screen. Development still fails loudly,
  // which is where a missing row needs to be caught.
  useEffect(() => {
    const mounted = bodyRef.current?.children.length ?? 0;
    if (mounted === events.length) return;
    const message = `HindsightTable: rendered ${mounted} <tr> for ${events.length} events`;
    if (process.env.NODE_ENV === "development") {
      throw new Error(message);
    }
    console.error(message);
  }, [events.length]);

  return (
    <table className="w-full border-separate text-body" style={{ borderSpacing: 0 }}>
      <colgroup>
        {COLUMNS.map((c) => (
          <col key={c.key} style={{ width: c.width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {COLUMNS.map((c) => (
            <th
              key={c.key}
              className={`border-b border-rule-strong bg-panel py-1.5 label ${c.pad}`}
              style={{ textAlign: c.align }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {ordered.map((ev) => (
          <Row key={ev.id} ev={ev} domain={domain} />
        ))}
      </tbody>
    </table>
  );
}
