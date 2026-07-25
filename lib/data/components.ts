import type { ComponentRecord } from "@/lib/types";
import { BOM } from "@/lib/data/bom";

// MPN lookup table backing upload resolution.
//
// A customer uploads a BOM; each row's MPN is resolved here to recover the true
// assembly/test origin their ERP cannot see (canonicalOrigin is what the ERP
// shows; assemblyRegion is the real backend region — the blind spot). In the
// demo the catalog is seeded from the MD-7200 BOM plus a few parts that are NOT
// on this BOM, so an uploaded line can resolve even when it isn't ours — that's
// what makes the resolution feel like a real catalog rather than an echo.
//
// The interface a real parts-intelligence backend would implement is
// `resolveMpn`; keep call sites on it, not on the array.

function categoryOf(description: string): string {
  const d = description.toLowerCase();
  if (d.includes("igbt") || d.includes("module") || d.includes("ipm")) return "power module";
  if (d.includes("mcu") || d.includes("microcontroller")) return "MCU";
  if (d.includes("optocoupler") || d.includes("isolation") || d.includes("isolat")) return "isolation";
  if (d.includes("diode") || d.includes("rectifier") || d.includes("mosfet") || d.includes("transistor")) return "discrete";
  if (d.includes("capacitor") || d.includes("resistor") || d.includes("inductor") || d.includes("choke") || d.includes("ferrite")) return "passive";
  if (d.includes("connector") || d.includes("header") || d.includes("terminal")) return "interconnect";
  if (d.includes("substrate") || d.includes("leadframe") || d.includes("mold") || d.includes("bond")) return "package material";
  if (d.includes("fastener") || d.includes("hardware") || d.includes("kit")) return "hardware";
  return "component";
}

// The real assembly/test region is the quarantine-zone stage in the supply
// path (backend A&T / substrate / test). Null when nothing in the path sits in
// the zone — i.e. no hidden exposure to recover.
function assemblyRegionOf(line: (typeof BOM)[number]): string | null {
  const zoneStage = line.supplyPath?.find((s) => s.inQuarantineZone);
  return zoneStage ? zoneStage.site : null;
}

const FROM_BOM: ComponentRecord[] = BOM.map((b) => ({
  mpn: b.mpn,
  manufacturer: b.manufacturer,
  description: b.description,
  category: categoryOf(b.description),
  canonicalOrigin: b.erpOrigin,
  assemblyRegion: assemblyRegionOf(b),
  provenance: b.provenance,
  confidence: b.confidence,
  sourceIds: b.sourceIds,
}));

// Catalog parts NOT on the MD-7200 BOM — so an upload with unrelated lines
// still resolves against the network. Agent D / future work can extend this.
const CATALOG_EXTRAS: ComponentRecord[] = [
  {
    mpn: "STGW40H65DFB",
    manufacturer: "STMicroelectronics",
    description: "IGBT, 650V 40A, field-stop trench",
    category: "discrete",
    canonicalOrigin: "IT",
    assemblyRegion: "Shenzhen, CN",
    provenance: "OBSERVED",
    confidence: 100,
    sourceIds: ["SRC-IMPORT-REC"],
  },
  {
    mpn: "IRS2186STRPBF",
    manufacturer: "Infineon",
    description: "Gate driver, high/low-side, 4A",
    category: "isolation",
    canonicalOrigin: "PH",
    assemblyRegion: "Kaohsiung, TW",
    provenance: "OBSERVED",
    confidence: 100,
    sourceIds: ["SRC-IMPORT-REC", "SRC-KHH-CUSTOMS"],
  },
  {
    mpn: "GRM31CR61E106KA12",
    manufacturer: "Murata",
    description: "MLCC, 10µF 25V X5R 1206",
    category: "passive",
    canonicalOrigin: "JP",
    assemblyRegion: null,
    provenance: "OBSERVED",
    confidence: 100,
    sourceIds: ["SRC-IMPORT-REC"],
  },
  {
    mpn: "XAL1010-472MEB",
    manufacturer: "Coilcraft",
    description: "Power inductor, 4.7µH shielded",
    category: "passive",
    canonicalOrigin: "US",
    assemblyRegion: null,
    provenance: "OBSERVED",
    confidence: 100,
    sourceIds: ["SRC-IMPORT-REC"],
  },
];

export const COMPONENTS: ComponentRecord[] = [...FROM_BOM, ...CATALOG_EXTRAS];

const BY_MPN = new Map(COMPONENTS.map((c) => [c.mpn.toUpperCase(), c]));

// Accessor — case-insensitive MPN resolution. Returns undefined for an MPN the
// network has never seen (the honest "unknown" case an upload flow must handle).
export function resolveMpn(mpn: string): ComponentRecord | undefined {
  return BY_MPN.get(mpn.trim().toUpperCase());
}
