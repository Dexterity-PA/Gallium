import { BOM } from "@/lib/data/bom";
import { resolveMpn } from "@/lib/data/components";
import type { UploadRow } from "@/lib/csv";

export type { UploadRow };

export interface ResolvedRow extends UploadRow {
  matched: boolean;
  exposed: boolean;
  manufacturer?: string;
  assemblyRegion?: string | null;
}

export interface ResolutionSummary {
  source: "sample" | "upload";
  fileName?: string;
  totalRows: number;
  matched: number;
  unresolved: number;
  exposed: number;
  rows: ResolvedRow[];
}

// Lightweight variant persisted across reloads (see useDemoState) — the
// per-row detail only matters during the resolution screen's own run, not
// after a BOM is "loaded".
export type LoadedSummary = Omit<ResolutionSummary, "rows">;

export function toLoadedSummary(summary: ResolutionSummary): LoadedSummary {
  const { rows: _rows, ...totals } = summary;
  return totals;
}

// EXPOSED here means "this line's real assembly/test site sits inside the
// active quarantine zone" — i.e. the BOM line's own `status` field, not a
// guess. Catalog parts that aren't on the customer's actual BOM (see
// lib/data/components.ts CATALOG_EXTRAS) never count as exposed: exposure is
// a property of what you build, not of the parts network in general.
const BOM_STATUS_BY_MPN = new Map(BOM.map((b) => [b.mpn.toUpperCase(), b.status]));

// Resolves every row against the real parts network (resolveMpn — the same
// accessor the rest of the app uses). Never fabricates a match: a row whose
// MPN isn't in COMPONENTS comes back unresolved, full stop.
export function resolveUploadRows(
  rows: UploadRow[],
  source: "sample" | "upload",
  fileName?: string
): ResolutionSummary {
  let matched = 0;
  let exposed = 0;

  const resolvedRows: ResolvedRow[] = rows.map((row) => {
    const found = resolveMpn(row.mpn);
    if (!found) {
      return { ...row, matched: false, exposed: false };
    }
    matched++;
    const isExposed = BOM_STATUS_BY_MPN.get(found.mpn.toUpperCase()) === "EXPOSED";
    if (isExposed) exposed++;
    return {
      mpn: row.mpn,
      description: row.description || found.description,
      matched: true,
      exposed: isExposed,
      manufacturer: found.manufacturer,
      assemblyRegion: found.assemblyRegion,
    };
  });

  return {
    source,
    fileName,
    totalRows: rows.length,
    matched,
    unresolved: rows.length - matched,
    exposed,
    rows: resolvedRows,
  };
}
