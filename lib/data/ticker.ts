import type { TickerItem } from "@/lib/types";
import { BOM } from "@/lib/data/bom";

// Bottom ticker (DATA.md §7).
//
// The old list was thirteen rows of red up-triangle, which is not what a
// market-data strip looks like — it is what a mock of one looks like. Most
// lines on a real ticker are unchanged at any given moment; a few move against
// you, and one or two move in your favour. So this list is roughly half FLAT
// (a level, not a move — no arrow at all), two green, and four red.
//
// `dir: "flat"` is authored here but cannot render yet: lib/types.ts types
// TickerItem.dir as "up" | "down" and components/chrome/Ticker.tsx always
// draws one of ▲/▼. Both files are outside this module's ownership, so
// TICKER_ITEMS below coerces flat → "up" on export and the strip stays red
// until that two-line change lands. The authored intent lives in TICKER_SEED
// and is what should survive; see TICKER_FLAT_PENDING.

export type TickerDirection = TickerItem["dir"] | "flat";

export interface TickerSeed extends Omit<TickerItem, "dir"> {
  dir: TickerDirection;
}

// Lead-time rows read the real BOM rather than repeating its numbers, so the
// strip and the EXPOSURE table can never disagree. A line whose quote has not
// moved (delta 0) is flat by construction — the data decides, not the author.
function leadTimeRow(label: string, mpn: string): TickerSeed {
  const line = BOM.find((b) => b.mpn === mpn);
  if (!line) throw new Error(`ticker: no BOM line for MPN ${mpn}`);
  const d = line.leadTimeDelta;
  return {
    label,
    value: `${line.leadTimeWeeks}W`,
    delta: d === 0 ? undefined : `${d > 0 ? "+" : ""}${d}`,
    dir: d === 0 ? "flat" : d > 0 ? "up" : "down",
  };
}

const TICKER_SEED: TickerSeed[] = [
  // Standing states, not moves — a level with an arrow on it is a lie.
  { label: "KAOHSIUNG PORT", value: "QUARANTINE ACTIVE", dir: "flat", critical: true },
  { label: "AFFILIATES RULE", value: "T-110D", dir: "flat", critical: true },

  { label: "MATURE NODE UTIL", value: "94.2%", delta: "+0.4", dir: "up" },
  leadTimeRow("ISO GATE DRVR LT", "ISO5852SDW"), // 38W +11 — the anchor spike
  leadTimeRow("MCU C2000 LT", "TMS320F28027PTT"), // quote held
  leadTimeRow("IGBT MOD 600V LT", "BM63577S-VC"), // quote held
  { label: "TW STRAIT TRANSIT", value: "+9.4D", dir: "up" },
  { label: "AIR FREIGHT TPE-ORD", value: "$8.40/KG", delta: "+2.10", dir: "up" },
  leadTimeRow("SIC SCHOTTKY LT", "SCS310AMC"), // eased a week
  leadTimeRow("OPTOCOUPLER LT", "TLP2361"), // the row the 14:09 feed item is about
  { label: "BT SUBSTRATE SPOT", value: "+2.1%", dir: "flat" },
  { label: "KHH BERTH UTIL", value: "41.0%", dir: "flat" },
  { label: "PENANG BACKEND UTIL", value: "87.5%", dir: "flat" },
  { label: "SGP TRANSSHIP DWELL", value: "2.6D", delta: "-0.4", dir: "down" },
];

/**
 * True while TickerItem.dir cannot express "flat". Remove this, the coercion
 * below, and the `TickerDirection` alias once lib/types.ts accepts "flat" and
 * Ticker.tsx renders no glyph for it.
 */
export const TICKER_FLAT_PENDING = true;

export const TICKER_ITEMS: TickerItem[] = TICKER_SEED.map(({ dir, ...rest }) => ({
  ...rest,
  // flat → "up" (not "down"): a held level is not movement in our favour, and
  // mislabelling it green would be the more misleading of the two coercions.
  dir: dir === "flat" ? "up" : dir,
}));

/** The authored mix, for the handoff and for anything that wants the truth. */
export const TICKER_DIRECTION_MIX = TICKER_SEED.reduce(
  (acc, i) => ({ ...acc, [i.dir]: (acc[i.dir] ?? 0) + 1 }),
  {} as Record<TickerDirection, number>
);

// Guard the shape the list is supposed to have: at least half the rows flat,
// and exactly two favourable. Throws at import if someone repaints the strip
// red again.
export const TICKER_MIX_OK = (() => {
  const flat = TICKER_SEED.filter((i) => i.dir === "flat").length;
  const green = TICKER_SEED.filter((i) => i.dir === "down").length;
  if (flat * 2 < TICKER_SEED.length) {
    throw new Error(`ticker: only ${flat}/${TICKER_SEED.length} rows are flat — expected about half`);
  }
  if (green !== 2) {
    throw new Error(`ticker: expected exactly 2 favourable rows, found ${green}`);
  }
  return { total: TICKER_SEED.length, flat, green, red: TICKER_SEED.length - flat - green };
})();
