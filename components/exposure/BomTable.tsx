"use client";

import { useMemo, useState } from "react";
import type { BomLine } from "@/lib/types";
import { CENTERPIECE_ID } from "@/lib/data/bom";
import {
  statusColor,
  statusGlyph,
} from "@/components/ui/StatusGlyph";
import { ownershipColor, ownershipGlyph } from "./ownershipStyle";
import { summarizeRows } from "./derive";

type SortKey =
  | "mpn"
  | "manufacturer"
  | "tier"
  | "leadTimeWeeks"
  | "qtyPerUnit"
  | "status"
  | "confidence";

interface Column {
  key: string;
  label: string;
  align: "left" | "right" | "center";
  width: string;
  sortKey?: SortKey;
}

// Fixed widths are content-fit to each column's LONGEST value at --fs-body
// (12.5px) mono, incl. the 3 MODELED rows, so nothing truncates; DESCRIPTION
// is the single flexible column and absorbs the remainder. Each width was
// scaled 11px → 12.5px (×1.14) when the table moved onto the type token.
//
// Fixed total ~1182px. DESCRIPTION still fills ~690px of the 1872px exposure
// panel at 1920x1080 (kiosk, no browser chrome — DEMO.md §Resolution) — well
// past its longest value (~47ch ≈ 355px), so every column stays fully visible
// and CONF never clips the right edge. The fixed columns cannot be trimmed
// without truncating: MFR 232 fits "Modeled — leadframe supplier" (28ch);
// ACTUAL EXPOSURE 188 fits "TW-KAOHSIUNG (modeled)" (22ch); MPN 142 fits
// "CSS2H-2512R-L500" (16ch). Numeric columns are at their glyph width.
//
// Alignment is binary: text left, numbers right (tokens.css tabular-nums puts
// every figure on the same decimal). Nothing is centred — a third alignment
// only makes the eye hunt for the column edge.
const COLUMNS: Column[] = [
  { key: "mpn", label: "MPN", align: "left", width: "142px", sortKey: "mpn" },
  { key: "description", label: "DESCRIPTION", align: "left", width: "auto" },
  { key: "manufacturer", label: "MFR", align: "left", width: "232px", sortKey: "manufacturer" },
  { key: "ownership", label: "OWNERSHIP", align: "left", width: "106px" },
  { key: "erpOrigin", label: "ERP ORIGIN", align: "left", width: "100px" },
  { key: "actualExposure", label: "ACTUAL EXPOSURE", align: "left", width: "188px" },
  { key: "tier", label: "TIER", align: "right", width: "56px", sortKey: "tier" },
  { key: "leadTimeWeeks", label: "LEAD TIME", align: "right", width: "100px", sortKey: "leadTimeWeeks" },
  { key: "qtyPerUnit", label: "QTY/UNIT", align: "right", width: "88px", sortKey: "qtyPerUnit" },
  { key: "status", label: "STATUS", align: "left", width: "106px", sortKey: "status" },
  { key: "confidence", label: "CONF", align: "right", width: "64px", sortKey: "confidence" },
];

const STATUS_RANK = { EXPOSED: 0, AT_RISK: 1, CLEAR: 2 } as const;

export function BomTable({
  rows,
  selectedId,
  onSelect,
  onSelectOwnership,
}: {
  rows: BomLine[];
  selectedId: string | null;
  onSelect: (b: BomLine) => void;
  // Fired when the OWNERSHIP cell is clicked — opens the ownership-chain
  // drawer instead of the supply-path drawer. Distinct from `onSelect`.
  onSelectOwnership: (b: BomLine) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const out = [...rows];
    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "status") {
        av = STATUS_RANK[a.status];
        bv = STATUS_RANK[b.status];
      } else {
        av = a[sortKey] as number | string;
        bv = b[sortKey] as number | string;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * sortDir;
      }
      return ((av as number) - (bv as number)) * sortDir;
    });
    return out;
  }, [rows, sortKey, sortDir]);

  // Column-aligned totals for the sticky summary row (Job 3). Derived from the
  // rows currently shown — recomputes when the filter changes. No literals.
  const summary = useMemo(() => summarizeRows(rows), [rows]);

  const toggleSort = (k?: SortKey) => {
    if (!k) return;
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <table
        className="w-full border-separate text-body"
        style={{ borderSpacing: 0, tableLayout: "fixed" }}
      >
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
                onClick={() => toggleSort(c.sortKey)}
                className="sticky top-0 z-10 select-none border-b border-rule-strong bg-panel px-2 py-1 label"
                style={{
                  textAlign: c.align,
                  cursor: c.sortKey ? "pointer" : "default",
                }}
              >
                <span className={c.align === "right" ? "inline-flex flex-row-reverse items-center gap-1" : "inline-flex items-center gap-1"}>
                  {c.label}
                  {c.sortKey && sortKey === c.sortKey ? (
                    <span className="text-focus">
                      {sortDir === 1 ? "▲" : "▼"}
                    </span>
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const isCenter = b.id === CENTERPIECE_ID;
            const isSelected = b.id === selectedId;
            const isHover = b.id === hoverId;
            const isModeled = b.provenance === "MODELED";

            // The left edge carries one meaning at a time. --focus marks the
            // row you are on (selected, hovered, or the pulsing centrepiece);
            // --modeled dashes mark an inferred row. Selection wins over
            // provenance because it answers "where am I", not "what is this".
            let borderLeft = "2px solid transparent";
            if (isCenter || isSelected || isHover)
              borderLeft = "2px solid var(--focus)";
            else if (isModeled) borderLeft = "2px dashed var(--modeled)";

            const rowBg =
              isSelected || isHover ? "var(--bg-elevated)" : "transparent";

            const baseText = isModeled ? "var(--modeled)" : "var(--text-secondary)";

            return (
              <tr
                key={b.id}
                onClick={() => onSelect(b)}
                onMouseEnter={() => setHoverId(b.id)}
                onMouseLeave={() => setHoverId((h) => (h === b.id ? null : h))}
                className={isCenter ? "anim-focal cursor-pointer" : "cursor-pointer"}
                style={{ background: rowBg, borderLeft, height: "var(--row-h)" }}
              >
                {/* MPN — the centrepiece separates on weight, not on a hue:
                    its left rule and focal pulse already say "look here". */}
                <td
                  className="truncate px-2"
                  style={{
                    color: isModeled ? "var(--modeled)" : "var(--text-primary)",
                    fontWeight: isCenter ? 700 : 500,
                  }}
                >
                  {b.mpn}
                </td>
                {/* DESCRIPTION */}
                <td className="truncate px-2" style={{ color: baseText }}>
                  {b.description}
                </td>
                {/* MFR */}
                <td className="truncate px-2" style={{ color: baseText }}>
                  {b.manufacturer}
                </td>
                {/* OWNERSHIP — clicking this cell opens the ownership drawer,
                    not the supply-path drawer; stop the row's onSelect. */}
                {(() => {
                  const own = b.ownership ?? "CLEAR";
                  const isClear = own === "CLEAR";
                  return (
                    <td
                      className="truncate px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOwnership(b);
                      }}
                      style={{ cursor: "pointer" }}
                      title={`Ownership: ${own}`}
                    >
                      <span
                        style={{
                          color: isClear
                            ? "var(--text-dim)"
                            : ownershipColor(own),
                          fontWeight: own === "FLAGGED" ? 700 : 400,
                        }}
                      >
                        <span style={{ color: ownershipColor(own) }}>
                          {ownershipGlyph(own)}
                        </span>{" "}
                        {own}
                      </span>
                    </td>
                  );
                })()}
                {/* ERP ORIGIN */}
                <td className="truncate px-2">
                  <span
                    style={{
                      color: b.erpBlind ? "var(--text-dim)" : baseText,
                      textDecoration: b.erpBlind ? "line-through" : "none",
                    }}
                  >
                    {b.erpOrigin}
                  </span>
                </td>
                {/* ACTUAL EXPOSURE */}
                <td className="truncate px-2">
                  {b.actualExposure ? (
                    <span
                      style={{
                        color: isModeled
                          ? "var(--modeled)"
                          : b.status === "EXPOSED"
                          ? "var(--critical)"
                          : baseText,
                        fontWeight: isCenter ? 700 : 400,
                      }}
                    >
                      {b.actualExposure}
                    </span>
                  ) : (
                    <span className="text-dim">—</span>
                  )}
                </td>
                {/* TIER */}
                <td className="px-2 text-right tabular-nums" style={{ color: baseText }}>
                  {b.tier}
                </td>
                {/* LEAD TIME — the week figure right-aligns on its own column
                    and the delta sits in a fixed 4ch gutter after it, so the
                    "W" lands in the same place whether or not a row moved. */}
                <td className="px-2 tabular-nums" style={{ color: isModeled ? "var(--modeled)" : "var(--text-primary)" }}>
                  <span className="flex items-baseline justify-end">
                    <span>{b.leadTimeWeeks}W</span>
                    <span
                      className="ml-1 inline-block shrink-0 text-left text-label"
                      style={{
                        width: "4ch",
                        // a modeled row stays modeled all the way across: a
                        // --critical delta inside a --modeled row would claim
                        // the movement was observed
                        color: isModeled
                          ? "var(--modeled)"
                          : b.leadTimeDelta > 0
                            ? "var(--critical)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {b.leadTimeDelta !== 0
                        ? `${b.leadTimeDelta > 0 ? "▲" : "▼"}${Math.abs(b.leadTimeDelta)}`
                        : ""}
                    </span>
                  </span>
                </td>
                {/* QTY/UNIT */}
                <td className="px-2 text-right tabular-nums" style={{ color: baseText }}>
                  {b.qtyPerUnit}
                </td>
                {/* STATUS */}
                <td className="truncate px-2">
                  <span style={{ color: statusColor(b.status) }}>
                    {statusGlyph(b.status)} {b.status.replace("_", " ")}
                  </span>
                </td>
                {/* CONF */}
                <td
                  className="px-2 text-right tabular-nums"
                  style={{ color: isModeled ? "var(--modeled)" : "var(--text-secondary)" }}
                >
                  {b.confidence}%
                </td>
              </tr>
            );
          })}
        </tbody>
        {/* sticky summary row (Job 3) — pinned to the bottom like the header is
            pinned to the top. All totals derived from BOM via summarizeRows;
            cells align to the same colgroup so each total sits under its
            column. Stays within the 11-column fit at 1920x1080. */}
        <tfoot>
          <tr>
            {/* MPN — totals label */}
            <td className="sticky bottom-0 z-10 px-2 py-1" style={FOOT_STYLE}>
              <div className="label">
                Σ Totals
              </div>
              <div className="tabular-nums text-label text-dim">
                {summary.totalRows} shown
              </div>
            </td>
            {/* DESCRIPTION — definitions legend */}
            <td className="sticky bottom-0 z-10 px-2 py-1" style={FOOT_STYLE}>
              <div className="label">
                Exposed-line aggregates · qty/unit summed · peak LT = max weeks ·
                tier = lines shown by tier
              </div>
            </td>
            {/* MFR */}
            <td className="sticky bottom-0 z-10 px-2" style={FOOT_STYLE} />
            {/* OWNERSHIP */}
            <td className="sticky bottom-0 z-10 px-2" style={FOOT_STYLE} />
            {/* ERP ORIGIN */}
            <td className="sticky bottom-0 z-10 px-2" style={FOOT_STYLE} />
            {/* ACTUAL EXPOSURE */}
            <td className="sticky bottom-0 z-10 px-2" style={FOOT_STYLE} />
            {/* TIER — tier mix over shown lines */}
            <td
              className="sticky bottom-0 z-10 px-2 py-1 text-right"
              style={FOOT_STYLE}
            >
              <div className="tabular-nums text-value text-primary">
                {summary.tier[0]}·{summary.tier[1]}·{summary.tier[2]}
              </div>
              <div className="label">
                T1·2·3
              </div>
            </td>
            {/* LEAD TIME — peak lead time over exposed lines */}
            <td
              className="sticky bottom-0 z-10 px-2 py-1 text-right"
              style={FOOT_STYLE}
            >
              <div className="tabular-nums text-value text-primary">
                {summary.peakLeadTimeExposed}W
              </div>
              <div className="label">
                peak · exp
              </div>
            </td>
            {/* QTY/UNIT — summed qty/unit over exposed lines */}
            <td
              className="sticky bottom-0 z-10 px-2 py-1 text-right"
              style={FOOT_STYLE}
            >
              <div className="tabular-nums text-value text-primary">
                {summary.exposedQtyPerUnit}
              </div>
              <div className="label">
                exp qty
              </div>
            </td>
            {/* STATUS — exposed line count */}
            <td
              className="sticky bottom-0 z-10 px-2 py-1"
              style={FOOT_STYLE}
            >
              <div className="tabular-nums text-value" style={{ color: "var(--critical)" }}>
                ▲ {summary.exposedLines}
              </div>
              <div className="label">
                exposed
              </div>
            </td>
            {/* CONF */}
            <td className="sticky bottom-0 z-10 px-2" style={FOOT_STYLE} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Footer cells mirror the sticky header: solid panel bg so scrolled rows do not
// bleed through, and a hot hairline on top (the header uses one on the bottom).
const FOOT_STYLE: React.CSSProperties = {
  background: "var(--bg-panel)",
  borderTop: "1px solid var(--rule-strong)",
  verticalAlign: "bottom",
};
