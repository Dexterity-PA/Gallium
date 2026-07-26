"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ESTIMATE_MARK,
  NO_VALUE,
  riskLabel,
  type PortfolioProduct,
} from "@/lib/data/portfolio";
import { BAND_INSET } from "@/components/portfolio/layout";

/* ============================================================
   The portfolio blotter. Seven products, one row each, ranked by value
   at risk descending.

   COLUMN WIDTHS are fixed so every figure lands on the same pixel down
   the column, with EXPOSURE (the bar) as the single flexible column that
   absorbs the remainder. Same discipline as the EXPOSURE screen's BOM
   table: text left, numbers right, nothing centred.

   COLOUR BUDGET (tokens.css RULE 4): this screen spends its two semantic
   colours on --critical (the incident: the hot row's figures, its bar,
   the alert) and --focus (the left rule marking the one row you can act
   on, matching BomTable's convention). --interactive is the hover and the
   link, and does not count (RULE 9).

   --modeled does not count either, and is not decoration here. Every
   figure on the four screened rows that carry hits is inferred from a
   supplier list rather than read off a BOM, so the exposed count, the
   bar, its percentage, and the value at risk are all violet (RULE 2).
   Rendering them in neutral grey next to MD-7200's derived figures made
   an estimate and a fact look like the same kind of claim.
   ============================================================ */

// rank | product | lines | exposed | bar | value | days | spacer | status
//
// The spacer track is real: DAYS TO HALT is right-aligned and STATUS is
// left-aligned, so without it the two run together into "51 EXPOSED" and the
// eye cannot tell which column it is reading. One --sp-5 track plus the gap
// either side puts 40px between them.
const GRID =
  "56px 420px 100px 110px 1fr 170px 130px var(--sp-5) 190px";

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
function ExposureBar({
  p,
  tone,
  modeled,
}: {
  p: PortfolioProduct;
  tone: string;
  modeled: boolean;
}) {
  const pct = p.bomLines > 0 ? (p.exposedLines / p.bomLines) * 100 : 0;
  const fill = tone;
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
            background: fill,
            borderRadius: "var(--radius-max)",
          }}
        />
      </div>
      {/* The zero case has two different meanings and must not share copy: a
          screened product returned no supplier hits, whereas the ingested one
          has been walked line by line and none of them is exposed. */}
      {/* The percentage is as modeled as the bar it describes, so it takes
          the same colour rather than receding to the default label dim. */}
      <div
        className="label mt-1 tabular-nums"
        style={modeled ? { color: "var(--modeled)" } : undefined}
      >
        {p.exposedLines > 0
          ? `${pct.toFixed(0)}% of lines`
          : p.ingested
            ? "no exposed lines"
            : "no screening hits"}
      </div>
    </div>
  );
}

function StatusCell({ p }: { p: PortfolioProduct }) {
  if (p.status === "EXPOSED") {
    return (
      <div>
        <div
          className="text-value leading-tight"
          style={{ color: "var(--critical)", fontWeight: 600 }}
        >
          ▲ EXPOSED
        </div>
        <div className="label">line-level ingest</div>
      </div>
    );
  }
  if (p.status === "MONITORED") {
    return (
      <div>
        <div
          className="text-value leading-tight"
          style={{ color: "var(--text-primary)", fontWeight: 500 }}
        >
          ◆ MONITORED
        </div>
        <div className="label">line-level ingest</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-value leading-tight text-dim">NOT INGESTED</div>
      <div className="label">supplier screen only</div>
    </div>
  );
}

function RowBody({ p, rank }: { p: PortfolioProduct; rank: number }) {
  const hot = p.status === "EXPOSED";

  // An ingested row states facts; a screened row states estimates, and the
  // tilde is where it says so. Zero is not marked: a screen that returned no
  // hits returned no hits.
  const modeled = !p.ingested && p.exposedLines > 0;
  const mark = modeled ? ESTIMATE_MARK : "";

  // Three kinds of exposure figure live in this column, and rendering them
  // alike is what made the screened estimates read as observed fact:
  //   confirmed  walked line by line on the resolved BOM   -> --critical
  //   modeled    inferred from a supplier list, never seen  -> --modeled
  //   absent     nothing to infer, so nothing is claimed    -> --text-dim
  // --modeled is reserved for exactly this (tokens.css RULE 2) and is not a
  // semantic colour, so it does not spend the RULE 4 budget.
  const exposureTone = hot
    ? "var(--critical)"
    : modeled
      ? "var(--modeled)"
      : "var(--text-dim)";

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
          // The product code separates on weight, not on hue: the ingested
          // row already has the --focus left rule saying "this one opens".
          style={{
            color: "var(--text-primary)",
            fontWeight: p.ingested ? 700 : 500,
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
      <Figure
        value={`${mark}${p.exposedLines}`}
        unit="exposed"
        tone={exposureTone}
      />

      {/* exposure bar */}
      <ExposureBar p={p} tone={exposureTone} modeled={modeled} />

      {/* value at risk - as modeled as the line count it is derived from */}
      <Figure
        value={`${mark}${riskLabel(p.revenueAtRisk)}`}
        unit="this quarter"
        tone={exposureTone}
      />

      {/* days to halt - absent on six rows, and absence is not an estimate */}
      <Figure
        value={p.daysToHalt === null ? NO_VALUE : String(p.daysToHalt)}
        unit={p.daysToHalt === null ? "needs ingest" : "days"}
        tone={
          p.daysToHalt === null
            ? "var(--text-dim)"
            : hot
              ? "var(--critical)"
              : "var(--text-secondary)"
        }
      />

      <div /> {/* spacer, see GRID */}

      {/* status */}
      <StatusCell p={p} />
    </div>
  );
}

export function PortfolioTable({ rows }: { rows: PortfolioProduct[] }) {
  const bodyRef = useRef<HTMLDivElement>(null);

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
          const hot = p.status === "EXPOSED";
          const isFocus = p.ingested;

          // The left edge carries one meaning: --focus marks the row you can
          // open. The six screened rows keep the same 2px gutter so the
          // product codes stay on one vertical line.
          const rowStyle: React.CSSProperties = {
            ...BAND_INSET,
            borderLeft: isFocus
              ? "2px solid var(--focus)"
              : "2px solid transparent",
            background: hot ? "color-mix(in srgb, var(--critical) 6%, transparent)" : "transparent",
          };

          const shared =
            "min-h-0 flex-1 border-b border-rule pl-4 py-3 last:border-b-0";

          if (isFocus) {
            return (
              <Link
                key={p.code}
                href="/exposure"
                role="row"
                aria-label={`Open ${p.code} bill of materials`}
                className={`${shared} block transition-colors hover:bg-elevated`}
                style={rowStyle}
              >
                <RowBody p={p} rank={i + 1} />
              </Link>
            );
          }

          return (
            <div
              key={p.code}
              role="row"
              aria-disabled="true"
              className={shared}
              style={rowStyle}
            >
              <RowBody p={p} rank={i + 1} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
