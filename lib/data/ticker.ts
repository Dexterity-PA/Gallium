import type { TickerItem } from "@/lib/types";
import { BOM } from "@/lib/data/bom";

// Bottom ticker (DATA.md §7).
//
// The old list was thirteen rows of red up-triangle, which is not what a
// market-data strip looks like. It is what a mock of one looks like. Most
// lines on a real ticker are unchanged at any given moment; a few move against
// you, and one or two move in your favour. So this list is roughly half FLAT
// (a level, not a move, so no arrow at all), two green, and four red.
//
// TickerItem.dir (lib/types.ts) now includes "flat", so TICKER_ITEMS below is
// a plain, fully-typed TickerItem[]; components/chrome/Ticker.tsx reads it
// directly with no coercion layer.

// Lead-time rows read the real BOM rather than repeating its numbers, so the
// strip and the EXPOSURE table can never disagree. A line whose quote has not
// moved (delta 0) is flat by construction: the data decides, not the author.
function leadTimeRow(label: string, mpn: string): TickerItem {
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

export const TICKER_ITEMS: TickerItem[] = [
  // Standing states, not moves: a level with an arrow on it is a lie.
  { label: "KAOHSIUNG PORT", value: "QUARANTINE ACTIVE", dir: "flat", critical: true },
  { label: "AFFILIATES RULE", value: "T-110D", dir: "flat", critical: true },

  { label: "MATURE NODE UTIL", value: "94.2%", delta: "+0.4", dir: "up" },
  leadTimeRow("ISO GATE DRVR LT", "ISO5852SDW"), // 38W +11, the anchor spike
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

/** The authored mix, for the handoff and for anything that wants the truth. */
export const TICKER_DIRECTION_MIX = TICKER_ITEMS.reduce(
  (acc, i) => ({ ...acc, [i.dir]: (acc[i.dir] ?? 0) + 1 }),
  {} as Record<TickerItem["dir"], number>
);

// Guard the shape the list is supposed to have: at least half the rows flat,
// and exactly two favourable. Throws at import if someone repaints the strip
// red again.
export const TICKER_MIX_OK = (() => {
  const flat = TICKER_ITEMS.filter((i) => i.dir === "flat").length;
  const green = TICKER_ITEMS.filter((i) => i.dir === "down").length;
  if (flat * 2 < TICKER_ITEMS.length) {
    throw new Error(`ticker: only ${flat}/${TICKER_ITEMS.length} rows are flat, expected about half`);
  }
  if (green !== 2) {
    throw new Error(`ticker: expected exactly 2 favourable rows, found ${green}`);
  }
  return { total: TICKER_ITEMS.length, flat, green, red: TICKER_ITEMS.length - flat - green };
})();
