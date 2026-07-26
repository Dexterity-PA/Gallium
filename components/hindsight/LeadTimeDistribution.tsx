"use client";

// The strip is a second view of the same four events, not a fifth thing: it
// exists so the spread, the median, and the one negative lead are visible at
// a glance, matching the table's own numbers exactly because both read the
// same `deltaDays`/`domain` rather than each computing their own.

import type { HindsightEvent } from "@/lib/data/hindsight";
import { deltaDays, medianDeltaDays } from "@/lib/data/hindsight";
import type { LeadDomain } from "@/components/hindsight/domain";
import { outcomeTone, outcomeGlyph } from "@/components/hindsight/outcome";
import { deltaLabel } from "@/components/hindsight/format";

export function LeadTimeDistribution({
  events,
  domain,
}: {
  events: HindsightEvent[];
  domain: LeadDomain;
}) {
  const median = medianDeltaDays(events);
  const zeroPct = domain.toPct(0);
  const medianPct = domain.toPct(median);

  return (
    <div>
      <div className="label mb-2">Lead time distribution, days vs. benchmark</div>

      {/* The inset lives on the wrapper and the track is a bare `relative` box,
          because the two are not interchangeable: an absolutely positioned
          child resolves `left: N%` against its containing block's PADDING box
          while a normal-flow child spans the content box. With the padding on
          the `relative` element the zero and median guides were drawn against a
          box wider than the one the event markers used, so they sat a few px
          off the values they marked. Splitting them puts every percentage on
          this screen on one origin.
          pr-4 mirrors the LEAD cell's own pr-4, so the axis maximum ends on the
          same pixel as the deltas stacked above it. */}
      <div className="pr-4">
        <div className="relative">
          {/* median guide: dashed, no glyph, so it reads as a reference line
              rather than a fifth event */}
          <div
            className="pointer-events-none absolute inset-y-0 border-l border-dashed"
            style={{ left: `${medianPct}%`, borderColor: "var(--text-secondary)" }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 border-l border-rule-strong"
            style={{ left: `${zeroPct}%` }}
          />

          {/* h-3 is the label's own line box. Its only child is absolutely
              positioned, so without an explicit height this row collapses to
              its padding and the label overflows into the axis below it, which
              painted the rule straight through the median caption. */}
          <div className="relative mb-1.5 h-3">
            <span
              className="label absolute -translate-x-1/2 text-secondary"
              style={{ left: `${medianPct}%` }}
            >
              Median · {deltaLabel(median)}
            </span>
          </div>

          <div className="relative h-10 border-t-2 border-rule-strong">
            {events.map((ev) => {
              const d = deltaDays(ev);
              const tone = outcomeTone(ev.outcome);
              return (
                <div
                  key={ev.id}
                  className="absolute top-1.5 flex -translate-x-1/2 flex-col items-center gap-1"
                  style={{ left: `${domain.toPct(d)}%` }}
                >
                  <span className="text-label leading-none tabular-nums" style={{ color: tone }}>
                    {deltaLabel(d)}
                  </span>
                  <span className="leading-none" style={{ color: tone }}>
                    {outcomeGlyph(ev.outcome)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="relative flex justify-between">
            <span className="label">{Math.round(domain.min)}D</span>
            <span
              className="label absolute -translate-x-1/2 text-dim"
              style={{ left: `${zeroPct}%` }}
            >
              0D
            </span>
            <span className="label">{Math.round(domain.max)}D</span>
          </div>
        </div>
      </div>
    </div>
  );
}
