import type { Action, BomLine, OwnershipChain } from "@/lib/types";
import { money } from "@/components/resolve/rollup";

// ------------------------------------------------------------------
// Shared numeric/tabular derivation for the RESOLVE documents. Both
// the on-screen preview (components/resolve/DocumentModal.tsx) and
// the downloadable PDF (lib/documents/pdf.ts) call these functions
// rather than each computing their own copy, so a figure can never
// drift between what the operator sees and what the customer gets.
// Every number here is arithmetic on real BomLine fields (qtyPerUnit,
// unitCost, leadTimeWeeks) or a parsed action.metrics value. Nothing
// is authored twice.
// ------------------------------------------------------------------

/** $x.xx below $1,000 (cents permitted), comma/no-cents at or above. */
export function dollars(n: number): string {
  return n >= 1000 ? money(n) : `$${n.toFixed(2)}`;
}

/** Pull a numeric out of a metric's display value, e.g. "4,200" -> 4200. */
export function metricNumber(action: Action, label: string): number | null {
  const m = action.metrics.find((x) => x.label === label);
  if (!m) return null;
  const n = Number(m.value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface LineItemRow {
  id: string;
  mpn: string;
  description: string;
  manufacturer: string;
  qtyPerUnit: number;
  leadTimeWeeks: number;
  unitCost: number;
  ext: number;
}

export interface LineItemDerivation {
  rows: LineItemRow[];
  subtotal: number; // per finished-unit BOM value across the covered lines
  units: number | null; // present on EXPEDITE only, from action.metrics
  extendedTotal: number | null; // subtotal x units, EXPEDITE only
}

/**
 * Cost-document line-item derivation (EXPEDITE / SUBSTITUTE / BUY_AHEAD).
 * `lines` is the action's covered BOM lines, already resolved by
 * components/resolve/rollup.ts's linesFor().
 */
export function deriveLineItems(action: Action, lines: BomLine[]): LineItemDerivation {
  const rows: LineItemRow[] = lines.map((l) => ({
    id: l.id,
    mpn: l.mpn,
    description: l.description,
    manufacturer: l.manufacturer,
    qtyPerUnit: l.qtyPerUnit,
    leadTimeWeeks: l.leadTimeWeeks,
    unitCost: l.unitCost,
    ext: l.qtyPerUnit * l.unitCost,
  }));
  const subtotal = rows.reduce((s, r) => s + r.ext, 0);
  const units = metricNumber(action, "UNITS");
  return {
    rows,
    subtotal,
    units,
    extendedTotal: units ? subtotal * units : null,
  };
}

export interface AffiliateRow {
  id: string;
  mpn: string;
  description: string;
  supplierOfRecord: string;
  parentPct: number;
  parentEntity: string;
  ultimateParent: string;
  ultimateParentConf: number;
  thresholdCrossed: boolean;
  sourceIds: string[];
}

/**
 * LICENSE-document affiliates derivation: the ownership chain already
 * attached to each covered BOM line (lib/data/bom.ts OWNERSHIP_FLAGGED),
 * reshaped for tabular rendering. Same field the modal's ownership
 * drawer reads elsewhere in the app.
 */
export function deriveAffiliateRows(lines: BomLine[]): AffiliateRow[] {
  return lines
    .filter((l): l is BomLine & { ownershipChain: OwnershipChain } => Boolean(l.ownershipChain))
    .map((l) => ({
      id: l.id,
      mpn: l.mpn,
      description: l.description,
      supplierOfRecord: l.ownershipChain.supplierOfRecord,
      parentPct: l.ownershipChain.parentPct,
      parentEntity: l.ownershipChain.parentEntity,
      ultimateParent: l.ownershipChain.ultimateParent,
      ultimateParentConf: l.ownershipChain.ultimateParentConf,
      thresholdCrossed: l.ownershipChain.thresholdCrossed,
      sourceIds: l.ownershipChain.sourceIds,
    }));
}

export function affiliateSourceIds(rows: AffiliateRow[]): string[] {
  return [...new Set(rows.flatMap((r) => r.sourceIds))];
}
