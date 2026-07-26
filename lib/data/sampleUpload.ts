import { BOM } from "@/lib/data/bom";
import type { UploadRow } from "@/lib/csv";

// "Use sample BOM" seeds the real 31-line MD-7200 BOM (lib/data/bom.ts),
// so every one of those rows genuinely resolves through resolveMpn() (it's
// the source lib/data/components.ts is built from). A perfect N/N match
// would read as fake, so a handful of deliberately-bad rows are appended:
// typo'd MPNs and genuinely-unknown part numbers that resolveMpn() will
// honestly fail on. The eventual MATCHED/UNRESOLVED split on the resolution
// screen is real: it falls out of resolveUploadRows(), not a fixed ratio.
const INTENTIONALLY_UNRESOLVABLE: UploadRow[] = [
  { mpn: "BM63577S-VD", description: "IGBT IPM, 600V 30A (listed alt, unverified)" }, // typo of BM63577S-VC
  { mpn: "TLP2361X", description: "Optocoupler, logic-gate output (listed alt, unverified)" }, // typo of TLP2361
  { mpn: "SCS310AMD", description: "SiC Schottky diode, 650V 10A (listed alt, unverified)" }, // typo of SCS310AMC
  { mpn: "XC9536-QFP44", description: "CPLD, second-source candidate" }, // not in the network
  { mpn: "MDC-9910-ALT", description: "Connector, unlisted alternate" }, // not in the network
];

export const SAMPLE_UPLOAD_ROWS: UploadRow[] = [
  ...BOM.map((b) => ({ mpn: b.mpn, description: b.description })),
  ...INTENTIONALLY_UNRESOLVABLE,
];

// Example rows for the downloadable CSV template, using the exact columns the
// parser expects (mpn, description). One row is deliberately unresolvable so
// a user testing with the template sees the UNRESOLVED path too.
export const CSV_TEMPLATE_ROWS: UploadRow[] = [
  { mpn: "BM63577S-VC", description: "IGBT IPM, 600V 30A, 3-phase power stage" },
  { mpn: "TLP2361", description: "Optocoupler, logic-gate output, isolation" },
  { mpn: "YOUR-MPN-HERE", description: "One row per BOM line" },
];

export const CSV_TEMPLATE_HEADER = ["mpn", "description"];
