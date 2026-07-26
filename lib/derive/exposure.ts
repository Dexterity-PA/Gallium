import type { BomLine, Status, SupplyPathNode } from "@/lib/types";
import { SITES } from "@/lib/data/sites";
import { daysToHalt } from "@/lib/derive/halt";

/* ============================================================
   EXPOSURE DERIVATION: one computation, seven products.

   Until now only MD-7200 had a resolved bill of materials, so "which lines
   are exposed" was a field on a BomLine and nothing had to agree with
   anything. The other six products carried a supplier-level screen and a
   tilde. Now all seven carry a real BOM (lib/data/products.ts), and a
   product's exposure has to be COMPUTED rather than stated, or the
   portfolio is seven independently-authored opinions in a column.

   THE RULE, and it is the same rule MD-7200 was already authored against:

     EXPOSED  a stage of the line's supply path sits inside the quarantine
              zone. Not the country the ERP holds, not where the wafer was
              fabbed: where the part physically is when the port closes.
     AT_RISK  no stage in the zone, but the quoted lead time has moved.
     CLEAR    neither.

   deriveStatus() below is that rule. lib/data/products.ts runs all seven
   products through it, MD-7200 included, and asserts that its 31 authored
   statuses come back unchanged (14 EXPOSED / 5 AT_RISK / 12 CLEAR). That
   assertion is what makes the other six comparable to it: they are not
   scored on a friendlier scale, they are scored on MD-7200's scale.

   WHAT THE ZONE IS. The quarantine halts outbound container traffic at
   Kaohsiung, and the sites that lose their route are the ones sites.ts
   already marks `exposed`. ZONE_REGIONS is read off that list rather than
   restated, so moving the incident moves every product's exposure with it.
   Taipei is in the set and sits ~300km up the island: it is in scope
   because its outbound freight clears through the quarantined port, not
   because it is within some radius of it. A straight-line radius would
   drop it, which is exactly the mistake an ERP makes.
   ============================================================ */

/** Region tokens for the sites the quarantine reaches. Derived from sites.ts:
 *  "Kaohsiung backend A&T" -> "kaohsiung". */
export const ZONE_REGIONS: string[] = SITES.filter((s) => s.exposed).map((s) =>
  s.label.split(" ")[0].toLowerCase()
);

/** Does a supply-path site name a region inside the quarantine zone? */
export function siteInZone(site: string): boolean {
  const s = site.toLowerCase();
  return ZONE_REGIONS.some((r) => s.includes(r));
}

/** Attach the zone verdict to an authored stage, rather than hand-flagging it.
 *  Every product built by lib/data/products.ts gets its inQuarantineZone this
 *  way, so no BOM can quietly decide it is out of scope. */
export function stageWithZone(
  stage: Omit<SupplyPathNode, "inQuarantineZone">
): SupplyPathNode {
  return { ...stage, inQuarantineZone: siteInZone(stage.site) };
}

/** The line has at least one stage inside the zone. */
export function pathInZone(path: SupplyPathNode[] | undefined): boolean {
  return (path ?? []).some((s) => s.inQuarantineZone);
}

/** THE rule. See the header. */
export function deriveStatus(
  path: SupplyPathNode[] | undefined,
  leadTimeDelta: number
): Status {
  if (pathInZone(path)) return "EXPOSED";
  return leadTimeDelta > 0 ? "AT_RISK" : "CLEAR";
}

// Where the exposure actually sits, phrased the way the EXPOSURE table's
// ACTUAL EXPOSURE column phrases it. Derived from the first in-zone stage, so
// the column cannot claim a site the supply path does not contain.
const EXPOSURE_LABEL: [string, string][] = [
  ["kaohsiung", "TW-KAOHSIUNG"],
  ["taipei", "TW-TPE"],
  ["hsinchu", "TW-HSINCHU"],
];

export function actualExposureFor(path: SupplyPathNode[] | undefined): string | null {
  const stage = (path ?? []).find((s) => s.inQuarantineZone);
  if (!stage) return null;
  const site = stage.site.toLowerCase();
  const hit = EXPOSURE_LABEL.find(([token]) => site.includes(token));
  const label = hit ? hit[1] : "TW backend";
  return stage.provenance === "MODELED" ? `${label} (modeled)` : label;
}

/* ---- value at risk ----------------------------------------------------
   The formula lib/derive/impact.ts buildAtRisk() applies to MD-7200,
   generalized to a product carrying its own build value: a unit cannot ship
   without every line on its BOM, so the value exposed is the exposed fraction
   of lines applied to the quarter's build. One formula across all seven rows
   is the point; a second, nicer-looking one for any of them would make the
   column incomparable down its own length.
   ---------------------------------------------------------------------- */
export function riskFor(
  quarterlyBuildValue: number,
  exposed: number,
  lines: number
): number {
  if (lines <= 0) return 0;
  return quarterlyBuildValue * (exposed / lines);
}

export interface ProductExposure {
  lines: number;
  exposedLines: number;
  /** EXPOSED lines that are MODELED sub-tier inputs, not observed parts. */
  modeledExposed: number;
  /** EXPOSED tier-2 lines whose ERP country of origin misleads. */
  tier2Catches: number;
  valueAtRisk: number;
  /** Runway, through the same buffer math every other screen uses. */
  daysToHalt: number;
  /** The longest-lead EXPOSED line, the one the runway is set by. */
  bottleneck: BomLine | null;
}

/** Every figure the PORTFOLIO row shows, computed off the product's own BOM.
 *  Nothing here is authored per product; feed it seven BOMs and the spread is
 *  whatever the seven BOMs say it is. */
export function productExposure(
  lines: BomLine[],
  quarterlyBuildValue: number
): ProductExposure {
  const exposed = lines.filter((b) => b.status === "EXPOSED");
  const halt = daysToHalt(exposed);
  return {
    lines: lines.length,
    exposedLines: exposed.length,
    modeledExposed: exposed.filter((b) => b.provenance === "MODELED").length,
    tier2Catches: exposed.filter((b) => b.tier === 2 && b.erpBlind).length,
    valueAtRisk: riskFor(quarterlyBuildValue, exposed.length, lines.length),
    daysToHalt: halt.daysToHalt,
    bottleneck: halt.bottleneck,
  };
}
