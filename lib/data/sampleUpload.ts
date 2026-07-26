import { BOM } from "@/lib/data/bom";
import { resolveMpn } from "@/lib/data/components";
import { toCsv } from "@/lib/csv";
import type { BomLine } from "@/lib/types";

/* ============================================================
   THE COMMITTED SAMPLE ERP EXPORT

   There is no "use sample BOM" button any more. The only way into the
   product is to upload or drop a CSV, so the sample has to BE a CSV: a
   real file, at public/sample/MD-7200-BOM.csv, that goes through the same
   parseCsv -> extractUploadRows -> resolveUploadRows path a customer's
   own export goes through.

   Every row below is DERIVED from lib/data/bom.ts. Nothing here is an
   authored parts list, and that is what keeps the resolution screen's
   36 PARSED / 31 MATCHED / 5 UNRESOLVED true rather than staged: the 31
   come from BOM itself (lib/data/components.ts builds the parts network
   out of the same 31 lines, so they resolve by construction), and the 5
   are MPNs the network genuinely does not hold.

   The file is written by scripts/build-sample-csv.mjs and committed. Run
   that script after touching anything in here or in bom.ts.

   WHY IT IS WIDE. A customer's ERP export is not two columns. It carries
   the internal item number, the revision, the commodity class, the buyer,
   the standard cost, and, crucially, COUNTRY OF ORIGIN, the single field
   the whole product exists to contradict. extractUploadRows reads exactly
   two of these columns (mpn, description) and ignores the rest, so the
   extra width costs the parser nothing and buys the demo a file that
   looks like it came out of somebody's system.
   ============================================================ */

// Deterministic 32-bit FNV-1a. Seeds every synthesized ERP field below, so
// the generated file is byte-identical on every run and the committed CSV
// only changes when the BOM does.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(h: number, list: readonly T[]): T {
  return list[h % list.length];
}

/* ---- the five rows that must not resolve -------------------------------
   A 36/36 match would read as fake. These five fail for the three reasons
   a real BOM upload actually fails:

     1. a vendor-master suffix that was never a real orderable part (the
        alternate suffix on an otherwise valid MPN),
     2. a superseded part carried forward on an old revision,
     3. an internal alternate part number that was never mapped to a
        manufacturer part number.

   Three of them are one character off a part that IS in the network, which
   is the case that matters: a fuzzy matcher would "helpfully" resolve them
   and quietly claim coverage the customer does not have. resolveMpn does
   exact matching and reports the miss, and the guard at the bottom of this
   file proves all five still miss.
   ---------------------------------------------------------------------- */
interface FailedRow {
  mpn: string;
  /** The MPN in the network this row is one edit away from, if any. */
  nearMpn: string | null;
  description: string;
  manufacturer: string;
  /** Country of origin as the vendor master holds it. Blank when no vendor
   *  record exists at all, which is its own kind of realistic. */
  origin: string;
  /** Last purchase order, if the line was ever actually bought. */
  lastPo: string;
  note: string;
}

const UNRESOLVABLE: FailedRow[] = [
  {
    mpn: "BM63577S-VD",
    nearMpn: "BM63577S-VC",
    description: "IGBT IPM, 600V 30A, 3-phase power stage",
    manufacturer: "ROHM",
    origin: "TW",
    lastPo: "",
    note: "AVL alternate suffix, never released by vendor",
  },
  {
    mpn: "SCS310AMD",
    nearMpn: "SCS310AMC",
    description: "SiC Schottky diode, 650V 10A, freewheel path",
    manufacturer: "ROHM",
    origin: "TW",
    lastPo: "",
    note: "AVL alternate suffix, never released by vendor",
  },
  {
    mpn: "XC9536-QFP44",
    nearMpn: null,
    description: "CPLD, 36 macrocell, legacy interlock logic",
    manufacturer: "Xilinx",
    origin: "US",
    lastPo: "2019-08-14",
    note: "superseded, carried on rev C, not reordered since 2019",
  },
  {
    mpn: "TLP2361X",
    nearMpn: "TLP2361",
    description: "High-speed optocoupler, gate isolation",
    manufacturer: "Toshiba",
    origin: "TW",
    lastPo: "",
    note: "AVL alternate suffix, never released by vendor",
  },
  {
    mpn: "MDC-9910-ALT",
    nearMpn: null,
    description: "Control connector, internal alternate",
    manufacturer: "",
    origin: "",
    lastPo: "",
    note: "internal alternate, no MPN mapped in vendor master",
  },
];

/* ---- derived ERP columns ---------------------------------------------- */

// Meridian's internal item number. An ERP keys on its own item master, not on
// the manufacturer's part number; the two columns living side by side is what
// makes the export read as an export.
function itemNumber(mpn: string): string {
  return `MDS-${100000 + (hash(`item:${mpn}`) % 900000)}`;
}

// Drawing revision. Real BOMs are not all at rev A.
function revision(mpn: string): string {
  const h = hash(`rev:${mpn}`);
  return `${String.fromCharCode(65 + (h % 4))}${1 + ((h >>> 5) % 3)}`;
}

// Reference designator run. Derived from the part's own commodity prefix and
// its quantity: 4 gate resistors are R41-R44, one MCU is U7. Blank for the
// lines that carry no designator (mechanical, phantom package material).
const DESIGNATOR_PREFIX: [RegExp, string][] = [
  [/led/i, "DS"],
  [/capacitor|mlcc/i, "C"],
  [/resistor|shunt/i, "R"],
  [/diode|rectifier|varistor/i, "D"],
  [/fuse/i, "F"],
  [/connector|terminal/i, "J"],
  [/choke|inductor|transformer/i, "L"],
  [/fan/i, "B"],
  [/mcu|driver|optocoupler|sensor|igbt|ipm|array/i, "U"],
];

function refDes(line: BomLine): string {
  if (line.provenance === "MODELED") return "";
  const hit = DESIGNATOR_PREFIX.find(([re]) => re.test(line.description));
  if (!hit) return "";
  const prefix = hit[1];
  const start = 1 + (hash(`ref:${line.mpn}`) % 60);
  if (line.qtyPerUnit === 1) return `${prefix}${start}`;
  return `${prefix}${start}-${prefix}${start + line.qtyPerUnit - 1}`;
}

// Commodity class comes off the parts network's own category, so the export
// classifies a part the same way the app does.
function commodity(mpn: string): string {
  return resolveMpn(mpn)?.category.toUpperCase() ?? "COMPONENT";
}

// The buying desk. Assigned by commodity class, the way a real purchasing org
// splits its book, so the column varies for a reason rather than at random.
const BUYERS: Record<string, string> = {
  "POWER MODULE": "R.HALVERSEN",
  DISCRETE: "R.HALVERSEN",
  ISOLATION: "R.HALVERSEN",
  MCU: "A.OKONKWO",
  PASSIVE: "A.OKONKWO",
  INTERCONNECT: "A.OKONKWO",
  HARDWARE: "T.VESELY",
  COMPONENT: "T.VESELY",
};

// The ERP's planning lead time is the QUOTED one it was last updated with,
// which is the pre-move baseline (leadTimeWeeks - leadTimeDelta), not the
// number the part is quoting today. That gap is real and it is the reason
// procurement gets surprised: 38 weeks of ISO5852SDW is planned at 27.
function plannedLeadWeeks(line: BomLine): number {
  return Math.max(1, Math.round(line.leadTimeWeeks - line.leadTimeDelta));
}

// Last purchase order against the line. Derived, and deliberately absent on
// the phantom package-material rows, which are never bought.
function lastPo(line: BomLine): string {
  if (line.provenance === "MODELED") return "";
  const h = hash(`po:${line.mpn}`);
  const month = 1 + (h % 6);
  const day = 1 + ((h >>> 4) % 28);
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const PLANTS = ["ROC-01", "ROC-02"] as const;

/* ---- the export ------------------------------------------------------- */

export const ERP_EXPORT_HEADER = [
  "Level",
  "Item Number",
  "Rev",
  "MPN",
  "Description",
  "Manufacturer",
  "Commodity Class",
  "UOM",
  "Qty Per",
  "Ref Des",
  "Country of Origin",
  "Std Cost",
  "Ext Cost",
  "Planning Lead Time (wks)",
  "Make/Buy",
  "Buyer",
  "Last PO",
  "Plant",
  "Notes",
];

function bomRow(line: BomLine): string[] {
  // Package material is a phantom item on the parent module's indented BOM:
  // level 2, no vendor of record, no buyer, never purchased as a line. That
  // is also exactly how it sits in bom.ts, as MODELED tier-3.
  const phantom = line.provenance === "MODELED";
  const cls = commodity(line.mpn);
  return [
    phantom ? "2" : "1",
    itemNumber(line.mpn),
    revision(line.mpn),
    line.mpn,
    line.description,
    phantom || line.manufacturer === "n/a" ? "" : line.manufacturer,
    cls,
    "EA",
    String(line.qtyPerUnit),
    refDes(line),
    line.erpOrigin === "n/a" ? "" : line.erpOrigin,
    line.unitCost.toFixed(4),
    (line.unitCost * line.qtyPerUnit).toFixed(2),
    String(plannedLeadWeeks(line)),
    phantom ? "PHANTOM" : "BUY",
    phantom ? "" : (BUYERS[cls] ?? "T.VESELY"),
    lastPo(line),
    pick(hash(`plant:${line.mpn}`), PLANTS),
    phantom ? "package material, non-purchased" : "",
  ];
}

function failedRow(row: FailedRow): string[] {
  const h = hash(`fail:${row.mpn}`);
  return [
    "1",
    itemNumber(row.mpn),
    revision(row.mpn),
    row.mpn,
    row.description,
    row.manufacturer,
    commodity(row.nearMpn ?? row.mpn),
    "EA",
    String(1 + (h % 4)),
    "",
    row.origin,
    "",
    "",
    "",
    "BUY",
    "",
    row.lastPo,
    pick(h, PLANTS),
    row.note,
  ];
}

/* ---- row order --------------------------------------------------------
   The 31 real lines in BOM order, with the five bad rows interleaved where
   an ERP would actually put them: an alternate suffix sits next to the part
   it shadows, a superseded item sits with the control-board group, an
   unmapped internal alternate sits with the interconnects. Bunching all five
   at the end would make the live log read as "the good ones, then the
   failures", which is not how a real file resolves.
   ---------------------------------------------------------------------- */
const AFTER: Record<string, string[]> = {
  "BM63577S-VC": ["BM63577S-VD"],
  SCS310AMC: ["SCS310AMD"],
  TMS320F28027PTT: ["XC9536-QFP44"],
  TLP2361: ["TLP2361X"],
  "5045480401": ["MDC-9910-ALT"],
};

const FAILED_BY_MPN = new Map(UNRESOLVABLE.map((r) => [r.mpn, r]));

export const ERP_EXPORT_ROWS: string[][] = BOM.flatMap((line) => {
  const rows = [bomRow(line)];
  for (const mpn of AFTER[line.mpn] ?? []) {
    const failed = FAILED_BY_MPN.get(mpn);
    if (failed) rows.push(failedRow(failed));
  }
  return rows;
});

/** The exact bytes committed to public/sample/MD-7200-BOM.csv. */
export function buildErpExportCsv(): string {
  return toCsv(ERP_EXPORT_HEADER, ERP_EXPORT_ROWS);
}

export const SAMPLE_CSV_PATH = "public/sample/MD-7200-BOM.csv";

/* ---- guards -----------------------------------------------------------
   The resolution screen reports 36 PARSED / 31 MATCHED / 5 UNRESOLVED. That
   split has to fall out of the file, so it is asserted here at module load
   rather than trusted: every one of the 31 BOM MPNs must resolve, every one
   of the 5 bad MPNs must not, and the interleave must not have dropped a row.
   ---------------------------------------------------------------------- */
export const ERP_EXPORT_ASSERTIONS = (() => {
  if (ERP_EXPORT_ROWS.length !== BOM.length + UNRESOLVABLE.length) {
    throw new Error(
      `sample export: ${ERP_EXPORT_ROWS.length} rows built from ${BOM.length} BOM lines ` +
        `and ${UNRESOLVABLE.length} unresolvable rows`
    );
  }
  for (const line of BOM) {
    if (!resolveMpn(line.mpn)) {
      throw new Error(`sample export: BOM line ${line.mpn} does not resolve`);
    }
  }
  for (const row of UNRESOLVABLE) {
    if (resolveMpn(row.mpn)) {
      throw new Error(
        `sample export: ${row.mpn} was meant to miss the parts network but resolves`
      );
    }
    if (row.nearMpn && !resolveMpn(row.nearMpn)) {
      throw new Error(`sample export: near-miss target ${row.nearMpn} is not in the network`);
    }
  }
  const mpnCol = ERP_EXPORT_HEADER.indexOf("MPN");
  const seen = new Set(ERP_EXPORT_ROWS.map((r) => r[mpnCol]));
  if (seen.size !== ERP_EXPORT_ROWS.length) {
    throw new Error("sample export: duplicate MPN in the export");
  }
  return {
    rows: ERP_EXPORT_ROWS.length,
    matched: BOM.length,
    unresolved: UNRESOLVABLE.length,
  };
})();
// Expected: { rows: 36, matched: 31, unresolved: 5 }

// Example rows for the downloadable CSV template, using the exact columns the
// parser expects (mpn, description). One row is deliberately unresolvable so
// a user testing with the template sees the UNRESOLVED path too.
export const CSV_TEMPLATE_ROWS = [
  { mpn: "BM63577S-VC", description: "IGBT IPM, 600V 30A, 3-phase power stage" },
  { mpn: "TLP2361", description: "Optocoupler, logic-gate output, isolation" },
  { mpn: "YOUR-MPN-HERE", description: "One row per BOM line" },
];

export const CSV_TEMPLATE_HEADER = ["mpn", "description"];
