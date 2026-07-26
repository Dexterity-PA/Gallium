"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { riskLabel, type PortfolioProduct } from "@/lib/data/portfolio";
import { BAND_INSET } from "@/components/portfolio/layout";

/* ============================================================
   The portfolio blotter. Seven products, one row each, ranked by value
   at risk descending.

   COLUMN WIDTHS are fixed so every figure lands on the same pixel down
   the column, with EXPOSURE (the bar) as the single flexible column that
   absorbs the remainder. Same discipline as the EXPOSURE screen's BOM
   table: text left, numbers right, nothing centred.

   ONE KIND OF FIGURE. Every product carries a resolved bill of materials,
   so every number in the table is the same kind of claim and is rendered
   the same way. There used to be three treatments in the exposure columns
   (observed, a violet supplier-level estimate, and an absent one), which
   was the honest thing to do while six BOMs were missing. Nothing here is
   an estimate now, so nothing here is violet and nothing carries a tilde.

   COLOUR BUDGET (tokens.css RULE 4): --critical for exposure, --focus for
   the left rule on the worst-hit row, the one the alert band above names.
   --interactive is the hover and does not count (RULE 9).

   There is no row background tint. A --critical wash marked the one hot
   row when there was one hot row; with the whole line carrying exposure
   it would tint seven of seven and distinguish nothing. The bar lengths
   carry the ranking instead, which is what they are for.
   ============================================================ */

// rank | product | lines | exposed | bar | value | days | spacer | status
//
// The spacer track is real: DAYS TO HALT is right-aligned and STATUS is
// left-aligned, so without it the two run together into "51 EXPOSED" and the
// eye cannot tell which column it is reading. One --sp-5 track plus the gap
// either side puts 40px between them.
//
// minmax(), not fixed px, on the four wide tracks. As pure fixed widths the
// row demanded 56+420+100+110+170+130+16+190 = 1192px of track plus 96px of
// gap plus 44px of band inset = 1332px, against the 1232px this route gets at
// a 1280px window. Grid does not shrink a fixed track to fit, so the overflow
// went out the right-hand side and STATUS rendered hard against the glass at
// 0px. Each max below is the old fixed value, so nothing moves at 1512 and
// wider; each min is the width its longest real string needs.
//
// The bar column carries minmax(150px, 1fr), not minmax(0, 1fr). Grid
// maximizes non-flexible tracks to their growth limits BEFORE it expands
// flexible ones, so at 1280x700 the eight fixed tracks reached their maxes
// first and the bar was handed what was left: about 40px of track, with
// "45% of lines" wrapping to three lines underneath it. A 150px floor makes
// the bar a real track at that width. It costs nothing at 1512 and wider,
// where there is free space left over after every other track is at its max
// and the fr still takes all of it. The eight mins now sum to 1006px, plus
// 96px of gap and 44px of band inset: 1146px against the 1232px this route
// gets at a 1280px window.
const GRID =
  "56px minmax(200px, 420px) 100px 110px minmax(150px, 1fr) minmax(120px, 170px) minmax(104px, 130px) var(--sp-5) minmax(150px, 190px)";

interface ColumnDef {
  label: string;
  align: "left" | "right";
}

const COLUMNS: ColumnDef[] = [
  { label: "#", align: "right" },
  { label: "PRODUCT", align: "left" },
  { label: "BOM LINES", align: "right" },
  { label: "EXPOSED", align: "right" },
  { label: "EXPOSURE", align: "left" },
  { label: "VALUE AT RISK", align: "right" },
  { label: "DAYS TO HALT", align: "right" },
  { label: "", align: "left" }, // spacer
  { label: "STATUS", align: "left" },
];

/** A right-aligned figure over its unit label. The label never competes. */
function Figure({
  value,
  unit,
  tone,
}: {
  value: string;
  unit: string;
  tone: string;
}) {
  return (
    <div className="text-right">
      <div
        className="tabular-nums text-value leading-tight"
        style={{ color: tone, fontWeight: 500 }}
      >
        {value}
      </div>
      <div className="label">{unit}</div>
    </div>
  );
}

/** Exposed lines against total, as a proportion you can read across rows. */
function ExposureBar({ p, tone }: { p: PortfolioProduct; tone: string }) {
  const pct = p.bomLines > 0 ? (p.exposedLines / p.bomLines) * 100 : 0;
  return (
    <div>
      <div
        className="w-full overflow-hidden"
        style={{
          // 4px read as a hairline on camera. --sp-4 gives the row an anchor
          // and makes the ranking scannable without reading a single figure.
          height: "var(--sp-4)",
          background: "var(--rule)",
          borderRadius: "var(--radius-max)",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: tone,
            borderRadius: "var(--radius-max)",
          }}
        />
      </div>
      <div className="label mt-1 tabular-nums">
        {p.exposedLines > 0 ? `${pct.toFixed(0)}% of lines` : "no exposed lines"}
      </div>
    </div>
  );
}

function StatusCell({ p }: { p: PortfolioProduct }) {
  if (p.status === "EXPOSED") {
    const observed = p.exposedLines - p.modeledExposed;
    return (
      <div>
        <div
          className="text-value leading-tight"
          style={{ color: "var(--critical)", fontWeight: 600 }}
        >
          ▲ EXPOSED
        </div>
        {/* The one thing this column can say that no other column says: how
            much of the exposure was seen rather than inferred. */}
        <div className="label">
          {p.modeledExposed > 0
            ? `${observed} observed · ${p.modeledExposed} modeled`
            : `${observed} observed`}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div
        className="text-value leading-tight"
        style={{ color: "var(--text-primary)", fontWeight: 500 }}
      >
        ◆ MONITORED
      </div>
      <div className="label">no zone exposure</div>
    </div>
  );
}

function RowBody({
  p,
  rank,
  worst,
  binding,
}: {
  p: PortfolioProduct;
  rank: number;
  worst: boolean;
  /** This product sets the soonest halt in the line. */
  binding: boolean;
}) {
  const hot = p.exposedLines > 0;
  const exposureTone = hot ? "var(--critical)" : "var(--text-dim)";

  return (
    <div
      className="grid h-full items-center gap-3"
      style={{ gridTemplateColumns: GRID }}
    >
      {/* rank - reinforces that the sort is the point */}
      <div className="label tabular-nums text-right">{rank}</div>

      {/* product */}
      <div className="min-w-0">
        <div
          className="truncate text-value leading-tight"
          // The worst-hit product separates on weight, not on hue: it already
          // has the --focus left rule tying it to the alert band above.
          style={{
            color: "var(--text-primary)",
            fontWeight: worst ? 700 : 500,
            letterSpacing: "0.02em",
          }}
        >
          {p.code}
        </div>
        <div className="truncate text-body text-secondary">{p.description}</div>
      </div>

      {/* bom lines */}
      <Figure
        value={String(p.bomLines)}
        unit="lines"
        tone="var(--text-secondary)"
      />

      {/* exposed */}
      <Figure value={String(p.exposedLines)} unit="exposed" tone={exposureTone} />

      {/* exposure bar */}
      <ExposureBar p={p} tone={exposureTone} />

      {/* value at risk */}
      <Figure
        value={riskLabel(p.revenueAtRisk)}
        unit="this quarter"
        tone={exposureTone}
      />

      {/* days to halt - a real figure on every row now that every row has a
          BOM. The incident colour goes only to the product that runs out
          first: a runway is not an alarm, and seven red runways down a column
          say nothing about which one binds. */}
      <Figure
        value={String(p.daysToHalt)}
        unit="days"
        tone={binding ? "var(--critical)" : "var(--text-secondary)"}
      />

      <div /> {/* spacer, see GRID */}

      {/* status */}
      <StatusCell p={p} />
    </div>
  );
}

export function PortfolioTable({ rows }: { rows: PortfolioProduct[] }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const soonestHalt = Math.min(...rows.map((p) => p.daysToHalt));

  /* Layout guard, dev only.

     The rows are flex-1 with min-h-0 inside an overflow-hidden container,
     and that combination hides a cropped row from every obvious check.
     The rows do not overflow the container, they SHRINK: the container
     reports zero scroll overflow, every row's box still measures inside
     it, and the content inside each row is what gets cut. Measuring the
     container is what missed this the first time.

     The signal that actually distinguishes the two states is per row:
     a row whose own scrollHeight exceeds its clientHeight is clipping
     itself. At 1920x1080 and 2560x1440 those are equal on all seven rows.

     rAF so this runs after layout settles, and console.error rather than a
     throw because a cropped row must not take a recording down with it. */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const box = bodyRef.current;
    if (!box) return;

    const frame = requestAnimationFrame(() => {
      const rendered = box.querySelectorAll<HTMLElement>('[role="row"]');

      // The header claims a product count; the blotter has to render it.
      if (rendered.length !== rows.length) {
        console.error(
          `PortfolioTable: rendered ${rendered.length} rows for ${rows.length} products`
        );
      }

      // 1px of tolerance for the sub-pixel heights flex-1 distributes.
      const containerBottom = box.getBoundingClientRect().bottom + 1;
      rendered.forEach((el, i) => {
        const code = rows[i]?.code ?? `#${i + 1}`;
        if (el.scrollHeight > el.clientHeight + 1) {
          console.error(
            `PortfolioTable: row ${i + 1} (${code}) is clipping its content, ` +
              `${el.scrollHeight}px of content in ${el.clientHeight}px of row`
          );
        }
        if (el.getBoundingClientRect().bottom > containerBottom) {
          console.error(
            `PortfolioTable: row ${i + 1} (${code}) sits past the container edge`
          );
        }
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [rows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="table">
      {/* header - framing, so it takes the wider padding step (RULE 8) */}
      <div
        className="grid shrink-0 items-end gap-3 border-b border-rule-strong pl-4 py-2"
        style={{ ...BAND_INSET, gridTemplateColumns: GRID }}
        role="row"
      >
        {COLUMNS.map((c, i) => (
          <div
            key={`${c.label}-${i}`}
            role="columnheader"
            className="label"
            style={{ textAlign: c.align }}
          >
            {c.label}
          </div>
        ))}
      </div>

      {/* rows - flex-1 each, so seven products fill the panel exactly and
          nothing ever scrolls at 1920x1080 or 2560x1440 */}
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {rows.map((p, i) => {
          // The left edge carries one meaning: --focus marks the product the
          // alert band above is talking about. Every other row keeps the same
          // 2px gutter so the product codes stay on one vertical line.
          const worst = i === 0;
          const rowStyle: React.CSSProperties = {
            ...BAND_INSET,
            borderLeft: worst
              ? "2px solid var(--focus)"
              : "2px solid transparent",
          };

          // py-1.5, not py-3. These rows are flex-1, so the padding does not
          // set their height when there is room; it sets their MINIMUM. At
          // 1920x1080 each row is 112px around 39px of content and the step
          // is invisible either way. At 1280x700 the seven rows share 357px,
          // and py-3 made each row demand 63px inside 51px, which the flex
          // column satisfies by cropping the content rather than scrolling.
          // The blotter is also a dense data region, so --sp-2 is the step
          // tokens.css RULE 8 asks for here; py-3 is a framing step.
          return (
            <Link
              key={p.code}
              href={`/exposure?product=${encodeURIComponent(p.code)}`}
              role="row"
              aria-label={`Open ${p.code} bill of materials`}
              className="block min-h-0 flex-1 border-b border-rule pl-4 py-1.5 transition-colors last:border-b-0 hover:bg-elevated"
              style={rowStyle}
            >
              <RowBody
                p={p}
                rank={i + 1}
                worst={worst}
                binding={p.daysToHalt === soonestHalt}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
