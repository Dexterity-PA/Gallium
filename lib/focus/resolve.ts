import type { BomLine } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { resolveMpn } from "@/lib/data/components";

// The query-string key the focused part travels under: ?focus=MPN.
// One constant so the palette, the provider and any screen that builds a
// deep link cannot drift onto different spellings.
export const FOCUS_PARAM = "focus";

const BOM_BY_MPN = new Map(BOM.map((b) => [b.mpn.toUpperCase(), b]));
const BOM_BY_ID = new Map(BOM.map((b) => [b.id.toUpperCase(), b]));

// Resolve a raw ?focus= value to a BOM line, or null.
//
// Goes through resolveMpn (lib/data/components.ts), the same exact-match
// accessor the CSV upload flow uses, on purpose: the five deliberately
// off-by-one MPNs in the sample CSV must miss here exactly like they miss
// there. No fuzzy matching, ever. A catalog part that resolves but is not
// on the customer's BOM (CATALOG_EXTRAS) also comes back null: focus is a
// property of what you build, same rule as upload exposure.
//
// Legacy fallback: the command palette used to emit ?focus=BOM-07 (line id).
// An exact, case-insensitive id match keeps those old links working. Ids and
// MPNs are disjoint namespaces, so the two lookups cannot disagree.
export function resolveFocusValue(raw: string | null | undefined): BomLine | null {
  if (!raw) return null;
  const record = resolveMpn(raw);
  if (record) return BOM_BY_MPN.get(record.mpn.toUpperCase()) ?? null;
  return BOM_BY_ID.get(raw.trim().toUpperCase()) ?? null;
}
