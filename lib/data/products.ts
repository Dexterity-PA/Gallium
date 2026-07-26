import type {
  BomLine,
  OwnershipChain,
  OwnershipStatus,
  Provenance,
  SupplyPathNode,
  SupplyStage,
  Tier,
} from "@/lib/types";
import { BOM, deriveBomSourceIds } from "@/lib/data/bom";
import { CUSTOMER } from "@/lib/data/customer";
import {
  actualExposureFor,
  deriveStatus,
  productExposure,
  stageWithZone,
} from "@/lib/derive/exposure";
import { assertBand, assertNoAdjacentRepeats } from "@/lib/data/confidence";

/* ============================================================
   THE OTHER SIX BILLS OF MATERIALS

   Meridian builds seven products. Until now one of them (MD-7200) had a
   resolved BOM and the other six had a line count, a build value and a
   supplier-level screen, which is why the PORTFOLIO screen was full of
   tildes and n/a. All seven are resolved now, and every figure the
   portfolio shows about them is computed the same way MD-7200's is:
   lib/derive/exposure.ts, run against the Kaohsiung quarantine.

   NOTHING IN HERE IS AN EXPOSURE FIGURE. There is no exposed count, no
   value at risk and no days-to-halt authored anywhere in this file. What
   is authored is what a bill of materials actually contains: parts, who
   makes them, what the customer's ERP believes about them, and where each
   one physically goes on its way here. Exposure falls out of the last of
   those. That is the whole argument of the product, so the portfolio has
   to be built that way or the screen is a mock-up of itself.

   HOW THE PRODUCTS DIFFER, because a product line where every product is
   a recoloured copy of the flagship is not a product line:

     MD-5100  the sibling. Same ROHM power stage family, same TI control
              platform, same Kaohsiung backend, one power class down. It
              is exposed for the same reasons MD-7200 is, and that is
              realistic: they share a supply chain.
     MX-880   an active front end, not a drive. European power modules,
              but a control and gate-drive board dense with isolation
              parts that finish in the zone, plus DC-link routed through
              Taipei distribution.
     MD-3400  a cost-optimized micro drive. Japanese IPM, Chinese
              passives, a single TI part and a single optocoupler that
              touch the zone.
     PS-2400  a panel, not a drive: contactors, overloads, breakers,
              wire, an enclosure. Two semiconductors in the whole build,
              which is why a $1.9M product carries the least exposure of
              anything but the fan-coil drive.
     MD-9600  the biggest build in the line and nearly the cleanest,
              because a 160kW power stage is Infineon and TDK out of
              Germany. Its only exposure is the fibre-optic gate-drive
              link, which finishes in Kaohsiung.
     HV-1150  high volume, low cost, sourced through China and Malaysia.
              One Taiwan-assembled optocoupler on the whole BOM.

   MODELED SUB-TIER LINES. Gallium models a sub-tier input only where the
   supply of that input is concentrated enough that losing it stops a
   line: mold compound, BT laminate substrate, leadframe. It does not
   model bond wire, plating chemistry, or marking ink, even though the
   part physically contains all three, because those are fungible and a
   violet row claiming otherwise would be decoration. So a molded module
   with ten assembly inputs contributes two modeled lines, not ten, and
   HV-1150 contributes none at all: nothing on that BOM has a
   concentrated sub-tier input inside the zone.

   CONFIDENCE is authored per line and guarded per product (band-legal, no
   two adjacent rows sharing a value, a real spread), same contract
   lib/data/confidence.ts holds bom.ts to.
   ============================================================ */

/** [stage, site]. Provenance follows the line's own; the zone verdict is
 *  computed from the site by lib/derive/exposure.ts, never hand-flagged. */
type PathSeed = [SupplyStage, string];

interface LineSeed {
  mpn: string;
  desc: string;
  mfr: string;
  /** What the customer's ERP holds for country of origin. */
  origin: string;
  tier: Tier;
  /** Lead time as quoted today, in weeks. */
  lead: number;
  /** Movement against the prior quote. Non-zero with no zone stage is AT_RISK. */
  delta: number;
  qty: number;
  cost: number;
  conf: number;
  modeled?: true;
  erpBlind?: true;
  own?: OwnershipStatus;
  path?: PathSeed[];
}

/* ---- MD-5100 · 3-phase VFD, 400 VAC, 11 kW class · 27 lines ----------- */
const MD5100: LineSeed[] = [
  { mpn: "BM63563S-VC", desc: "IGBT IPM, 600V 20A, 3-phase power stage", mfr: "ROHM", origin: "TW", tier: 1, lead: 21, delta: 4, qty: 1, cost: 21.6, conf: 95,
    path: [["WAFER FAB", "Chikugo, JP"], ["BACKEND A&T", "Kaohsiung, TW"], ["DISTRIBUTION", "Authorized channel"]] },
  { mpn: "SCS306AM", desc: "SiC Schottky diode, 650V 6A, freewheel path", mfr: "ROHM", origin: "TW", tier: 1, lead: 18, delta: 2, qty: 6, cost: 1.2, conf: 93,
    path: [["WAFER FAB", "Chikugo, JP"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "TLP2361", desc: "High-speed optocoupler, gate isolation", mfr: "Toshiba", origin: "TW", tier: 1, lead: 29, delta: 6, qty: 6, cost: 0.92, conf: 92,
    path: [["WAFER FAB", "Oita, JP"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "TMS320F280025C", desc: "C2000 Piccolo MCU, control card", mfr: "Texas Instruments", origin: "TW", tier: 1, lead: 25, delta: 5, qty: 1, cost: 4.2, conf: 96,
    path: [["WAFER FAB", "Dallas, TX, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "B32778G4156", desc: "DC-link film capacitor, 15µF 800V", mfr: "TDK EPCOS", origin: "DE", tier: 2, lead: 16, delta: 3, qty: 2, cost: 5.4, conf: 87, own: "REVIEW",
    path: [["WAFER FAB", "Heidenheim, DE"], ["DISTRIBUTION", "Taipei, TW"]] },
  { mpn: "EETUQ2W221DA", desc: "DC-link aluminum electrolytic, 220µF 450V", mfr: "Panasonic", origin: "JP", tier: 2, lead: 19, delta: 4, qty: 3, cost: 2.6, conf: 84,
    path: [["WAFER FAB", "Matsumoto, JP"], ["DISTRIBUTION", "Taipei, TW"]] },
  { mpn: "SN6501DBVR", desc: "Transformer driver for isolated supply", mfr: "Texas Instruments", origin: "USA", tier: 2, lead: 22, delta: 3, qty: 2, cost: 0.75, conf: 91,
    path: [["WAFER FAB", "Dallas, TX, USA"], ["DISTRIBUTION", "Taipei, TW"]] },
  { mpn: "GA3459-BL", desc: "Gate-drive supply transformer, isolated", mfr: "Pulse Electronics", origin: "USA", tier: 2, lead: 24, delta: 5, qty: 2, cost: 2.1, conf: 88, erpBlind: true,
    path: [["WAFER FAB", "San Diego, USA (design)"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "CAY16-103J4LF", desc: "Isolated resistor array, 10kΩ, gate network", mfr: "Bourns", origin: "USA", tier: 2, lead: 14, delta: 1, qty: 3, cost: 0.38, conf: 94, erpBlind: true, own: "REVIEW",
    path: [["WAFER FAB", "Riverside, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "LF-C188-INF", desc: "Leadframe, Cu alloy (IPM package)", mfr: "Modeled leadframe supplier", origin: "n/a", tier: 3, lead: 35, delta: 5, qty: 1, cost: 0.1, conf: 61, modeled: true,
    path: [["SUBSTRATE", "Kaohsiung region (modeled)"]] },
  { mpn: "MC-EP7-INF", desc: "Mold compound, epoxy (IPM package)", mfr: "Modeled assembly materials", origin: "n/a", tier: 3, lead: 30, delta: 2, qty: 1, cost: 0.04, conf: 72, modeled: true,
    path: [["TEST", "Kaohsiung region (modeled)"]] },

  { mpn: "EEUFR1V331", desc: "Bus aluminum electrolytic, 330µF 35V", mfr: "Panasonic", origin: "JP", tier: 1, lead: 15, delta: 2, qty: 2, cost: 1.9, conf: 89 },
  { mpn: "744272801", desc: "Common-mode choke, EMC input filter", mfr: "Würth Elektronik", origin: "DE", tier: 2, lead: 17, delta: 3, qty: 1, cost: 3.2, conf: 82, own: "REVIEW" },
  { mpn: "ACS724LLCTR-20AB", desc: "Hall-effect current sensor, ±20A", mfr: "Allegro", origin: "PH", tier: 1, lead: 13, delta: 1.5, qty: 3, cost: 1.85, conf: 86 },
  { mpn: "9GA0612P4G01", desc: "DC axial cooling fan, 60mm", mfr: "Sanyo Denki", origin: "PH", tier: 2, lead: 19, delta: 2.5, qty: 1, cost: 7.8, conf: 93 },

  { mpn: "GRM188R71H104K", desc: "MLCC 0.1µF 50V, decoupling", mfr: "Murata", origin: "JP", tier: 1, lead: 9, delta: 0, qty: 34, cost: 0.01, conf: 98 },
  { mpn: "RC0402FR-0710K", desc: "Chip resistor 0402, 10kΩ 1%", mfr: "Yageo", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 52, cost: 0.004, conf: 96, own: "REVIEW" },
  { mpn: "1729128", desc: "Terminal block, 2-pos 400V", mfr: "Phoenix Contact", origin: "DE", tier: 1, lead: 8, delta: 0, qty: 5, cost: 0.95, conf: 97 },
  { mpn: "MD5100-PWR-PCB", desc: "Power board PCB fabrication, 4-layer", mfr: "Domestic fab", origin: "US", tier: 1, lead: 11, delta: 0, qty: 1, cost: 9.4, conf: 95 },
  { mpn: "HS-5100-AL", desc: "Heatsink extrusion, anodized", mfr: "Regional extruder", origin: "US", tier: 1, lead: 10, delta: 0, qty: 1, cost: 4.8, conf: 83 },
  { mpn: "ENC-5100", desc: "Enclosure sheet metal, powder-coated", mfr: "Domestic fab", origin: "US", tier: 1, lead: 6, delta: 0, qty: 1, cost: 8.2, conf: 97 },
  { mpn: "5045480401", desc: "Control connector, 4-pos 1.25mm", mfr: "Molex", origin: "MY", tier: 1, lead: 9, delta: 0, qty: 3, cost: 0.45, conf: 94, own: "REVIEW" },
  { mpn: "0215003.MXP", desc: "Cartridge fuse, 3A 250V", mfr: "Littelfuse", origin: "US", tier: 1, lead: 7, delta: 0, qty: 2, cost: 0.52, conf: 96 },
  { mpn: "S14K385", desc: "Metal-oxide varistor, 385V", mfr: "Littelfuse", origin: "CN", tier: 1, lead: 8, delta: 0, qty: 3, cost: 0.3, conf: 93 },
  { mpn: "LTST-C170KGKT", desc: "LED indicator, green 0805", mfr: "Lite-On", origin: "CN", tier: 1, lead: 6, delta: 0, qty: 2, cost: 0.06, conf: 97 },
  { mpn: "GBPC2508", desc: "Input rectifier bridge, 25A 800V", mfr: "Diodes Inc", origin: "CN", tier: 1, lead: 10, delta: 0, qty: 1, cost: 2.1, conf: 92 },
  { mpn: "HW-KIT-5100", desc: "Fastener / hardware kit", mfr: "Domestic", origin: "CN", tier: 1, lead: 5, delta: 0, qty: 1, cost: 0.8, conf: 95 },
];

/* ---- MX-880 · Active front end, regenerative line module · 41 lines ---- */
const MX880: LineSeed[] = [
  { mpn: "ISO5852SDW", desc: "Isolated IGBT gate driver, reinforced, 5.7kVrms", mfr: "Texas Instruments", origin: "USA", tier: 2, lead: 36, delta: 9, qty: 6, cost: 4.85, conf: 95, erpBlind: true,
    path: [["WAFER FAB", "Dallas, TX, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "AMC1311DWV", desc: "Isolated voltage amplifier, DC bus sensing", mfr: "Texas Instruments", origin: "USA", tier: 2, lead: 28, delta: 6, qty: 3, cost: 3.1, conf: 92, erpBlind: true,
    path: [["WAFER FAB", "Dallas, TX, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "TMS320F28377D", desc: "C2000 Delfino MCU, grid-sync control", mfr: "Texas Instruments", origin: "TW", tier: 1, lead: 30, delta: 7, qty: 1, cost: 18.4, conf: 96,
    path: [["WAFER FAB", "Dallas, TX, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "ACPL-C87A", desc: "Isolated voltage sensor, precision", mfr: "Broadcom", origin: "TW", tier: 1, lead: 24, delta: 4, qty: 6, cost: 3.6, conf: 93,
    path: [["WAFER FAB", "Fort Collins, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "B32774D8256", desc: "DC-link film capacitor, 25µF 800V", mfr: "TDK EPCOS", origin: "DE", tier: 2, lead: 18, delta: 3, qty: 6, cost: 7.1, conf: 86, own: "REVIEW",
    path: [["WAFER FAB", "Heidenheim, DE"], ["DISTRIBUTION", "Taipei, TW"]] },
  { mpn: "CSS2H-3920R-L200", desc: "Current sense shunt, 2mΩ 5W", mfr: "Bourns", origin: "USA", tier: 2, lead: 15, delta: 2, qty: 3, cost: 1.6, conf: 84, own: "REVIEW",
    path: [["WAFER FAB", "Ostrava, CZ"], ["DISTRIBUTION", "Taipei, TW"]] },
  { mpn: "SN6505BDBVR", desc: "Transformer driver for isolated bias", mfr: "Texas Instruments", origin: "USA", tier: 2, lead: 21, delta: 3, qty: 4, cost: 0.95, conf: 91,
    path: [["WAFER FAB", "Dallas, TX, USA"], ["DISTRIBUTION", "Taipei, TW"]] },
  { mpn: "750317883", desc: "Gate-drive isolation transformer", mfr: "Würth Elektronik", origin: "DE", tier: 2, lead: 23, delta: 4, qty: 6, cost: 2.8, conf: 88, erpBlind: true, own: "REVIEW",
    path: [["WAFER FAB", "Niedernhall, DE"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "SUB-BT-880-INF", desc: "BT laminate substrate (gate driver package)", mfr: "Modeled substrate supplier", origin: "n/a", tier: 3, lead: 38, delta: 8, qty: 1, cost: 0.28, conf: 64, modeled: true,
    path: [["SUBSTRATE", "Kaohsiung region (modeled)"]] },
  { mpn: "LF-C221-INF", desc: "Leadframe, Cu alloy (isolation package)", mfr: "Modeled leadframe supplier", origin: "n/a", tier: 3, lead: 34, delta: 4, qty: 1, cost: 0.09, conf: 57, modeled: true,
    path: [["SUBSTRATE", "Kaohsiung region (modeled)"]] },

  { mpn: "FF150R12KT4P", desc: "IGBT half-bridge module, 1200V 150A", mfr: "Infineon", origin: "DE", tier: 1, lead: 25, delta: 5, qty: 3, cost: 84.0, conf: 95 },
  { mpn: "DF150BA160", desc: "Rectifier bridge module, 1600V 150A", mfr: "Fuji Electric", origin: "JP", tier: 1, lead: 22, delta: 3, qty: 1, cost: 46.0, conf: 92 },
  { mpn: "B43508-A5477-M", desc: "Bus electrolytic capacitor, 470µF 450V", mfr: "TDK EPCOS", origin: "DE", tier: 2, lead: 20, delta: 4, qty: 6, cost: 9.4, conf: 85, own: "REVIEW" },
  { mpn: "744824101", desc: "LCL filter inductor, 100µH 150A", mfr: "Würth Elektronik", origin: "DE", tier: 2, lead: 24, delta: 6, qty: 3, cost: 38.0, conf: 83, own: "REVIEW" },
  { mpn: "ACS37610KOKATR-150B3", desc: "Hall-effect current sensor, ±150A", mfr: "Allegro", origin: "PH", tier: 1, lead: 16, delta: 2, qty: 3, cost: 4.1, conf: 87 },
  { mpn: "9GV1212P1G03", desc: "DC axial cooling fan, 120mm", mfr: "Sanyo Denki", origin: "PH", tier: 2, lead: 18, delta: 1.5, qty: 2, cost: 16.5, conf: 94 },
  { mpn: "LTC6820IMS", desc: "Isolated SPI transceiver", mfr: "Analog Devices", origin: "MY", tier: 2, lead: 26, delta: 5, qty: 2, cost: 5.3, conf: 89 },

  { mpn: "GRM188R71H104K", desc: "MLCC 0.1µF 50V, decoupling", mfr: "Murata", origin: "JP", tier: 1, lead: 9, delta: 0, qty: 68, cost: 0.01, conf: 98 },
  { mpn: "GRM31CR71H475KA", desc: "MLCC 4.7µF 50V, bulk decoupling", mfr: "Murata", origin: "JP", tier: 1, lead: 10, delta: 0, qty: 24, cost: 0.09, conf: 96 },
  { mpn: "RC0402FR-0710K", desc: "Chip resistor 0402, 10kΩ 1%", mfr: "Yageo", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 88, cost: 0.004, conf: 97, own: "REVIEW" },
  { mpn: "RC0805FR-071K0", desc: "Chip resistor 0805, 1kΩ 1%", mfr: "Yageo", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 34, cost: 0.006, conf: 95, own: "REVIEW" },
  { mpn: "CRCW2512R100", desc: "Current-share resistor, 0.1Ω 1W", mfr: "Vishay", origin: "US", tier: 1, lead: 11, delta: 0, qty: 6, cost: 0.22, conf: 93 },
  { mpn: "1729131", desc: "Terminal block, 2-pos 630V", mfr: "Phoenix Contact", origin: "DE", tier: 1, lead: 9, delta: 0, qty: 8, cost: 1.2, conf: 97 },
  { mpn: "3040804", desc: "Power terminal, 4-pos 1000V", mfr: "Phoenix Contact", origin: "DE", tier: 1, lead: 12, delta: 0, qty: 2, cost: 6.4, conf: 94 },
  { mpn: "5045480401", desc: "Control connector, 4-pos 1.25mm", mfr: "Molex", origin: "MY", tier: 1, lead: 9, delta: 0, qty: 6, cost: 0.45, conf: 96, own: "REVIEW" },
  { mpn: "430450828", desc: "Ribbon connector, 8-pos 3.0mm", mfr: "Molex", origin: "MY", tier: 1, lead: 10, delta: 0, qty: 4, cost: 0.88, conf: 93, own: "REVIEW" },
  { mpn: "MX880-CTL-PCB", desc: "Control board PCB fabrication, 8-layer", mfr: "Domestic fab", origin: "US", tier: 1, lead: 14, delta: 0, qty: 1, cost: 22.0, conf: 95 },
  { mpn: "MX880-PWR-PCB", desc: "Power board PCB fabrication, heavy copper", mfr: "Domestic fab", origin: "US", tier: 1, lead: 12, delta: 0, qty: 1, cost: 17.5, conf: 97 },
  { mpn: "HS-880-AL", desc: "Heatsink extrusion, anodized", mfr: "Regional extruder", origin: "US", tier: 1, lead: 12, delta: 0, qty: 2, cost: 11.2, conf: 84 },
  { mpn: "ENC-880", desc: "Enclosure sheet metal, powder-coated", mfr: "Domestic fab", origin: "US", tier: 1, lead: 7, delta: 0, qty: 1, cost: 14.6, conf: 96 },
  { mpn: "BUS-880-CU", desc: "DC bus bar, tin-plated copper", mfr: "Regional fabricator", origin: "US", tier: 1, lead: 9, delta: 0, qty: 1, cost: 12.8, conf: 92 },
  { mpn: "S20K420", desc: "Metal-oxide varistor, 420V", mfr: "Littelfuse", origin: "CN", tier: 1, lead: 8, delta: 0, qty: 3, cost: 0.44, conf: 95 },
  { mpn: "0216010.MXP", desc: "Cartridge fuse, 10A 250V", mfr: "Littelfuse", origin: "US", tier: 1, lead: 7, delta: 0, qty: 3, cost: 0.61, conf: 97 },
  { mpn: "FWH-200B", desc: "Semiconductor fuse, 200A 500V", mfr: "Mersen", origin: "FR", tier: 2, lead: 15, delta: 0, qty: 3, cost: 18.9, conf: 88 },
  { mpn: "LTST-C170KGKT", desc: "LED indicator, green 0805", mfr: "Lite-On", origin: "CN", tier: 1, lead: 6, delta: 0, qty: 3, cost: 0.06, conf: 98 },
  { mpn: "LTST-C170KRKT", desc: "LED indicator, red 0805", mfr: "Lite-On", origin: "CN", tier: 1, lead: 6, delta: 0, qty: 2, cost: 0.06, conf: 96 },
  { mpn: "1N4148WS", desc: "Small-signal diode, switching", mfr: "onsemi", origin: "PH", tier: 1, lead: 8, delta: 0, qty: 14, cost: 0.02, conf: 94 },
  { mpn: "NTC-10D-13", desc: "Inrush limiter thermistor, 10Ω", mfr: "Ametherm", origin: "US", tier: 1, lead: 10, delta: 0, qty: 3, cost: 0.74, conf: 91 },
  { mpn: "G6RN-1-24VDC", desc: "Precharge relay, 250VAC 8A", mfr: "Omron", origin: "JP", tier: 1, lead: 13, delta: 0, qty: 1, cost: 3.9, conf: 95 },
  { mpn: "TH-PAD-880", desc: "Thermal interface pad, ceramic-filled", mfr: "Regional converter", origin: "US", tier: 1, lead: 6, delta: 0, qty: 3, cost: 1.4, conf: 89 },
  { mpn: "HW-KIT-880", desc: "Fastener / hardware kit", mfr: "Domestic", origin: "CN", tier: 1, lead: 5, delta: 0, qty: 1, cost: 1.6, conf: 93 },
];

/* ---- MD-3400 · Single-phase micro drive, 2.2 kW class · 23 lines ------- */
const MD3400: LineSeed[] = [
  { mpn: "TMS320F280021DPTS", desc: "C2000 Piccolo MCU, control card", mfr: "Texas Instruments", origin: "TW", tier: 1, lead: 23, delta: 4, qty: 1, cost: 2.6, conf: 95,
    path: [["WAFER FAB", "Dallas, TX, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "TLP785", desc: "Phototransistor optocoupler, fault feedback", mfr: "Toshiba", origin: "TW", tier: 1, lead: 17, delta: 2, qty: 4, cost: 0.28, conf: 93,
    path: [["WAFER FAB", "Oita, JP"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "LF-C097-INF", desc: "Leadframe, Cu alloy (MCU package)", mfr: "Modeled leadframe supplier", origin: "n/a", tier: 3, lead: 27, delta: 3, qty: 1, cost: 0.03, conf: 66, modeled: true,
    path: [["SUBSTRATE", "Kaohsiung region (modeled)"]] },

  { mpn: "PS21A7A", desc: "IPM, 600V 15A, single-phase micro drive", mfr: "Mitsubishi Electric", origin: "JP", tier: 1, lead: 20, delta: 4, qty: 1, cost: 12.8, conf: 92 },
  { mpn: "EETED2W101", desc: "DC-link electrolytic, 100µF 450V", mfr: "Panasonic", origin: "JP", tier: 2, lead: 16, delta: 2, qty: 2, cost: 1.9, conf: 88 },
  { mpn: "744231091", desc: "Common-mode choke, EMC input filter", mfr: "Würth Elektronik", origin: "DE", tier: 2, lead: 14, delta: 1.5, qty: 1, cost: 2.1, conf: 85, own: "REVIEW" },

  { mpn: "GBPC1508", desc: "Input rectifier bridge, 15A 800V", mfr: "Diodes Inc", origin: "CN", tier: 1, lead: 9, delta: 0, qty: 1, cost: 1.4, conf: 94 },
  { mpn: "S10K385", desc: "Metal-oxide varistor, 385V", mfr: "Littelfuse", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 2, cost: 0.22, conf: 96 },
  { mpn: "0215002.MXP", desc: "Cartridge fuse, 2A 250V", mfr: "Littelfuse", origin: "US", tier: 1, lead: 6, delta: 0, qty: 2, cost: 0.48, conf: 97 },
  { mpn: "GRM188R71H104K", desc: "MLCC 0.1µF 50V, decoupling", mfr: "Murata", origin: "JP", tier: 1, lead: 9, delta: 0, qty: 22, cost: 0.01, conf: 98 },
  { mpn: "RC0402FR-0710K", desc: "Chip resistor 0402, 10kΩ 1%", mfr: "Yageo", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 38, cost: 0.004, conf: 96, own: "REVIEW" },
  { mpn: "CRCW1206R220", desc: "Gate resistor, 22Ω 0.25W", mfr: "Vishay", origin: "US", tier: 1, lead: 8, delta: 0, qty: 6, cost: 0.03, conf: 93 },
  { mpn: "ACS712ELCTR-20A", desc: "Hall-effect current sensor, ±20A", mfr: "Allegro", origin: "PH", tier: 1, lead: 12, delta: 0, qty: 1, cost: 1.65, conf: 91 },
  { mpn: "5045480401", desc: "Control connector, 4-pos 1.25mm", mfr: "Molex", origin: "MY", tier: 1, lead: 9, delta: 0, qty: 2, cost: 0.45, conf: 95, own: "REVIEW" },
  { mpn: "1729122", desc: "Terminal block, 2-pos 300V", mfr: "Phoenix Contact", origin: "DE", tier: 1, lead: 8, delta: 0, qty: 3, cost: 0.72, conf: 97 },
  { mpn: "MD3400-PWR-PCB", desc: "Power board PCB fabrication, 2-layer", mfr: "Domestic fab", origin: "US", tier: 1, lead: 9, delta: 0, qty: 1, cost: 4.2, conf: 96 },
  { mpn: "HS-3400-AL", desc: "Heatsink extrusion, anodized", mfr: "Regional extruder", origin: "US", tier: 1, lead: 9, delta: 0, qty: 1, cost: 2.3, conf: 82 },
  { mpn: "ENC-3400", desc: "Enclosure ABS moulding, flame-retardant", mfr: "Regional moulder", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 1, cost: 3.1, conf: 94 },
  { mpn: "LTST-C170KGKT", desc: "LED indicator, green 0805", mfr: "Lite-On", origin: "CN", tier: 1, lead: 6, delta: 0, qty: 2, cost: 0.06, conf: 97 },
  { mpn: "1N4148WS", desc: "Small-signal diode, switching", mfr: "onsemi", origin: "PH", tier: 1, lead: 8, delta: 0, qty: 9, cost: 0.02, conf: 95 },
  { mpn: "NTC-5D-11", desc: "Inrush limiter thermistor, 5Ω", mfr: "Ametherm", origin: "US", tier: 1, lead: 10, delta: 0, qty: 1, cost: 0.58, conf: 89 },
  { mpn: "9GA0412P3G01", desc: "DC axial cooling fan, 40mm", mfr: "Sanyo Denki", origin: "PH", tier: 2, lead: 15, delta: 0, qty: 1, cost: 4.6, conf: 93 },
  { mpn: "HW-KIT-3400", desc: "Fastener / hardware kit", mfr: "Domestic", origin: "CN", tier: 1, lead: 5, delta: 0, qty: 1, cost: 0.5, conf: 92 },
];

/* ---- PS-2400 · Pump control panel, soft start and bypass · 37 lines ---- */
const PS2400: LineSeed[] = [
  { mpn: "R5F51305ADFM", desc: "RX130 MCU, panel controller", mfr: "Renesas", origin: "TW", tier: 1, lead: 22, delta: 3, qty: 1, cost: 3.4, conf: 94,
    path: [["WAFER FAB", "Naka, JP"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "MOC3063M", desc: "Optoisolated triac driver, contactor interface", mfr: "onsemi", origin: "TW", tier: 1, lead: 16, delta: 2, qty: 6, cost: 0.52, conf: 92,
    path: [["WAFER FAB", "Gresham, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "LF-C142-INF", desc: "Leadframe, Cu alloy (triac driver package)", mfr: "Modeled leadframe supplier", origin: "n/a", tier: 3, lead: 25, delta: 2, qty: 1, cost: 0.02, conf: 62, modeled: true,
    path: [["SUBSTRATE", "Kaohsiung region (modeled)"]] },

  { mpn: "MCC44-16IO1B", desc: "Thyristor module, 44A 1600V, soft start", mfr: "IXYS", origin: "US", tier: 1, lead: 18, delta: 3, qty: 3, cost: 22.4, conf: 89 },
  { mpn: "3RT2026-1BB40", desc: "Line contactor, 25A 3-pole", mfr: "Siemens", origin: "DE", tier: 1, lead: 16, delta: 2, qty: 2, cost: 38.0, conf: 93 },
  { mpn: "3RB3016-1SB0", desc: "Electronic overload relay, 4-12A", mfr: "Siemens", origin: "DE", tier: 1, lead: 19, delta: 4, qty: 1, cost: 62.0, conf: 88 },
  { mpn: "6ES7132-6BF00", desc: "Digital output module, 8DO", mfr: "Siemens", origin: "DE", tier: 2, lead: 21, delta: 5, qty: 1, cost: 74.0, conf: 85 },

  { mpn: "5SY4106-7", desc: "Miniature circuit breaker, 6A C-curve", mfr: "Siemens", origin: "DE", tier: 1, lead: 12, delta: 0, qty: 3, cost: 9.4, conf: 95 },
  { mpn: "3RV2011-1JA10", desc: "Motor protection breaker, 10A", mfr: "Siemens", origin: "DE", tier: 1, lead: 14, delta: 0, qty: 1, cost: 34.0, conf: 92 },
  { mpn: "3TX7004-1AB00", desc: "Interface relay, 24VDC", mfr: "Siemens", origin: "DE", tier: 1, lead: 11, delta: 0, qty: 6, cost: 6.8, conf: 94 },
  { mpn: "1492-J4", desc: "Terminal block, 4mm feed-through", mfr: "Allen-Bradley", origin: "US", tier: 1, lead: 8, delta: 0, qty: 46, cost: 0.62, conf: 97 },
  { mpn: "1492-EBJ3-10", desc: "Terminal jumper, 3-pole", mfr: "Allen-Bradley", origin: "US", tier: 1, lead: 8, delta: 0, qty: 12, cost: 1.1, conf: 95 },
  { mpn: "800FP-P3", desc: "Pilot light, 22mm green LED", mfr: "Allen-Bradley", origin: "MX", tier: 1, lead: 10, delta: 0, qty: 3, cost: 12.2, conf: 93 },
  { mpn: "800FP-SM32", desc: "Selector switch, 22mm 3-position", mfr: "Allen-Bradley", origin: "MX", tier: 1, lead: 10, delta: 0, qty: 2, cost: 18.4, conf: 96 },
  { mpn: "800FP-MT44", desc: "Emergency stop, 22mm mushroom", mfr: "Allen-Bradley", origin: "MX", tier: 1, lead: 11, delta: 0, qty: 1, cost: 26.0, conf: 94 },
  { mpn: "2080-LC20-20QWB", desc: "Panel controller base unit", mfr: "Allen-Bradley", origin: "US", tier: 2, lead: 17, delta: 0, qty: 1, cost: 148.0, conf: 89 },
  { mpn: "PS-2400-HMI", desc: "Operator terminal, 4in monochrome", mfr: "Regional integrator", origin: "US", tier: 2, lead: 15, delta: 0, qty: 1, cost: 96.0, conf: 87 },
  { mpn: "PS2400-CTL-PCB", desc: "Controller board PCB fabrication, 4-layer", mfr: "Domestic fab", origin: "US", tier: 1, lead: 11, delta: 0, qty: 1, cost: 8.6, conf: 95 },
  { mpn: "ENC-2400", desc: "Enclosure, NEMA 12 painted steel", mfr: "Domestic fab", origin: "US", tier: 1, lead: 9, delta: 0, qty: 1, cost: 184.0, conf: 96 },
  { mpn: "PLATE-2400", desc: "Back panel, galvanized steel", mfr: "Domestic fab", origin: "US", tier: 1, lead: 7, delta: 0, qty: 1, cost: 42.0, conf: 98 },
  { mpn: "DIN-35-2400", desc: "DIN rail, 35mm slotted", mfr: "Regional fabricator", origin: "US", tier: 1, lead: 5, delta: 0, qty: 4, cost: 3.2, conf: 94 },
  { mpn: "WD-2400-12", desc: "Panel wire, 12 AWG MTW", mfr: "Regional distributor", origin: "US", tier: 1, lead: 6, delta: 0, qty: 1, cost: 28.0, conf: 92 },
  { mpn: "WD-2400-16", desc: "Panel wire, 16 AWG MTW", mfr: "Regional distributor", origin: "US", tier: 1, lead: 6, delta: 0, qty: 1, cost: 14.5, conf: 95 },
  { mpn: "DUCT-2400", desc: "Wire duct, slotted PVC", mfr: "Regional distributor", origin: "US", tier: 1, lead: 5, delta: 0, qty: 6, cost: 4.1, conf: 93 },
  { mpn: "LUG-2400-6", desc: "Compression lug, 6 AWG", mfr: "Regional distributor", origin: "US", tier: 1, lead: 6, delta: 0, qty: 9, cost: 1.3, conf: 96 },
  { mpn: "FAN-2400-120", desc: "Panel cooling fan, 120mm 115VAC", mfr: "Regional distributor", origin: "US", tier: 1, lead: 9, delta: 0, qty: 1, cost: 22.0, conf: 91 },
  { mpn: "FLT-2400", desc: "Fan filter kit, washable", mfr: "Regional distributor", origin: "US", tier: 1, lead: 7, delta: 0, qty: 1, cost: 8.4, conf: 94 },
  { mpn: "CT-2400-100", desc: "Current transformer, 100:5A", mfr: "Regional instrument supplier", origin: "US", tier: 2, lead: 13, delta: 0, qty: 3, cost: 16.8, conf: 88 },
  { mpn: "TX-2400-24", desc: "Control transformer, 240/24VAC 100VA", mfr: "Regional instrument supplier", origin: "US", tier: 2, lead: 14, delta: 0, qty: 1, cost: 46.0, conf: 92 },
  { mpn: "RS-25-24", desc: "DIN power supply, 24VDC 25W", mfr: "MEAN WELL", origin: "CN", tier: 2, lead: 12, delta: 0, qty: 1, cost: 34.0, conf: 89 },
  { mpn: "0215005.MXP", desc: "Cartridge fuse, 5A 250V", mfr: "Littelfuse", origin: "US", tier: 1, lead: 7, delta: 0, qty: 3, cost: 0.55, conf: 97 },
  { mpn: "S14K420", desc: "Metal-oxide varistor, 420V", mfr: "Littelfuse", origin: "CN", tier: 1, lead: 8, delta: 0, qty: 3, cost: 0.36, conf: 93 },
  { mpn: "GRM188R71H104K", desc: "MLCC 0.1µF 50V, decoupling", mfr: "Murata", origin: "JP", tier: 1, lead: 9, delta: 0, qty: 18, cost: 0.01, conf: 98 },
  { mpn: "RC0402FR-0710K", desc: "Chip resistor 0402, 10kΩ 1%", mfr: "Yageo", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 26, cost: 0.004, conf: 96, own: "REVIEW" },
  { mpn: "5045480401", desc: "Control connector, 4-pos 1.25mm", mfr: "Molex", origin: "MY", tier: 1, lead: 9, delta: 0, qty: 4, cost: 0.45, conf: 94, own: "REVIEW" },
  { mpn: "LBL-2400", desc: "Label / nameplate set, engraved", mfr: "Regional converter", origin: "US", tier: 1, lead: 4, delta: 0, qty: 1, cost: 6.2, conf: 95 },
  { mpn: "HW-KIT-2400", desc: "Fastener / hardware kit", mfr: "Domestic", origin: "CN", tier: 1, lead: 5, delta: 0, qty: 1, cost: 3.4, conf: 92 },
];

/* ---- MD-9600 · 3-phase VFD, 690 VAC, 160 kW class · 52 lines ----------- */
const MD9600: LineSeed[] = [
  { mpn: "AFBR-16A9Z", desc: "Fibre-optic transmitter, gate-drive link", mfr: "Broadcom", origin: "TW", tier: 1, lead: 27, delta: 6, qty: 6, cost: 9.8, conf: 93,
    path: [["WAFER FAB", "Fort Collins, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "AFBR-26A9Z", desc: "Fibre-optic receiver, gate-drive link", mfr: "Broadcom", origin: "TW", tier: 1, lead: 26, delta: 5, qty: 6, cost: 10.4, conf: 95,
    path: [["WAFER FAB", "Fort Collins, USA"], ["BACKEND A&T", "Kaohsiung, TW"]] },
  { mpn: "LF-C315-INF", desc: "Leadframe, Cu alloy (optical package)", mfr: "Modeled leadframe supplier", origin: "n/a", tier: 3, lead: 29, delta: 3, qty: 1, cost: 0.06, conf: 59, modeled: true,
    path: [["SUBSTRATE", "Kaohsiung region (modeled)"]] },

  { mpn: "FF450R12ME4", desc: "IGBT half-bridge module, 1200V 450A", mfr: "Infineon", origin: "DE", tier: 1, lead: 28, delta: 7, qty: 6, cost: 186.0, conf: 94 },
  { mpn: "DD400N16K", desc: "Rectifier diode module, 1600V 400A", mfr: "Infineon", origin: "DE", tier: 1, lead: 24, delta: 5, qty: 6, cost: 92.0, conf: 92 },
  { mpn: "B25620B1108K", desc: "DC-link film capacitor, 1100µF 900V", mfr: "TDK EPCOS", origin: "DE", tier: 2, lead: 26, delta: 6, qty: 6, cost: 148.0, conf: 87, own: "REVIEW" },
  { mpn: "750318921", desc: "Gate-drive isolation transformer", mfr: "Würth Elektronik", origin: "DE", tier: 2, lead: 22, delta: 4, qty: 6, cost: 3.6, conf: 89, own: "REVIEW" },
  { mpn: "LF-510-S", desc: "Hall-effect current transducer, 500A", mfr: "LEM", origin: "CH", tier: 1, lead: 20, delta: 3, qty: 3, cost: 78.0, conf: 91 },
  { mpn: "W2E250-HL06-01", desc: "Radial cooling blower, 250mm", mfr: "ebm-papst", origin: "DE", tier: 2, lead: 19, delta: 2.5, qty: 2, cost: 164.0, conf: 93 },

  { mpn: "XC7A35T-2FGG484C", desc: "Artix-7 FPGA, drive control logic", mfr: "AMD Xilinx", origin: "US", tier: 1, lead: 26, delta: 0, qty: 1, cost: 88.0, conf: 94 },
  { mpn: "MK66FN2M0VLQ18", desc: "Arm Cortex-M4 MCU, panel controller", mfr: "NXP", origin: "MY", tier: 1, lead: 21, delta: 0, qty: 1, cost: 14.2, conf: 92 },
  { mpn: "AMC1301DWV", desc: "Isolated amplifier, phase current sensing", mfr: "Texas Instruments", origin: "US", tier: 2, lead: 23, delta: 0, qty: 3, cost: 2.9, conf: 95 },
  { mpn: "ISO7741DW", desc: "Quad digital isolator", mfr: "Texas Instruments", origin: "US", tier: 2, lead: 19, delta: 0, qty: 4, cost: 2.4, conf: 93 },
  { mpn: "ADUM4121ARIZ", desc: "Isolated gate driver, 6A", mfr: "Analog Devices", origin: "MY", tier: 2, lead: 22, delta: 0, qty: 6, cost: 4.6, conf: 96 },
  { mpn: "LM5164DDAR", desc: "Wide-Vin buck regulator, control supply", mfr: "Texas Instruments", origin: "US", tier: 1, lead: 17, delta: 0, qty: 3, cost: 2.1, conf: 94 },
  { mpn: "RKZE-2415D", desc: "Isolated DC/DC converter, 2W 24/15V", mfr: "RECOM", origin: "AT", tier: 2, lead: 15, delta: 0, qty: 6, cost: 8.9, conf: 91 },
  { mpn: "B43456-S9508-M", desc: "Bus electrolytic capacitor, 5000µF 450V", mfr: "TDK EPCOS", origin: "DE", tier: 2, lead: 23, delta: 0, qty: 12, cost: 28.4, conf: 88, own: "REVIEW" },
  { mpn: "GRM31CR71H475KA", desc: "MLCC 4.7µF 50V, bulk decoupling", mfr: "Murata", origin: "JP", tier: 1, lead: 10, delta: 0, qty: 42, cost: 0.09, conf: 97 },
  { mpn: "GRM188R71H104K", desc: "MLCC 0.1µF 50V, decoupling", mfr: "Murata", origin: "JP", tier: 1, lead: 9, delta: 0, qty: 96, cost: 0.01, conf: 98 },
  { mpn: "RC0402FR-0710K", desc: "Chip resistor 0402, 10kΩ 1%", mfr: "Yageo", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 124, cost: 0.004, conf: 96, own: "REVIEW" },
  { mpn: "RC0805FR-074K7", desc: "Chip resistor 0805, 4.7kΩ 1%", mfr: "Yageo", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 48, cost: 0.006, conf: 94, own: "REVIEW" },
  { mpn: "CRCW2512R050", desc: "Gate resistor, 0.05Ω 1W", mfr: "Vishay", origin: "US", tier: 1, lead: 11, delta: 0, qty: 12, cost: 0.26, conf: 92 },
  { mpn: "HVR3700003904FR500", desc: "High-voltage bleeder resistor, 3.9MΩ", mfr: "Vishay", origin: "US", tier: 2, lead: 16, delta: 0, qty: 6, cost: 3.8, conf: 89 },
  { mpn: "1N4148WS", desc: "Small-signal diode, switching", mfr: "onsemi", origin: "PH", tier: 1, lead: 8, delta: 0, qty: 28, cost: 0.02, conf: 95 },
  { mpn: "SMBJ33CA", desc: "TVS diode, 33V bidirectional", mfr: "Littelfuse", origin: "CN", tier: 1, lead: 9, delta: 0, qty: 12, cost: 0.18, conf: 93 },
  { mpn: "S20K550", desc: "Metal-oxide varistor, 550V", mfr: "Littelfuse", origin: "CN", tier: 1, lead: 9, delta: 0, qty: 6, cost: 0.68, conf: 96 },
  { mpn: "FWH-800A", desc: "Semiconductor fuse, 800A 500V", mfr: "Mersen", origin: "FR", tier: 2, lead: 18, delta: 0, qty: 3, cost: 86.0, conf: 87 },
  { mpn: "0216015.MXP", desc: "Cartridge fuse, 15A 250V", mfr: "Littelfuse", origin: "US", tier: 1, lead: 7, delta: 0, qty: 3, cost: 0.64, conf: 95 },
  { mpn: "3040854", desc: "Power terminal, 4-pos 1000V", mfr: "Phoenix Contact", origin: "DE", tier: 1, lead: 13, delta: 0, qty: 3, cost: 9.6, conf: 92 },
  { mpn: "1729131", desc: "Terminal block, 2-pos 630V", mfr: "Phoenix Contact", origin: "DE", tier: 1, lead: 9, delta: 0, qty: 14, cost: 1.2, conf: 97 },
  { mpn: "5045480401", desc: "Control connector, 4-pos 1.25mm", mfr: "Molex", origin: "MY", tier: 1, lead: 9, delta: 0, qty: 8, cost: 0.45, conf: 95, own: "REVIEW" },
  { mpn: "430450828", desc: "Ribbon connector, 8-pos 3.0mm", mfr: "Molex", origin: "MY", tier: 1, lead: 10, delta: 0, qty: 6, cost: 0.88, conf: 93, own: "REVIEW" },
  { mpn: "FO-JUMP-1M", desc: "Fibre-optic duplex jumper, 1m", mfr: "Regional distributor", origin: "US", tier: 1, lead: 8, delta: 0, qty: 6, cost: 6.4, conf: 91 },
  { mpn: "MD9600-CTL-PCB", desc: "Control board PCB fabrication, 10-layer", mfr: "Domestic fab", origin: "US", tier: 1, lead: 16, delta: 0, qty: 1, cost: 46.0, conf: 96 },
  { mpn: "MD9600-GD-PCB", desc: "Gate-drive board PCB fabrication, 6-layer", mfr: "Domestic fab", origin: "US", tier: 1, lead: 14, delta: 0, qty: 6, cost: 18.2, conf: 94 },
  { mpn: "MD9600-PWR-PCB", desc: "Power board PCB fabrication, heavy copper", mfr: "Domestic fab", origin: "US", tier: 1, lead: 15, delta: 0, qty: 1, cost: 52.0, conf: 97 },
  { mpn: "BUS-9600-CU", desc: "DC bus bar assembly, laminated copper", mfr: "Regional fabricator", origin: "US", tier: 1, lead: 14, delta: 0, qty: 1, cost: 186.0, conf: 92 },
  { mpn: "HS-9600-AL", desc: "Heatsink, extruded and machined", mfr: "Regional extruder", origin: "US", tier: 1, lead: 15, delta: 0, qty: 6, cost: 74.0, conf: 85 },
  { mpn: "TH-PAD-9600", desc: "Thermal interface pad, ceramic-filled", mfr: "Regional converter", origin: "US", tier: 1, lead: 6, delta: 0, qty: 6, cost: 2.8, conf: 89 },
  { mpn: "ENC-9600", desc: "Enclosure sheet metal, powder-coated", mfr: "Domestic fab", origin: "US", tier: 1, lead: 12, delta: 0, qty: 1, cost: 312.0, conf: 96 },
  { mpn: "DOOR-9600", desc: "Cabinet door assembly, hinged", mfr: "Domestic fab", origin: "US", tier: 1, lead: 11, delta: 0, qty: 1, cost: 128.0, conf: 94 },
  { mpn: "GLAND-9600", desc: "Cable gland plate, EMC", mfr: "Domestic fab", origin: "US", tier: 1, lead: 8, delta: 0, qty: 1, cost: 36.0, conf: 97 },
  { mpn: "FLT-9600-DU", desc: "du/dt output filter, 3-phase", mfr: "Regional magnetics builder", origin: "US", tier: 2, lead: 21, delta: 0, qty: 1, cost: 268.0, conf: 86 },
  { mpn: "CHK-9600-DC", desc: "DC link choke, 160kW class", mfr: "Regional magnetics builder", origin: "US", tier: 2, lead: 22, delta: 0, qty: 1, cost: 224.0, conf: 88 },
  { mpn: "CT-9600-600", desc: "Current transformer, 600:5A", mfr: "Regional instrument supplier", origin: "US", tier: 2, lead: 14, delta: 0, qty: 3, cost: 24.6, conf: 92 },
  { mpn: "TX-9600-24", desc: "Control transformer, 480/24VAC 250VA", mfr: "Regional instrument supplier", origin: "US", tier: 2, lead: 15, delta: 0, qty: 1, cost: 88.0, conf: 94 },
  { mpn: "G7L-2A-BUB", desc: "Precharge contactor, 480VAC 25A", mfr: "Omron", origin: "JP", tier: 1, lead: 14, delta: 0, qty: 1, cost: 62.0, conf: 96 },
  { mpn: "NTC-20D-20", desc: "Inrush limiter thermistor, 20Ω", mfr: "Ametherm", origin: "US", tier: 1, lead: 10, delta: 0, qty: 3, cost: 1.9, conf: 91 },
  { mpn: "LTST-C170KGKT", desc: "LED indicator, green 0805", mfr: "Lite-On", origin: "CN", tier: 1, lead: 6, delta: 0, qty: 4, cost: 0.06, conf: 98 },
  { mpn: "LTST-C170KRKT", desc: "LED indicator, red 0805", mfr: "Lite-On", origin: "CN", tier: 1, lead: 6, delta: 0, qty: 3, cost: 0.06, conf: 96 },
  { mpn: "LBL-9600", desc: "Label / nameplate set, engraved", mfr: "Regional converter", origin: "US", tier: 1, lead: 4, delta: 0, qty: 1, cost: 8.6, conf: 93 },
  { mpn: "HW-KIT-9600", desc: "Fastener / hardware kit", mfr: "Domestic", origin: "CN", tier: 1, lead: 5, delta: 0, qty: 1, cost: 6.4, conf: 95 },
];

/* ---- HV-1150 · HVAC fan-coil drive, 1.5 kW class · 19 lines ------------ */
const HV1150: LineSeed[] = [
  { mpn: "TLP785", desc: "Phototransistor optocoupler, fault feedback", mfr: "Toshiba", origin: "TW", tier: 1, lead: 15, delta: 2, qty: 3, cost: 0.28, conf: 92,
    path: [["WAFER FAB", "Oita, JP"], ["BACKEND A&T", "Kaohsiung, TW"]] },

  { mpn: "FSBB15CH60C", desc: "Motion SPM IPM, 600V 15A", mfr: "onsemi", origin: "KR", tier: 1, lead: 17, delta: 3, qty: 1, cost: 9.6, conf: 91 },
  { mpn: "EETHC2W820", desc: "DC-link electrolytic, 82µF 450V", mfr: "Panasonic", origin: "JP", tier: 2, lead: 14, delta: 1.5, qty: 2, cost: 1.4, conf: 88 },

  { mpn: "GBPC0808", desc: "Input rectifier bridge, 8A 800V", mfr: "Diodes Inc", origin: "CN", tier: 1, lead: 8, delta: 0, qty: 1, cost: 0.94, conf: 95 },
  { mpn: "GD32F303CBT6", desc: "Arm Cortex-M4 MCU, fan-coil control", mfr: "GigaDevice", origin: "CN", tier: 1, lead: 14, delta: 0, qty: 1, cost: 1.85, conf: 89 },
  { mpn: "GRM188R71H104K", desc: "MLCC 0.1µF 50V, decoupling", mfr: "Murata", origin: "JP", tier: 1, lead: 9, delta: 0, qty: 16, cost: 0.01, conf: 97 },
  { mpn: "RC0402FR-0710K", desc: "Chip resistor 0402, 10kΩ 1%", mfr: "Yageo", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 28, cost: 0.004, conf: 96, own: "REVIEW" },
  { mpn: "CRCW1206R100", desc: "Shunt resistor, 0.1Ω 0.25W", mfr: "Vishay", origin: "US", tier: 1, lead: 8, delta: 0, qty: 3, cost: 0.04, conf: 93 },
  { mpn: "S10K275", desc: "Metal-oxide varistor, 275V", mfr: "Littelfuse", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 1, cost: 0.19, conf: 95 },
  { mpn: "0215002.MXP", desc: "Cartridge fuse, 2A 250V", mfr: "Littelfuse", origin: "US", tier: 1, lead: 6, delta: 0, qty: 1, cost: 0.48, conf: 96 },
  { mpn: "1N4148WS", desc: "Small-signal diode, switching", mfr: "onsemi", origin: "PH", tier: 1, lead: 8, delta: 0, qty: 7, cost: 0.02, conf: 94 },
  { mpn: "744231051", desc: "Common-mode choke, EMC input filter", mfr: "Würth Elektronik", origin: "DE", tier: 2, lead: 12, delta: 0, qty: 1, cost: 1.6, conf: 87, own: "REVIEW" },
  { mpn: "5045480401", desc: "Control connector, 4-pos 1.25mm", mfr: "Molex", origin: "MY", tier: 1, lead: 9, delta: 0, qty: 2, cost: 0.45, conf: 95, own: "REVIEW" },
  { mpn: "1729122", desc: "Terminal block, 2-pos 300V", mfr: "Phoenix Contact", origin: "DE", tier: 1, lead: 8, delta: 0, qty: 2, cost: 0.72, conf: 96 },
  { mpn: "HV1150-PWR-PCB", desc: "Power board PCB fabrication, 2-layer", mfr: "Domestic fab", origin: "US", tier: 1, lead: 8, delta: 0, qty: 1, cost: 2.9, conf: 94 },
  { mpn: "HS-1150-AL", desc: "Heatsink, stamped aluminum", mfr: "Regional fabricator", origin: "CN", tier: 1, lead: 7, delta: 0, qty: 1, cost: 1.2, conf: 86 },
  { mpn: "ENC-1150", desc: "Enclosure ABS moulding, flame-retardant", mfr: "Regional moulder", origin: "CN", tier: 1, lead: 6, delta: 0, qty: 1, cost: 2.4, conf: 93 },
  { mpn: "LTST-C170KGKT", desc: "LED indicator, green 0805", mfr: "Lite-On", origin: "CN", tier: 1, lead: 6, delta: 0, qty: 1, cost: 0.06, conf: 98 },
  { mpn: "HW-KIT-1150", desc: "Fastener / hardware kit", mfr: "Domestic", origin: "CN", tier: 1, lead: 4, delta: 0, qty: 1, cost: 0.36, conf: 92 },
];

/* ---- build ------------------------------------------------------------
   Ownership chains are NOT re-authored here. A supplier's corporate chain is
   a property of the supplier, not of the product it happens to sell into, so
   a line marked REVIEW picks up the chain lib/data/bom.ts already holds for
   that manufacturer. The same Yageo trading entity shows the same parent
   stake on every BOM it appears on, which is what a compliance screen would
   actually produce, and there is one copy of the corporate data.
   ---------------------------------------------------------------------- */
const CHAIN_BY_MFR = new Map<string, OwnershipChain>(
  BOM.filter((b) => b.ownershipChain).map((b) => [b.manufacturer, b.ownershipChain!])
);

function buildLine(code: string, seed: LineSeed, index: number): BomLine {
  const provenance: Provenance = seed.modeled ? "MODELED" : "OBSERVED";
  const supplyPath: SupplyPathNode[] | undefined = seed.path?.map((p) =>
    stageWithZone({ stage: p[0], site: p[1], provenance })
  );
  const ownership = seed.own ?? "CLEAR";
  const chain = ownership === "CLEAR" ? undefined : CHAIN_BY_MFR.get(seed.mfr);
  const line: Omit<BomLine, "sourceIds"> = {
    id: `${code.replace("-", "")}-${String(index + 1).padStart(2, "0")}`,
    mpn: seed.mpn,
    description: seed.desc,
    manufacturer: seed.mfr,
    erpOrigin: seed.origin,
    actualExposure: actualExposureFor(supplyPath),
    tier: seed.tier,
    status: deriveStatus(supplyPath, seed.delta),
    provenance,
    confidence: seed.conf,
    leadTimeWeeks: seed.lead,
    leadTimeDelta: seed.delta,
    qtyPerUnit: seed.qty,
    unitCost: seed.cost,
    erpBlind: seed.erpBlind ?? false,
    supplyPath,
    ownership,
    ownershipChain: chain,
  };
  return { ...line, sourceIds: deriveBomSourceIds(line) };
}

function buildProduct(code: string, seeds: LineSeed[]): BomLine[] {
  return seeds.map((s, i) => buildLine(code, s, i));
}

export interface Product {
  code: string;
  description: string;
  /** This quarter's build value. ERP header record, the one authored figure. */
  quarterlyBuildValue: number;
  lines: BomLine[];
}

const FOCUS = CUSTOMER.focusProduct;

/** All seven products. MD-7200 is lib/data/bom.ts itself, not a copy of it:
 *  the focus product has exactly one bill of materials and every screen in
 *  the app reads that one. */
export const PRODUCTS: Product[] = [
  {
    code: FOCUS.line,
    description: FOCUS.description,
    quarterlyBuildValue: FOCUS.quarterlyBuildValue,
    lines: BOM,
  },
  {
    code: "MD-5100",
    description: "3-phase VFD, 400 VAC, 11 kW class",
    quarterlyBuildValue: 4_400_000,
    lines: buildProduct("MD-5100", MD5100),
  },
  {
    code: "MX-880",
    description: "Active front end, regenerative line module",
    quarterlyBuildValue: 3_200_000,
    lines: buildProduct("MX-880", MX880),
  },
  {
    code: "MD-3400",
    description: "Single-phase micro drive, 2.2 kW class",
    quarterlyBuildValue: 2_600_000,
    lines: buildProduct("MD-3400", MD3400),
  },
  {
    code: "PS-2400",
    description: "Pump control panel, soft start and bypass",
    quarterlyBuildValue: 1_900_000,
    lines: buildProduct("PS-2400", PS2400),
  },
  {
    code: "MD-9600",
    description: "3-phase VFD, 690 VAC, 160 kW class",
    quarterlyBuildValue: 5_800_000,
    lines: buildProduct("MD-9600", MD9600),
  },
  {
    code: "HV-1150",
    description: "HVAC fan-coil drive, 1.5 kW class",
    quarterlyBuildValue: 2_200_000,
    lines: buildProduct("HV-1150", HV1150),
  },
];

const BY_CODE = new Map(PRODUCTS.map((p) => [p.code, p]));

/** Accessor. The EXPOSURE screen scopes itself with this. */
export function productFor(code: string | null | undefined): Product {
  return (code ? BY_CODE.get(code) : undefined) ?? PRODUCTS[0];
}

/* ---- guards -----------------------------------------------------------
   The load-bearing one is the first: MD-7200's 31 authored statuses have to
   come back out of deriveStatus() unchanged. Without it the other six are
   being scored by a rule the flagship was never held to, and the portfolio
   column is not a comparison.
   ---------------------------------------------------------------------- */
export const PRODUCT_ASSERTIONS = (() => {
  for (const line of BOM) {
    const derived = deriveStatus(line.supplyPath, line.leadTimeDelta);
    if (derived !== line.status) {
      throw new Error(
        `products: deriveStatus disagrees with the authored MD-7200 BOM at ${line.id} ` +
          `(${derived} vs ${line.status}). The rule the other six products are ` +
          `scored by no longer reproduces the flagship.`
      );
    }
  }

  const expectedLines: Record<string, number> = {
    "MD-7200": 31,
    "MD-5100": 27,
    "MX-880": 41,
    "MD-3400": 23,
    "PS-2400": 37,
    "MD-9600": 52,
    "HV-1150": 19,
  };

  const summary = PRODUCTS.map((p) => {
    if (p.lines.length !== expectedLines[p.code]) {
      throw new Error(
        `products: ${p.code} built ${p.lines.length} lines, expected ${expectedLines[p.code]}`
      );
    }
    for (const line of p.lines) {
      assertBand(line.confidence, line.provenance, `${p.code} ${line.mpn}`);
      if (line.sourceIds.length === 0) {
        throw new Error(`products: ${p.code} ${line.mpn} has no sourceIds`);
      }
      if (line.ownership !== "CLEAR" && !line.ownershipChain) {
        throw new Error(
          `products: ${p.code} ${line.mpn} is ownership-${line.ownership} with no chain`
        );
      }
      if (line.ownershipChain) {
        assertBand(
          line.ownershipChain.ultimateParentConf,
          "MODELED",
          `${p.code} ${line.mpn} ownership`
        );
      }
    }
    // Same anti-uniformity contract bom.ts holds: the table renders in this
    // order, so a run of identical CONF values down the column is the tell.
    assertNoAdjacentRepeats(
      p.lines.map((l) => l.confidence),
      `${p.code} confidence column`
    );
    const distinct = new Set(p.lines.map((l) => l.confidence)).size;
    if (distinct < Math.min(12, p.lines.length)) {
      throw new Error(
        `products: ${p.code} confidence column is too uniform (${distinct} distinct)`
      );
    }
    // A duplicate MPN inside one BOM is a data-entry slip, not a real BOM.
    if (new Set(p.lines.map((l) => l.mpn)).size !== p.lines.length) {
      throw new Error(`products: ${p.code} repeats an MPN`);
    }
    return { code: p.code, ...productExposure(p.lines, p.quarterlyBuildValue) };
  });

  return summary;
})();
