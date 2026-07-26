import type { BomLine, OwnershipChain } from "@/lib/types";
import { assertBand, assertNoAdjacentRepeats } from "@/lib/data/confidence";

// Per-line provenance documents. Derived from each line's observability, so a
// new line gets sources by construction. Every id resolves in lib/data/sources.ts
// (referential integrity is guarded there). See deriveBomSourceIds below.
//
// Exported because the other six products' bills of materials
// (lib/data/products.ts) attach their documents the same way. A second copy of
// this mapping there is a second thing to keep in step with sources.ts.
export function deriveBomSourceIds(s: Omit<BomLine, "sourceIds">): string[] {
  if (s.provenance === "MODELED") return ["SRC-SUBSTRATE-MKT", "SRC-NET-INFER"];
  if (s.erpBlind) return ["SRC-DIST-ALLOC", "SRC-IMPORT-REC", "SRC-KHH-CUSTOMS"];
  if (s.status === "EXPOSED")
    return ["SRC-ERP-MERIDIAN", "SRC-PROC-MERIDIAN", "SRC-KHH-CUSTOMS"];
  if (s.status === "AT_RISK") return ["SRC-ERP-MERIDIAN", "SRC-LEADTIME"];
  return ["SRC-ERP-MERIDIAN"]; // CLEAR
}

// MD-7200 bill of materials: 31 lines (DATA.md §4).
// Composition (exposed = 14):
//   4  direct Taiwan-sourced, tier 1, procurement already knows   (BOM-01..04)
//   4  exposed via distribution routing through the zone, tier 2  (BOM-05,06,10,11)
//   3  Tier-2 ERP-blind catches, the "TIER-2 CATCHES 3"          (BOM-07,08,09)
//   3  modeled Tier-3, substrate / leadframe inference            (BOM-12,13,14)
//   5  at risk, lead time extending but not zone-exposed          (BOM-15..19)
//  12  clear                                                      (BOM-20..31)
//
// Only the three ERP-blind catches carry erpBlind:true, so
// (erpBlind && tier===2 && EXPOSED) counts to exactly 3.
//
// Lead times run odd more often than even and the deltas are not round:
// quotes come back at 23 and 31 weeks, not 20 and 30, and they move by 7 or
// 2.5 rather than by 5. Downstream surfaces READ these lines instead
// of repeating their numbers, so the strip cannot disagree with the table.
//
// Confidence is authored per line, never a shared constant: see the note at the
// top of confidence.ts for why a column of identical 100%s was the problem.
// BOM-24 has no manufacturer of record, so its manufacturer is the literal
// "n/a". That exact string is a JOIN KEY: lib/data/graph.ts MFR_TO_SUPPLIER
// maps it to S-DIST-C, the regional distributor that supplies the line. Change
// it in one file only and the node silently drops out of the graph.
//
// Authored without `sourceIds`; each line's documents are attached at load by
// deriveBomSourceIds, so every exported BomLine carries a non-empty sourceIds.
const BOM_SEED: Omit<BomLine, "sourceIds">[] = [
  // ---- direct Taiwan-sourced, tier 1 (procurement already knows) ----
  {
    id: "BOM-01",
    mpn: "BM63577S-VC",
    description: "IGBT IPM, 600V 30A, 3-phase power stage",
    manufacturer: "ROHM",
    erpOrigin: "TW",
    actualExposure: "TW-KAOHSIUNG",
    tier: 1,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 96,
    leadTimeWeeks: 23,
    leadTimeDelta: 0,
    qtyPerUnit: 1,
    unitCost: 28.4,
    erpBlind: false,
    supplyPath: [
      { stage: "WAFER FAB", site: "Chikugo, JP", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "BACKEND A&T", site: "Kaohsiung, TW", provenance: "OBSERVED", inQuarantineZone: true },
      { stage: "DISTRIBUTION", site: "Authorized channel", provenance: "OBSERVED", inQuarantineZone: false },
    ],
  },
  {
    id: "BOM-02",
    mpn: "SCS310AMC",
    description: "SiC Schottky diode, 650V 10A, freewheel path",
    manufacturer: "ROHM",
    erpOrigin: "TW",
    actualExposure: "TW-HSINCHU",
    tier: 1,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 94,
    leadTimeWeeks: 19,
    leadTimeDelta: -1,
    qtyPerUnit: 6,
    unitCost: 1.65,
    erpBlind: false,
    supplyPath: [
      { stage: "WAFER FAB", site: "Hsinchu, TW", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "BACKEND A&T", site: "Kaohsiung, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },
  {
    id: "BOM-03",
    mpn: "TMS320F28027PTT",
    description: "C2000 Piccolo MCU, control card",
    manufacturer: "Texas Instruments",
    erpOrigin: "TW",
    actualExposure: "TW-KAOHSIUNG",
    tier: 1,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 97,
    leadTimeWeeks: 27,
    leadTimeDelta: 0,
    qtyPerUnit: 1,
    unitCost: 3.9,
    erpBlind: false,
    supplyPath: [
      { stage: "WAFER FAB", site: "Dallas, TX, USA", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "BACKEND A&T", site: "Kaohsiung, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },
  {
    id: "BOM-04",
    mpn: "TLP2361",
    description: "High-speed optocoupler, gate isolation",
    manufacturer: "Toshiba",
    erpOrigin: "TW",
    actualExposure: "TW-KAOHSIUNG",
    tier: 1,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 93,
    leadTimeWeeks: 31,
    leadTimeDelta: 7,
    qtyPerUnit: 6,
    unitCost: 0.92,
    erpBlind: false,
    supplyPath: [
      { stage: "WAFER FAB", site: "Oita, JP", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "BACKEND A&T", site: "Kaohsiung, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },

  // ---- exposed via distribution routing through the zone, tier 2 ----
  {
    id: "BOM-05",
    mpn: "B32778G4206",
    description: "DC-link film capacitor, 20µF 800V",
    manufacturer: "TDK EPCOS",
    erpOrigin: "DE",
    actualExposure: "TW-TPE",
    tier: 2,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 86,
    leadTimeWeeks: 17,
    leadTimeDelta: 3,
    qtyPerUnit: 2,
    unitCost: 6.2,
    erpBlind: false,
    supplyPath: [
      { stage: "WAFER FAB", site: "Heidenheim, DE", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "DISTRIBUTION", site: "Taipei, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },
  {
    id: "BOM-06",
    mpn: "EETUQ2W331DA",
    description: "DC-link aluminum electrolytic, 330µF 450V",
    manufacturer: "Panasonic",
    erpOrigin: "JP",
    actualExposure: "TW-TPE",
    tier: 2,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 82,
    leadTimeWeeks: 21,
    leadTimeDelta: 5,
    qtyPerUnit: 4,
    unitCost: 3.1,
    erpBlind: false,
    supplyPath: [
      { stage: "WAFER FAB", site: "Matsumoto, JP", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "DISTRIBUTION", site: "Taipei, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },

  // ---- the centerpiece: Tier-2 ERP-blind catch (DATA.md §4) ----
  {
    id: "BOM-07",
    mpn: "ISO5852SDW",
    description: "Isolated IGBT gate driver, reinforced, 5.7kVrms",
    manufacturer: "Texas Instruments",
    erpOrigin: "USA",
    actualExposure: "TW-KAOHSIUNG",
    tier: 2,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 95,
    leadTimeWeeks: 38,
    leadTimeDelta: 11,
    qtyPerUnit: 6,
    unitCost: 4.85,
    erpBlind: true,
    supplyPath: [
      { stage: "WAFER FAB", site: "Dallas, TX, USA", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "BACKEND A&T", site: "Kaohsiung, TW", provenance: "OBSERVED", inQuarantineZone: true },
      { stage: "DISTRIBUTION", site: "Authorized channel", provenance: "OBSERVED", inQuarantineZone: false },
    ],
  },

  // ---- other two Tier-2 ERP-blind catches ----
  {
    id: "BOM-08",
    mpn: "GA3459-BL",
    description: "Gate-drive supply transformer, isolated",
    manufacturer: "Pulse Electronics",
    erpOrigin: "USA",
    actualExposure: "TW-KAOHSIUNG",
    tier: 2,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 89,
    leadTimeWeeks: 25,
    leadTimeDelta: 6,
    qtyPerUnit: 3,
    unitCost: 2.1,
    erpBlind: true,
    supplyPath: [
      { stage: "WAFER FAB", site: "San Diego, USA (design)", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "BACKEND A&T", site: "Kaohsiung, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },
  {
    id: "BOM-09",
    mpn: "CAY16-103J4LF",
    description: "Isolated resistor array, 10kΩ, gate network",
    manufacturer: "Bourns",
    erpOrigin: "USA",
    actualExposure: "TW-KAOHSIUNG",
    tier: 2,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 92,
    leadTimeWeeks: 15,
    leadTimeDelta: 1,
    qtyPerUnit: 4,
    unitCost: 0.38,
    erpBlind: true,
    supplyPath: [
      { stage: "WAFER FAB", site: "Riverside, USA", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "BACKEND A&T", site: "Kaohsiung, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },

  // ---- two more distribution-routed, tier 2 ----
  {
    id: "BOM-10",
    mpn: "CSS2H-2512R-L500",
    description: "Current sense shunt, 5mΩ 3W",
    manufacturer: "Bourns",
    erpOrigin: "USA",
    actualExposure: "TW-TPE",
    tier: 2,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 84,
    leadTimeWeeks: 13,
    leadTimeDelta: 2,
    qtyPerUnit: 3,
    unitCost: 0.85,
    erpBlind: false,
    supplyPath: [
      { stage: "WAFER FAB", site: "Ostrava, CZ", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "DISTRIBUTION", site: "Taipei, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },
  {
    id: "BOM-11",
    mpn: "SN6501DBVR",
    description: "Transformer driver for isolated supply",
    manufacturer: "Texas Instruments",
    erpOrigin: "USA",
    actualExposure: "TW-TPE",
    tier: 2,
    status: "EXPOSED",
    provenance: "OBSERVED",
    confidence: 91,
    leadTimeWeeks: 23,
    leadTimeDelta: 4,
    qtyPerUnit: 3,
    unitCost: 0.75,
    erpBlind: false,
    supplyPath: [
      { stage: "WAFER FAB", site: "Dallas, TX, USA", provenance: "OBSERVED", inQuarantineZone: false },
      { stage: "DISTRIBUTION", site: "Taipei, TW", provenance: "OBSERVED", inQuarantineZone: true },
    ],
  },

  // ---- modeled Tier-3, inferred (violet, dashed) ----
  {
    id: "BOM-12",
    mpn: "LF-C194-INF",
    description: "Leadframe, Cu alloy (module package)",
    manufacturer: "Modeled leadframe supplier",
    erpOrigin: "n/a",
    actualExposure: "TW backend (modeled)",
    tier: 3,
    status: "EXPOSED",
    provenance: "MODELED",
    confidence: 58,
    leadTimeWeeks: 37,
    leadTimeDelta: 6,
    qtyPerUnit: 1,
    unitCost: 0.12,
    erpBlind: false,
    supplyPath: [
      { stage: "SUBSTRATE", site: "Inferred from industry structure", provenance: "MODELED", inQuarantineZone: true },
    ],
  },
  {
    id: "BOM-13",
    mpn: "SUB-BT-INF",
    description: "BT laminate substrate (module package)",
    manufacturer: "Modeled substrate supplier",
    erpOrigin: "n/a",
    actualExposure: "TW-KAOHSIUNG (modeled)",
    tier: 3,
    status: "EXPOSED",
    provenance: "MODELED",
    confidence: 63,
    leadTimeWeeks: 41,
    leadTimeDelta: 9,
    qtyPerUnit: 1,
    unitCost: 0.3,
    erpBlind: false,
    supplyPath: [
      { stage: "SUBSTRATE", site: "Kaohsiung region (modeled)", provenance: "MODELED", inQuarantineZone: true },
    ],
  },
  {
    id: "BOM-14",
    mpn: "PKG-MC-INF",
    description: "Mold compound / bond wire (assembly materials)",
    manufacturer: "Modeled assembly materials",
    erpOrigin: "n/a",
    actualExposure: "TW-KAOHSIUNG (modeled)",
    tier: 3,
    status: "EXPOSED",
    provenance: "MODELED",
    confidence: 74,
    leadTimeWeeks: 33,
    leadTimeDelta: 3,
    qtyPerUnit: 1,
    unitCost: 0.05,
    erpBlind: false,
    supplyPath: [
      { stage: "TEST", site: "Kaohsiung region (modeled)", provenance: "MODELED", inQuarantineZone: true },
    ],
  },

  // ---- at risk (lead time extending, not zone-exposed) ----
  {
    id: "BOM-15",
    mpn: "EEUFR1V471",
    description: "Bus aluminum electrolytic, 470µF 35V",
    manufacturer: "Panasonic",
    erpOrigin: "JP",
    actualExposure: null,
    tier: 1,
    status: "AT_RISK",
    provenance: "OBSERVED",
    confidence: 88,
    leadTimeWeeks: 17,
    leadTimeDelta: 2.5,
    qtyPerUnit: 2,
    unitCost: 2.4,
    erpBlind: false,
  },
  {
    id: "BOM-16",
    mpn: "CRCW0603xxx",
    description: "Gate resistor network, thick film",
    manufacturer: "Vishay",
    erpOrigin: "US",
    actualExposure: null,
    tier: 1,
    status: "AT_RISK",
    provenance: "OBSERVED",
    confidence: 95,
    leadTimeWeeks: 11,
    leadTimeDelta: 1,
    qtyPerUnit: 12,
    unitCost: 0.02,
    erpBlind: false,
  },
  {
    id: "BOM-17",
    mpn: "744273801",
    description: "Common-mode choke, EMC input filter",
    manufacturer: "Würth Elektronik",
    erpOrigin: "DE",
    actualExposure: null,
    tier: 2,
    status: "AT_RISK",
    provenance: "OBSERVED",
    confidence: 83,
    leadTimeWeeks: 19,
    leadTimeDelta: 4,
    qtyPerUnit: 1,
    unitCost: 3.8,
    erpBlind: false,
  },
  {
    id: "BOM-18",
    mpn: "9GA0812P4G01",
    description: "DC axial cooling fan, 80mm",
    manufacturer: "Sanyo Denki",
    erpOrigin: "PH",
    actualExposure: null,
    tier: 2,
    status: "AT_RISK",
    provenance: "OBSERVED",
    confidence: 94,
    leadTimeWeeks: 21,
    leadTimeDelta: 1.5,
    qtyPerUnit: 1,
    unitCost: 9.5,
    erpBlind: false,
  },
  {
    id: "BOM-19",
    mpn: "ACS770LCB-050B",
    description: "Hall-effect current sensor, ±50A",
    manufacturer: "Allegro",
    erpOrigin: "PH",
    actualExposure: null,
    tier: 1,
    status: "AT_RISK",
    provenance: "OBSERVED",
    confidence: 87,
    leadTimeWeeks: 15,
    leadTimeDelta: 3,
    qtyPerUnit: 3,
    unitCost: 2.15,
    erpBlind: false,
  },

  // ---- clear (mundane passives, hardware, enclosure) ----
  {
    id: "BOM-20",
    mpn: "GRM188R71H104K",
    description: "MLCC 0.1µF 50V, decoupling",
    manufacturer: "Murata",
    erpOrigin: "JP",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 98,
    leadTimeWeeks: 9,
    leadTimeDelta: 0,
    qtyPerUnit: 40,
    unitCost: 0.01,
    erpBlind: false,
  },
  {
    id: "BOM-21",
    mpn: "RC0402FR-0710K",
    description: "Chip resistor 0402, 10kΩ 1%",
    manufacturer: "Yageo",
    erpOrigin: "CN",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 96,
    leadTimeWeeks: 7,
    leadTimeDelta: 0,
    qtyPerUnit: 60,
    unitCost: 0.004,
    erpBlind: false,
  },
  {
    id: "BOM-22",
    mpn: "1729131",
    description: "Terminal block, 2-pos 630V",
    manufacturer: "Phoenix Contact",
    erpOrigin: "DE",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 99,
    leadTimeWeeks: 9,
    leadTimeDelta: 0,
    qtyPerUnit: 6,
    unitCost: 1.2,
    erpBlind: false,
  },
  {
    id: "BOM-23",
    mpn: "MD7200-PWR-PCB",
    description: "Power board PCB fabrication, 6-layer",
    manufacturer: "Domestic fab",
    erpOrigin: "US",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 97,
    leadTimeWeeks: 13,
    leadTimeDelta: 0,
    qtyPerUnit: 1,
    unitCost: 14.0,
    erpBlind: false,
  },
  {
    id: "BOM-24",
    mpn: "HS-7200-AL",
    description: "Heatsink extrusion, anodized",
    manufacturer: "n/a",
    erpOrigin: "US",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 81,
    leadTimeWeeks: 11,
    leadTimeDelta: 0,
    qtyPerUnit: 1,
    unitCost: 6.5,
    erpBlind: false,
  },
  {
    id: "BOM-25",
    mpn: "ENC-7200",
    description: "Enclosure sheet metal, powder-coated",
    manufacturer: "Domestic fab",
    erpOrigin: "US",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 98,
    leadTimeWeeks: 7,
    leadTimeDelta: 0,
    qtyPerUnit: 1,
    unitCost: 11.0,
    erpBlind: false,
  },
  {
    id: "BOM-26",
    mpn: "5045480401",
    description: "Control connector, 4-pos 1.25mm",
    manufacturer: "Molex",
    erpOrigin: "MY",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 95,
    leadTimeWeeks: 9,
    leadTimeDelta: 0,
    qtyPerUnit: 4,
    unitCost: 0.45,
    erpBlind: false,
  },
  {
    id: "BOM-27",
    mpn: "GBPC3508",
    description: "Input rectifier bridge, 35A 800V",
    manufacturer: "Diodes Inc",
    erpOrigin: "CN",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 93,
    leadTimeWeeks: 11,
    leadTimeDelta: 0,
    qtyPerUnit: 1,
    unitCost: 2.8,
    erpBlind: false,
  },
  {
    id: "BOM-28",
    mpn: "S14K385",
    description: "Metal-oxide varistor, 385V",
    manufacturer: "Littelfuse",
    erpOrigin: "CN",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 97,
    leadTimeWeeks: 8,
    leadTimeDelta: 0,
    qtyPerUnit: 3,
    unitCost: 0.3,
    erpBlind: false,
  },
  {
    id: "BOM-29",
    mpn: "0215004.MXP",
    description: "Cartridge fuse, 4A 250V",
    manufacturer: "Littelfuse",
    erpOrigin: "US",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 94,
    leadTimeWeeks: 7,
    leadTimeDelta: 0,
    qtyPerUnit: 2,
    unitCost: 0.55,
    erpBlind: false,
  },
  {
    id: "BOM-30",
    mpn: "LTST-C170KGKT",
    description: "LED indicator, green 0805",
    manufacturer: "Lite-On",
    erpOrigin: "CN",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 98,
    leadTimeWeeks: 6,
    leadTimeDelta: 0,
    qtyPerUnit: 2,
    unitCost: 0.06,
    erpBlind: false,
  },
  {
    id: "BOM-31",
    mpn: "HW-KIT-7200",
    description: "Fastener / hardware kit",
    manufacturer: "Domestic",
    erpOrigin: "CN",
    actualExposure: null,
    tier: 1,
    status: "CLEAR",
    provenance: "OBSERVED",
    confidence: 93,
    leadTimeWeeks: 5,
    leadTimeDelta: 0,
    qtyPerUnit: 1,
    unitCost: 0.9,
    erpBlind: false,
  },
];

// Attach per-line provenance documents. Every exported line carries sourceIds.
export const BOM: BomLine[] = BOM_SEED.map((s) => ({
  ...s,
  sourceIds: deriveBomSourceIds(s),
}));

// ---- ownership / affiliates-screening axis (additive) ------------------
// Compliance risk is INDEPENDENT of logistics `status`: a part can be
// quarantine-CLEAR yet ownership-FLAGGED, and vice-versa. Distribution:
//   24 CLEAR · 5 REVIEW · 2 FLAGGED   (non-CLEAR = 7 → the OWNERSHIP chip)
//
// HARD CONSTRAINT (verified below in OWNERSHIP_ASSERTIONS): the 2 FLAGGED
// lines are BOTH logistics-CLEAR (BOM-27, BOM-31). The whole point is that a
// part clean on shipping can still cross the 50% affiliates threshold. The 5
// REVIEW rows are spread across EXPOSED / AT_RISK / CLEAR to underline the two
// axes are orthogonal. Corporate names below are representative/fictional and
// deliberately do NOT touch each line's `manufacturer` (the graph maps on it).

// FLAGGED: ownership chain crosses the 50% threshold via an intermediate
// parent. parentPct ~62, ultimateParent MODELED at conf ~68, thresholdCrossed.
const OWNERSHIP_FLAGGED: Record<string, OwnershipChain> = {
  // GBPC3508 input rectifier bridge: logistics CLEAR, ownership FLAGGED.
  "BOM-27": {
    supplierOfRecord: "Zhongtai Rectifier Trading Co., Ltd",
    parentEntity: "Nanhai Power Semiconductor Holdings",
    parentPct: 62,
    ultimateParent: "Silk Road Industrial Group",
    ultimateParentConf: 68,
    thresholdCrossed: true,
    sourceIds: ["SRC-CORP-REGISTRY", "SRC-IMPORT-REC", "SRC-OWNERSHIP-MDL"],
  },
  // HW-KIT-7200 fastener / hardware kit: logistics CLEAR, ownership FLAGGED.
  "BOM-31": {
    supplierOfRecord: "Meridian Fastener Supply Ltd",
    parentEntity: "Greatwall Hardware Group",
    parentPct: 62,
    ultimateParent: "Yangtze Materials Consortium",
    ultimateParentConf: 61,
    thresholdCrossed: true,
    sourceIds: ["SRC-CORP-REGISTRY", "SRC-IMPORT-REC", "SRC-OWNERSHIP-MDL"],
  },
};

// REVIEW: a chain worth screening but NOT (yet) over the 50% threshold. Shown
// in the drawer without the alarm block. parentPct below 50, ultimate MODELED.
const OWNERSHIP_REVIEW: Record<string, OwnershipChain> = {
  // TDK EPCOS DC-link film cap: logistics EXPOSED, ownership REVIEW.
  "BOM-05": {
    supplierOfRecord: "Rhine Passive Distribution GmbH",
    parentEntity: "Central Europe Components AG",
    parentPct: 44,
    ultimateParent: "Adriatic Holding Partners",
    ultimateParentConf: 52,
    thresholdCrossed: false,
    sourceIds: ["SRC-CORP-REGISTRY", "SRC-OWNERSHIP-MDL"],
  },
  // Bourns current-sense shunt: logistics EXPOSED, ownership REVIEW.
  "BOM-10": {
    supplierOfRecord: "Vanguard Sensing Supply Co.",
    parentEntity: "Pacific Precision Group",
    parentPct: 47,
    ultimateParent: "Kingfisher Capital Partners",
    ultimateParentConf: 57,
    thresholdCrossed: false,
    sourceIds: ["SRC-CORP-REGISTRY", "SRC-OWNERSHIP-MDL"],
  },
  // Würth common-mode choke: logistics AT_RISK, ownership REVIEW.
  "BOM-17": {
    supplierOfRecord: "Baltic Magnetics Vertrieb GmbH",
    parentEntity: "Hanseatic Components Holding",
    parentPct: 41,
    ultimateParent: "North Sea Industrial Trust",
    ultimateParentConf: 49,
    thresholdCrossed: false,
    sourceIds: ["SRC-CORP-REGISTRY", "SRC-OWNERSHIP-MDL"],
  },
  // Yageo chip resistor: logistics CLEAR, ownership REVIEW.
  "BOM-21": {
    supplierOfRecord: "Formosa Passive Trading Co.",
    parentEntity: "Taixin Components Holdings",
    parentPct: 46,
    ultimateParent: "Straits Capital Group",
    ultimateParentConf: 54,
    thresholdCrossed: false,
    sourceIds: ["SRC-CORP-REGISTRY", "SRC-OWNERSHIP-MDL"],
  },
  // Molex control connector: logistics CLEAR, ownership REVIEW.
  "BOM-26": {
    supplierOfRecord: "Selangor Interconnect Sdn Bhd",
    parentEntity: "Peninsula Electronics Group",
    parentPct: 45,
    ultimateParent: "Meridian Asia Holdings",
    ultimateParentConf: 59,
    thresholdCrossed: false,
    sourceIds: ["SRC-CORP-REGISTRY", "SRC-OWNERSHIP-MDL"],
  },
};

// Apply the axis to all 31 lines at module load, so every line gets an explicit
// `ownership`; the 7 non-CLEAR lines also carry an `ownershipChain`.
for (const line of BOM) {
  if (OWNERSHIP_FLAGGED[line.id]) {
    line.ownership = "FLAGGED";
    line.ownershipChain = OWNERSHIP_FLAGGED[line.id];
  } else if (OWNERSHIP_REVIEW[line.id]) {
    line.ownership = "REVIEW";
    line.ownershipChain = OWNERSHIP_REVIEW[line.id];
  } else {
    line.ownership = "CLEAR";
  }
}

// Static copy for the ownership-chain drawer's threshold-crossed alarm block.
// Only rendered when the line's ownershipChain.thresholdCrossed is true.
export const OWNERSHIP_THRESHOLD_NOTE = {
  heading: "50% THRESHOLD CROSSED",
  bodyLines: [
    "Ownership chain crosses the affiliates screening",
    "threshold via intermediate parent. Screening",
    "obligation attaches to this supplier on Nov 10 2026.",
  ],
  redFlag29: "required",
  licenseDetermination: "pending",
  sources:
    "corporate registry filings, import records, supplier disclosures",
};

// Copy for a REVIEW row (chain present, threshold not crossed).
export const OWNERSHIP_REVIEW_NOTE = {
  heading: "BELOW 50% THRESHOLD",
  bodyLines: [
    "Ownership chain does not cross the affiliates",
    "screening threshold. Monitored, since a change in the",
    "intermediate parent stake could attach an obligation.",
  ],
  sources:
    "corporate registry filings, import records, supplier disclosures",
};

export const CENTERPIECE_ID = "BOM-07";

// Drawer copy (DATA.md §4). The ERP-blind warning reuses the part's erpOrigin.
export const ERP_BLIND_WARNING = {
  bodyLines: [
    "Country-of-origin reflects wafer fabrication only.",
    "Assembly and test occur inside the quarantine zone.",
    "This exposure is invisible to ERP-based risk tools.",
  ],
  sources:
    "supplier quality documentation, import records, manufacturer site disclosures",
};

// Tooltip / drawer copy for modeled rows (DATA.md §4). The moat, in-product.
export const MODELED_NOTE =
  "MODELED: inferred from industry structure, not per-part observed. Converts to OBSERVED as network coverage grows.";

// ---- integrity checks (dev-time guard against silent drift) ----
export const BOM_ASSERTIONS = (() => {
  const exposed = BOM.filter((b) => b.status === "EXPOSED").length;
  const atRisk = BOM.filter((b) => b.status === "AT_RISK").length;
  const clear = BOM.filter((b) => b.status === "CLEAR").length;
  const tier2Catches = BOM.filter(
    (b) => b.erpBlind && b.tier === 2 && b.status === "EXPOSED"
  ).length;
  const modeled = BOM.filter((b) => b.provenance === "MODELED").length;
  return { total: BOM.length, exposed, atRisk, clear, tier2Catches, modeled };
})();
// Expected: { total:31, exposed:14, atRisk:5, clear:12, tier2Catches:3, modeled:3 }

// ---- ownership-axis integrity (independent of logistics status) ----
export const OWNERSHIP_ASSERTIONS = (() => {
  const clear = BOM.filter((b) => b.ownership === "CLEAR").length;
  const review = BOM.filter((b) => b.ownership === "REVIEW").length;
  const flagged = BOM.filter((b) => b.ownership === "FLAGGED").length;
  const nonClear = review + flagged; // → the OWNERSHIP chip count
  // Proof of the hard constraint: no FLAGGED line is logistics-exposed.
  const flaggedButShippingExposed = BOM.filter(
    (b) => b.ownership === "FLAGGED" && b.status !== "CLEAR"
  ).length;
  return { clear, review, flagged, nonClear, flaggedButShippingExposed };
})();
// Expected: { clear:24, review:5, flagged:2, nonClear:7, flaggedButShippingExposed:0 }

// ---- confidence-band integrity ----
// Every line's confidence, and every ownership chain's modeled ultimate-parent
// confidence, must be a valid band value for its provenance. Throws on drift.
export const BOM_CONFIDENCE_OK = (() => {
  for (const b of BOM) {
    assertBand(b.confidence, b.provenance, `BOM ${b.id}`);
    if (b.ownershipChain) {
      assertBand(b.ownershipChain.ultimateParentConf, "MODELED", `${b.id} ownership`);
    }
    if (b.sourceIds.length === 0) {
      throw new Error(`BOM ${b.id} has no sourceIds`);
    }
  }
  // The table renders in this order, so consecutive rows must not share a
  // confidence: a run of identical numbers down a column is the tell.
  assertNoAdjacentRepeats(
    BOM.map((b) => b.confidence),
    "BOM confidence column"
  );
  return true;
})();

// The confidence column must actually be a spread, not two values alternating.
// 31 lines with fewer than 12 distinct readings means someone collapsed it.
export const BOM_CONFIDENCE_SPREAD = (() => {
  const values = BOM.map((b) => b.confidence);
  const distinct = new Set(values).size;
  if (distinct < 12) {
    throw new Error(
      `BOM confidence column is too uniform: ${distinct} distinct values across ${values.length} lines`
    );
  }
  return { distinct, min: Math.min(...values), max: Math.max(...values) };
})();
