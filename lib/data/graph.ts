import type { GraphData, GraphNode, GraphEdge, Status } from "@/lib/types";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import { BOM } from "@/lib/data/bom";
import { SITES } from "@/lib/data/sites";
import { mulberry32 } from "@/lib/rng";
// The same landmass geometry the map draws. Bundled at build time; used here
// so the placement pass can refuse to put a node in the sea (see deconflict).
import worldTopo from "../../public/geo/world-110m.json";
import { DEMO_SEED } from "@/lib/demo";
import {
  snapConfidence,
  assertConfidence,
  CONFIDENCE_RANGE,
  spanFor,
} from "@/lib/data/confidence";

// Nodes/edges are assembled without sourceIds, then enriched at the end of
// buildGraph: confidences snap onto the band scale and each record gets its
// provenance documents. So every exported GraphNode/GraphEdge carries both a
// band confidence and a non-empty sourceIds.
type NodeSeed = Omit<GraphNode, "sourceIds">;
type EdgeSeed = Omit<GraphEdge, "sourceIds">;

function nodeSources(n: NodeSeed): string[] {
  if (n.provenance === "MODELED") return ["SRC-NET-INFER"];
  if (n.kind === "CUSTOMER") return ["SRC-ERP-MERIDIAN"];
  if (n.kind === "BOM") return ["SRC-ERP-MERIDIAN", "SRC-PROC-MERIDIAN"];
  if (n.kind === "SUPPLIER") return ["SRC-IMPORT-REC", "SRC-PROC-MERIDIAN"];
  return ["SRC-IMPORT-REC", "SRC-LOGI-NET"]; // FAB / BACKEND / LOGISTICS
}

// The one edge in the graph we admit we cannot see well enough to report on.
// Leadframe supply into the modeled leadframe cluster is a single-thread
// inference off market structure: no import record, no filing, one signal.
// It is pinned below the 60% reporting floor and routed to its own inference
// document so the provenance drawer says INSUFFICIENT COVERAGE rather than
// dressing a guess up as a measurement. A tool with no such edge is lying.
export const INSUFFICIENT_COVERAGE_EDGE = { source: "S-LEADFR", target: "NODE-LF" };
export const INSUFFICIENT_COVERAGE_CONFIDENCE = 58;

function isInsufficientCoverage(e: { source: string; target: string }): boolean {
  const { source, target } = INSUFFICIENT_COVERAGE_EDGE;
  return (
    (e.source === source && e.target === target) ||
    (e.source === target && e.target === source)
  );
}

function edgeSources(e: EdgeSeed): string[] {
  if (isInsufficientCoverage(e)) return ["SRC-NET-INFER-THIN"];
  return e.provenance === "MODELED" ? ["SRC-NET-INFER"] : ["SRC-IMPORT-REC"];
}

// Deterministic per-edge confidence.
//
// Every modeled edge used to be exactly 60 and every observed edge exactly 100,
// which meant the EDGES list in the node detail panel rendered the same two
// numbers a hundred times over. How well we can see a link is a property of
// THAT link, so the value is derived from the edge's own endpoints and spread
// across its band. Deterministic (the graph is seeded and must replay
// identically between takes), but no longer uniform.
function hashPair(a: string, b: string): number {
  let h = 2166136261;
  const s = `${a}→${b}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Band = keyof typeof CONFIDENCE_RANGE;

function edgeConf(source: string, target: string, band: Band): number {
  const { lo, hi } = CONFIDENCE_RANGE[band];
  return lo + (hashPair(source, target) % (hi - lo + 1));
}

// ~90 nodes / ~140 edges (DATA.md §5). Built deterministically from the BOM
// so the contamination path (NODE-KHH-ASE → the 14 exposed BOM nodes) is
// correct by construction rather than hand-wired.
//
// Rings: 0 Meridian · 1 the 31 BOM lines · 2 suppliers/manufacturers ·
//        3 fabs / backend / logistics. NODE-KHH-ASE is the propagation origin.

export const PROPAGATION_ORIGIN_ID = "NODE-KHH-ASE";
export const CUSTOMER_NODE_ID = "MERIDIAN";

// ---- ring 2: suppliers (28) --------------------------------------
//
// Every supplier carries a coordinate so RADAR can plot the whole network
// rather than the exposed sliver. The point chosen is the supplier's principal
// PRODUCTION site for the parts Meridian buys, not a registered-office address:
// a map of a supply chain should show where things are made. Where a company's
// obvious campus would land on top of a ring-3 site that already exists (ASE on
// the Kaohsiung backend, Yageo on Taipei distribution), the second-source plant
// is used instead, so two distinct nodes never collapse into one dot at z=1.
//
// The geography is synthetic but not arbitrary: fabs and wafer sites sit in
// real fab country, backend and test in Kaohsiung / Penang / Bangkok / Manila,
// substrate and packaging in Guangdong / Kyushu / Suzhou, distribution in
// Singapore / Rotterdam / Chicago.
interface SupplierDef {
  id: string;
  label: string;
  modeled?: boolean;
  lat: number;
  lng: number;
}
const SUPPLIERS: SupplierDef[] = [
  { id: "S-TI", label: "TI · BACKEND: KAOHSIUNG", lat: 32.9, lng: -96.75 }, // Dallas
  { id: "S-ROHM", label: "ROHM", lat: 34.99, lng: 135.75 }, // Kyoto
  { id: "S-TOSH", label: "Toshiba", lat: 35.53, lng: 139.7 }, // Kawasaki
  // Nikaho sits ON the Akita coastline, which the 110m land polygon cuts
  // inland of; the authored point is held a few km east so the node renders on
  // the landmass it belongs to rather than in the Sea of Japan.
  { id: "S-TDK", label: "TDK EPCOS", lat: 39.25, lng: 140.05 }, // Nikaho, Akita
  { id: "S-PANA", label: "Panasonic", lat: 34.74, lng: 135.57 }, // Kadoma, Osaka
  { id: "S-PULSE", label: "Pulse Electronics", lat: 32.75, lng: -117.1 }, // San Diego
  { id: "S-BOURNS", label: "Bourns", lat: 33.98, lng: -117.37 }, // Riverside
  { id: "S-VISHAY", label: "Vishay", lat: 40.04, lng: -75.51 }, // Malvern PA
  { id: "S-WURTH", label: "Würth Elektronik", lat: 49.28, lng: 9.69 }, // Künzelsau
  { id: "S-SANYO", label: "Sanyo Denki", lat: 36.4, lng: 138.25 }, // Ueda, Nagano
  { id: "S-ALLEGRO", label: "Allegro", lat: 42.99, lng: -71.46 }, // Manchester NH
  { id: "S-MURATA", label: "Murata", lat: 35.37, lng: 132.75 }, // Izumo
  { id: "S-YAGEO", label: "Yageo", lat: 23.02, lng: 113.75 }, // Dongguan, Guangdong
  { id: "S-PHOENIX", label: "Phoenix Contact", lat: 51.95, lng: 9.09 }, // Blomberg
  { id: "S-MOLEX", label: "Molex", lat: 41.8, lng: -88.07 }, // Lisle IL
  { id: "S-DIODES", label: "Diodes Inc", lat: 31.02, lng: 121.8 }, // Shanghai assembly
  { id: "S-LFUSE", label: "Littelfuse", lat: 28.7, lng: -100.52 }, // Piedras Negras
  { id: "S-LITEON", label: "Lite-On", lat: 23.13, lng: 113.26 }, // Guangzhou
  { id: "S-DOM", label: "Domestic fab / metal", lat: 41.5, lng: -81.69 }, // Cleveland
  { id: "S-ASE", label: "ASE Technology Holding", lat: 22.68, lng: 120.36 }, // Kaohsiung
  { id: "S-DIST-A", label: "Authorized distributor: Arrow", lat: 39.58, lng: -104.87 },
  { id: "S-DIST-B", label: "Authorized distributor: Avnet", lat: 33.45, lng: -112.07 },
  { id: "S-DIST-C", label: "Regional distributor", lat: 22.54, lng: 114.06 }, // Shenzhen
  { id: "S-SUBS", label: "Substrate consortium", modeled: true, lat: 31.32, lng: 120.58 }, // Suzhou
  { id: "S-LEADFR", label: "Leadframe supplier", modeled: true, lat: 4.6, lng: 101.09 }, // Ipoh
  { id: "S-ASSY", label: "Assembly materials", modeled: true, lat: 35.18, lng: 136.91 }, // Nagoya
  // The 110m polygon loses the Pearl River delta's shoreline detail, so the
  // Zhuhai point is held inland toward Zhongshan to stay on drawn land.
  { id: "S-PASSIVE", label: "Passive sub-tier", lat: 22.4, lng: 113.4 }, // Zhuhai / Zhongshan
  { id: "S-MAG", label: "Magnetics sub-tier", lat: 21.03, lng: 105.85 }, // Hanoi
];

// Meridian's own plant. Same coordinate as NODE-ROC in lib/data/sites.ts: one
// physical place, so the two datasets must not disagree about where it is.
const MERIDIAN_LAT = 42.27;
const MERIDIAN_LNG = -89.09;

// BOM manufacturer string → supplier id.
const MFR_TO_SUPPLIER: Record<string, string> = {
  "Texas Instruments": "S-TI",
  ROHM: "S-ROHM",
  Toshiba: "S-TOSH",
  "TDK EPCOS": "S-TDK",
  Panasonic: "S-PANA",
  "Pulse Electronics": "S-PULSE",
  Bourns: "S-BOURNS",
  Vishay: "S-VISHAY",
  "Würth Elektronik": "S-WURTH",
  "Sanyo Denki": "S-SANYO",
  Allegro: "S-ALLEGRO",
  Murata: "S-MURATA",
  Yageo: "S-YAGEO",
  "Phoenix Contact": "S-PHOENIX",
  Molex: "S-MOLEX",
  "Diodes Inc": "S-DIODES",
  Littelfuse: "S-LFUSE",
  "Lite-On": "S-LITEON",
  "Domestic fab": "S-DOM",
  "Domestic extrusion": "S-DOM",
  Domestic: "S-DOM",
  "Modeled substrate supplier": "S-SUBS",
  "Modeled leadframe supplier": "S-LEADFR",
  "Modeled assembly materials": "S-ASSY",
  // BOM-24 has no manufacturer of record. It routes through the regional
  // distributor that supplies it, which is all we actually know about it.
  "n/a": "S-DIST-C",
};

// ---- ring 3: sites (30) ------------------------------------------
interface SiteDef {
  id: string;
  label: string;
  kind: "FAB" | "BACKEND" | "LOGISTICS";
  exposed?: boolean;
  lat: number;
  lng: number;
}
// Two provisos on the Taiwan coordinates. (1) The 110m land polygon cuts the
// island's west coast inland of the real shoreline, so Kaohsiung and Hsinchu
// (true positions ~120.30E / 120.97E) are held a few hundredths east: a node
// authored at the real coordinate renders in the drawn strait, which reads as
// an error the projection did not make. Plant and port move by the SAME
// vector, so their true 0.08 degree separation survives. (2) The substrate
// cluster sits in Taoyuan, which is where Taiwan's IC substrate capacity
// actually is; the old point (24.2, 120.6) shared its longitude with the
// Suzhou consortium to the hundredth and drew a dead-vertical lane up the
// China coast.
const GRAPH_SITES: SiteDef[] = [
  { id: "NODE-KHH-ASE", label: "Kaohsiung backend A&T", kind: "BACKEND", exposed: true, lat: 22.63, lng: 120.42 },
  { id: "NODE-HSC", label: "Hsinchu fab cluster", kind: "FAB", exposed: true, lat: 24.81, lng: 121.02 },
  { id: "NODE-TPE", label: "Taipei distribution", kind: "LOGISTICS", exposed: true, lat: 25.03, lng: 121.57 },
  { id: "NODE-PORT-KHH", label: "Kaohsiung port", kind: "LOGISTICS", exposed: true, lat: 22.55, lng: 120.4 },
  { id: "NODE-ZONE-MDL", label: "Backend cluster (modeled)", kind: "BACKEND", exposed: true, lat: 23.0, lng: 120.2 },
  { id: "NODE-SUBS", label: "Substrate cluster (modeled)", kind: "FAB", exposed: true, lat: 24.97, lng: 121.22 },
  { id: "NODE-LF", label: "Leadframe cluster (modeled)", kind: "FAB", exposed: true, lat: 23.6, lng: 120.5 },
  { id: "NODE-DAL", label: "Dallas wafer fab", kind: "FAB", lat: 32.78, lng: -96.8 },
  { id: "NODE-PEN", label: "Penang backend A&T", kind: "BACKEND", lat: 5.41, lng: 100.33 },
  { id: "NODE-SGP", label: "Singapore distribution", kind: "LOGISTICS", lat: 1.35, lng: 103.82 },
  { id: "NODE-KUM", label: "Kumamoto fab", kind: "FAB", lat: 32.8, lng: 130.71 },
  { id: "NODE-DRE", label: "Dresden fab", kind: "FAB", lat: 51.05, lng: 13.74 },
  { id: "NODE-CHI", label: "Chicago inbound", kind: "LOGISTICS", lat: 41.88, lng: -87.63 },
  { id: "NODE-ORD", label: "Chicago O'Hare air freight", kind: "LOGISTICS", lat: 41.98, lng: -87.9 },
  { id: "NODE-CHK", label: "Chikugo fab", kind: "FAB", lat: 33.2, lng: 130.5 },
  { id: "NODE-OITA", label: "Oita backend", kind: "BACKEND", lat: 33.23, lng: 131.6 },
  { id: "NODE-HEI", label: "Heidenheim plant", kind: "FAB", lat: 48.68, lng: 10.15 },
  { id: "NODE-MAT", label: "Matsumoto plant", kind: "FAB", lat: 36.24, lng: 137.97 },
  { id: "NODE-OST", label: "Ostrava plant", kind: "FAB", lat: 49.82, lng: 18.26 },
  { id: "NODE-SD", label: "San Diego design", kind: "FAB", lat: 32.72, lng: -117.16 },
  { id: "NODE-RIV", label: "Riverside plant", kind: "FAB", lat: 33.95, lng: -117.4 },
  { id: "NODE-SHA", label: "Shanghai distribution", kind: "LOGISTICS", lat: 31.23, lng: 121.47 },
  { id: "NODE-MNL", label: "Manila backend", kind: "BACKEND", lat: 14.6, lng: 120.98 },
  { id: "NODE-BKK", label: "Bangkok backend", kind: "BACKEND", lat: 13.75, lng: 100.5 },
  { id: "NODE-CTU", label: "Chengdu fab", kind: "FAB", lat: 30.57, lng: 104.07 },
  { id: "NODE-MUC", label: "Munich hub", kind: "LOGISTICS", lat: 48.14, lng: 11.58 },
  { id: "NODE-GDL", label: "Guadalajara EMS", kind: "BACKEND", lat: 20.67, lng: -103.35 },
  { id: "NODE-LAX", label: "Los Angeles port", kind: "LOGISTICS", lat: 33.74, lng: -118.27 },
  { id: "NODE-LGB", label: "Long Beach port", kind: "LOGISTICS", lat: 33.75, lng: -118.19 },
  { id: "NODE-RTM", label: "Rotterdam port", kind: "LOGISTICS", lat: 51.95, lng: 4.14 },
];

const EXPOSED_SITES = GRAPH_SITES.filter((s) => s.exposed).map((s) => s.id);

// Supplier → primary site, and (if exposed) the zone site it routes through.
// Exposed suppliers point at an exposed site so propagation reaches their BOM.
const SUPPLIER_SITE: Record<string, { primary: string; zone?: string; secondary?: string }> = {
  "S-TI": { primary: "NODE-DAL", zone: "NODE-KHH-ASE", secondary: "NODE-TPE" },
  "S-ROHM": { primary: "NODE-CHK", zone: "NODE-KHH-ASE", secondary: "NODE-HSC" },
  "S-TOSH": { primary: "NODE-OITA", zone: "NODE-KHH-ASE" },
  "S-TDK": { primary: "NODE-HEI", zone: "NODE-TPE" },
  "S-PANA": { primary: "NODE-MAT", zone: "NODE-TPE", secondary: "NODE-PEN" },
  "S-PULSE": { primary: "NODE-SD", zone: "NODE-KHH-ASE" },
  "S-BOURNS": { primary: "NODE-RIV", zone: "NODE-KHH-ASE", secondary: "NODE-TPE" },
  "S-SUBS": { primary: "NODE-SUBS", zone: "NODE-SUBS" },
  "S-LEADFR": { primary: "NODE-LF", zone: "NODE-LF" },
  "S-ASSY": { primary: "NODE-ZONE-MDL", zone: "NODE-ZONE-MDL" },
  // non-exposed suppliers: route through safe sites only
  "S-VISHAY": { primary: "NODE-OST" },
  "S-WURTH": { primary: "NODE-MUC" },
  "S-SANYO": { primary: "NODE-MNL" },
  "S-ALLEGRO": { primary: "NODE-MNL" },
  "S-MURATA": { primary: "NODE-KUM" },
  "S-YAGEO": { primary: "NODE-CTU" },
  "S-PHOENIX": { primary: "NODE-MUC" },
  "S-MOLEX": { primary: "NODE-BKK" },
  "S-DIODES": { primary: "NODE-SHA" },
  "S-LFUSE": { primary: "NODE-GDL" },
  "S-LITEON": { primary: "NODE-CTU" },
  "S-DOM": { primary: "NODE-CHI" },
  "S-ASE": { primary: "NODE-KHH-ASE", zone: "NODE-KHH-ASE" },
  "S-DIST-A": { primary: "NODE-SGP" },
  "S-DIST-B": { primary: "NODE-RTM" },
  "S-DIST-C": { primary: "NODE-SHA" },
  "S-PASSIVE": { primary: "NODE-CTU" },
  "S-MAG": { primary: "NODE-KUM" },
};

// A BOM line is a part, not a place, so it has no coordinate of its own. On the
// map it is drawn where it is MADE: at its manufacturer's production site. Two
// parts from the same manufacturer would then stack exactly, so each is pushed
// onto a small golden-angle ring around that site. The result is a legible
// constellation whose size is the honest signal: a supplier feeding six of
// Meridian's lines draws a visibly bigger cluster than one feeding a single
// line. Degrees, not pixels: under the equirectangular fit a circle in degrees
// is still a circle on screen, so no cos(lat) correction is needed.
//
// Deterministic by construction (index, not RNG). It must NOT draw from the
// seeded `rand` in buildGraph: that stream is consumed in a fixed order by the
// density padding below, and taking from it here would reshuffle every padded
// edge in the graph.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
function bomOffset(k: number): [number, number] {
  const r = 1.7 + 0.55 * k;
  const a = k * GOLDEN_ANGLE;
  return [r * Math.cos(a), r * Math.sin(a)];
}

// Real industrial geography is clustered, and the map should say so: seven of
// the exposed nodes sit inside 2.5° of Taiwan on purpose. But clustered is not
// the same as coincident. A supplier that operates a site it is linked to (TI
// at Dallas, Bourns at Riverside) would otherwise land within a few hundredths
// of a degree of it and stay one indivisible dot at every zoom level, so one of
// the two could never be hovered or selected.
//
// This pass enforces a floor of SEPARATION_DEG between plotted points, and it
// applies only to the SYNTHETIC points: suppliers (whose exact campus is a
// judgment call anyway) and BOM part markers (which have no coordinate of
// their own at all). Ring 3 sites are authored at real places and never move;
// pushing a port off its harbour to win a hover target is the wrong trade.
const SEPARATION_DEG = 0.55;
type Point = { lat: number; lng: number };

// Point-in-polygon against the same topology the map renders. What matters is
// not where the coordinate truly is but where it will be SEEN: a marker that
// the 110m coastline puts in open water reads as a placement bug regardless of
// what the atlas says.
const LAND = feature(
  worldTopo as never,
  (worldTopo as never as { objects: { countries: never } }).objects.countries
) as unknown as GeoJSON.FeatureCollection;
const onLand = (lng: number, lat: number): boolean =>
  LAND.features.some((f) => geoContains(f as never, [lng, lat]));

// Golden-angle spiral out from the AUTHORED point (never from the previous
// attempt) so a node ends up as near its true location as the floor allows,
// and the result depends only on placement order; no RNG, no drift. A
// candidate is accepted only when it is BOTH clear of the floor and on drawn
// land; the previous version checked only the floor, and its main effect was
// to sweep coastal clusters (San Diego, Kaohsiung, Kyushu) out to sea. If the
// spiral finds no on-land opening within 60 steps it falls back to the first
// clear point, sea or not, rather than refusing to place the node.
function deconflict(placed: Point[], lat: number, lng: number): Point {
  const clear = (p: Point) =>
    !placed.some((q) => Math.hypot(q.lat - p.lat, q.lng - p.lng) < SEPARATION_DEG);
  let firstClear: Point | null = null;
  for (let step = 0; step <= 60; step++) {
    const a = step * GOLDEN_ANGLE;
    const r = step === 0 ? 0 : SEPARATION_DEG * (0.75 + 0.16 * step);
    const candidate = { lat: lat + r * Math.sin(a), lng: lng + r * Math.cos(a) };
    if (!clear(candidate)) continue;
    if (onLand(candidate.lng, candidate.lat)) {
      placed.push(candidate);
      return candidate;
    }
    firstClear ??= candidate;
  }
  const fallback = firstClear ?? { lat, lng };
  placed.push(fallback);
  return fallback;
}

// ---- placement pass -----------------------------------------------------
//
// Resolved up front, in a fixed order, so that node PUSH order inside
// buildGraph (customer → BOM → suppliers → sites, which the layout and the
// contamination sequence both depend on) stays exactly as it was. Placement
// order and push order are different concerns and are kept apart.
//
// EVERY ring 3 site is pinned at its authored coordinate, exempt from the
// separation floor. An earlier version pinned only the sites lib/data/sites.ts
// also publishes, which quietly deconflicted the rest: the Kaohsiung PORT (not
// in sites.ts) was spiralled 0.6° into the strait, breaking the one distance
// this file promises to keep: plant to port, 0.08°. That is the real distance
// between them and keeping it is the right call: those two nodes being one
// mark at the home fit is a truthful picture of a plant and the port it ships
// from. Same story for Los Angeles and Long Beach.
const NODE_XY: Record<string, Point> = (() => {
  const placed: Point[] = [];
  const xy: Record<string, Point> = {};

  const pin = (id: string, lat: number, lng: number) => {
    const p = { lat, lng };
    placed.push(p);
    xy[id] = p;
  };
  for (const s of GRAPH_SITES) pin(s.id, s.lat, s.lng);
  pin(CUSTOMER_NODE_ID, MERIDIAN_LAT, MERIDIAN_LNG);

  for (const s of SUPPLIERS) xy[s.id] = deconflict(placed, s.lat, s.lng);

  const perSupplier: Record<string, number> = {};
  for (const b of BOM) {
    const sup = MFR_TO_SUPPLIER[b.manufacturer] ?? "S-DOM";
    const anchor = xy[sup];
    const k = (perSupplier[sup] = (perSupplier[sup] ?? -1) + 1);
    const [dLng, dLat] = bomOffset(k);
    xy[`G-${b.id}`] = deconflict(placed, anchor.lat + dLat, anchor.lng + dLng);
  }
  return xy;
})();

function worst(a: Status, b: Status): Status {
  const rank: Record<Status, number> = { CLEAR: 0, AT_RISK: 1, EXPOSED: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function buildGraph(): GraphData & {
  exposedBomNodeIds: string[];
  adjacency: Record<string, string[]>;
} {
  const rand = mulberry32(DEMO_SEED ^ 0x9e37);
  const nodes: NodeSeed[] = [];
  const edges: EdgeSeed[] = [];
  const supplierStatus: Record<string, Status> = {};
  const siteStatus: Record<string, Status> = {};

  // ring 0
  nodes.push({
    id: CUSTOMER_NODE_ID,
    label: "MERIDIAN",
    kind: "CUSTOMER",
    ring: 0,
    status: "AT_RISK", // center ring turns amber during the sequence
    provenance: "OBSERVED",
    exposureValue: 40,
    ...NODE_XY[CUSTOMER_NODE_ID],
  });

  // ring 1: BOM
  const exposedBomNodeIds: string[] = [];
  for (const b of BOM) {
    const nid = `G-${b.id}`;
    if (b.status === "EXPOSED") exposedBomNodeIds.push(nid);
    nodes.push({
      id: nid,
      label: b.mpn,
      kind: "BOM",
      ring: 1,
      status: b.status,
      provenance: b.provenance,
      exposureValue:
        6 +
        (b.status === "EXPOSED" ? 5 : b.status === "AT_RISK" ? 2 : 0) +
        Math.min(6, b.qtyPerUnit * b.unitCost * 0.15),
      ...NODE_XY[nid],
    });
    // Meridian → BOM (always observed: we observe our own BOM)
    edges.push({
      source: CUSTOMER_NODE_ID,
      target: nid,
      provenance: "OBSERVED",
      confidence: edgeConf(CUSTOMER_NODE_ID, nid, "CONFIRMED"),
    });
    // BOM → supplier
    const sup = MFR_TO_SUPPLIER[b.manufacturer] ?? "S-DOM";
    edges.push({
      source: nid,
      target: sup,
      provenance: b.provenance,
      confidence: b.confidence,
    });
    supplierStatus[sup] = worst(supplierStatus[sup] ?? "CLEAR", b.status);
  }

  // ring 2: suppliers
  for (const s of SUPPLIERS) {
    const st = supplierStatus[s.id] ?? "CLEAR";
    nodes.push({
      id: s.id,
      label: s.label,
      kind: "SUPPLIER",
      ring: 2,
      status: st,
      provenance: s.modeled ? "MODELED" : "OBSERVED",
      exposureValue: 5 + (st === "EXPOSED" ? 4 : st === "AT_RISK" ? 2 : 0),
      ...NODE_XY[s.id],
    });
    // supplier → site(s)
    const link = SUPPLIER_SITE[s.id];
    if (link) {
      const modeled = !!s.modeled;
      edges.push({
        source: s.id,
        target: link.primary,
        provenance: modeled ? "MODELED" : "OBSERVED",
        confidence: isInsufficientCoverage({ source: s.id, target: link.primary })
          ? INSUFFICIENT_COVERAGE_CONFIDENCE
          : edgeConf(s.id, link.primary, modeled ? "MODELED_MED" : "CONFIRMED"),
      });
      if (link.secondary) {
        edges.push({
          source: s.id,
          target: link.secondary,
          provenance: "OBSERVED",
          confidence: edgeConf(s.id, link.secondary, "CONFIRMED"),
        });
      }
      if (link.zone && link.zone !== link.primary) {
        edges.push({
          source: s.id,
          target: link.zone,
          provenance: modeled ? "MODELED" : "OBSERVED",
          confidence: edgeConf(s.id, link.zone, modeled ? "MODELED_MED" : "CONFIRMED"),
        });
        siteStatus[link.zone] = "EXPOSED";
      }
      if (st === "EXPOSED") siteStatus[link.zone ?? link.primary] = "EXPOSED";
    }
  }

  // ring 3: sites
  for (const s of GRAPH_SITES) {
    const st: Status = s.exposed ? "EXPOSED" : siteStatus[s.id] ?? "CLEAR";
    const modeled = s.id.includes("MDL") || s.id === "NODE-SUBS" || s.id === "NODE-LF";
    nodes.push({
      id: s.id,
      label: s.label,
      kind: s.kind,
      ring: 3,
      status: st,
      provenance: modeled ? "MODELED" : "OBSERVED",
      exposureValue: 4 + (st === "EXPOSED" ? 4 : 0),
      ...NODE_XY[s.id],
    });
  }

  // zone linkage: origin reaches every exposed zone site
  for (const z of EXPOSED_SITES) {
    if (z === PROPAGATION_ORIGIN_ID) continue;
    const modeled = z.includes("MDL") || z === "NODE-SUBS" || z === "NODE-LF";
    edges.push({
      source: PROPAGATION_ORIGIN_ID,
      target: z,
      provenance: modeled ? "MODELED" : "OBSERVED",
      confidence: edgeConf(PROPAGATION_ORIGIN_ID, z, modeled ? "MODELED_HIGH" : "CONFIRMED"),
    });
  }

  // logistics realism: quarantine origin → port → air reroute → inbound.
  // The air reroute is the weakest of the three (a booking intent, not a
  // movement we have watched happen), so it reads lower than the two legs
  // either side of it.
  edges.push({
    source: "NODE-KHH-ASE",
    target: "NODE-PORT-KHH",
    provenance: "OBSERVED",
    confidence: edgeConf("NODE-KHH-ASE", "NODE-PORT-KHH", "CONFIRMED"),
  });
  edges.push({
    source: "NODE-PORT-KHH",
    target: "NODE-ORD",
    provenance: "OBSERVED",
    confidence: edgeConf("NODE-PORT-KHH", "NODE-ORD", "CORROBORATED"),
  });
  edges.push({
    source: "NODE-ORD",
    target: "NODE-CHI",
    provenance: "OBSERVED",
    confidence: edgeConf("NODE-ORD", "NODE-CHI", "CONFIRMED"),
  });

  // green-tier density padding (deterministic), never touching exposed nodes
  const greenSites = GRAPH_SITES.filter((s) => !s.exposed).map((s) => s.id);
  const greenSuppliers = SUPPLIERS.filter((s) => (supplierStatus[s.id] ?? "CLEAR") === "CLEAR").map((s) => s.id);
  const pad = (arrA: string[], arrB: string[], count: number, modeledRatio: number) => {
    for (let i = 0; i < count; i++) {
      const a = arrA[Math.floor(rand() * arrA.length)];
      const b = arrB[Math.floor(rand() * arrB.length)];
      if (a === b) continue;
      const modeled = rand() < modeledRatio;
      // Green-tier padding spans all three modeled bands rather than one, so
      // the deep-tier links read as a distribution instead of a constant.
      const band: Band = modeled
        ? (["MODELED_LOW", "MODELED_MED", "MODELED_HIGH"] as const)[Math.floor(rand() * 3)]
        : "CORROBORATED";
      edges.push({
        source: a,
        target: b,
        provenance: modeled ? "MODELED" : "OBSERVED",
        confidence: edgeConf(a, b, band),
      });
    }
  };
  pad(greenSuppliers, greenSites, 18, 0.25); // supplier ↔ site
  pad(greenSites, greenSites, 14, 0.3); // site ↔ site (deep-tier inference)

  // Guarantee connectivity: ring 2/3 nodes with a low degree get pulled into
  // the mesh so the force layout stays compact (no peripheral fly-aways) and
  // reads as a dense, credible network.
  const degree: Record<string, number> = {};
  for (const n of nodes) degree[n.id] = 0;
  for (const e of edges) {
    degree[e.source]++;
    degree[e.target]++;
  }
  const hubIds = nodes.filter((n) => n.ring >= 2).map((n) => n.id);
  for (const n of nodes) {
    if (n.ring < 2) continue;
    let guard = 0;
    while (degree[n.id] < 3 && guard++ < 8) {
      const target = hubIds[Math.floor(rand() * hubIds.length)];
      if (target === n.id) continue;
      const modeled = n.provenance === "MODELED";
      edges.push({
        source: n.id,
        target,
        provenance: modeled ? "MODELED" : "OBSERVED",
        confidence: edgeConf(n.id, target, modeled ? "MODELED_MED" : "CORROBORATED"),
      });
      degree[n.id]++;
      degree[target]++;
    }
  }

  // adjacency (undirected) for the contamination BFS
  const adjacency: Record<string, string[]> = {};
  for (const n of nodes) adjacency[n.id] = [];
  for (const e of edges) {
    adjacency[e.source]?.push(e.target);
    adjacency[e.target]?.push(e.source);
  }

  // enrich: snap confidences onto the band scale, attach provenance documents.
  const finalNodes: GraphNode[] = nodes.map((n) => ({
    ...n,
    sourceIds: nodeSources(n),
  }));
  const finalEdges: GraphEdge[] = edges.map((e) => ({
    ...e,
    confidence: snapConfidence(e.confidence, e.provenance),
    sourceIds: edgeSources(e),
  }));

  return { nodes: finalNodes, edges: finalEdges, exposedBomNodeIds, adjacency };
}

const built = buildGraph();

export const GRAPH: GraphData = { nodes: built.nodes, edges: built.edges };
export const EXPOSED_BOM_NODE_IDS = built.exposedBomNodeIds;
export const GRAPH_ADJACENCY = built.adjacency;

export const GRAPH_STATS = {
  nodes: GRAPH.nodes.length,
  edges: GRAPH.edges.length,
  observedEdges: GRAPH.edges.filter((e) => e.provenance === "OBSERVED").length,
  modeledEdges: GRAPH.edges.filter((e) => e.provenance === "MODELED").length,
  exposedBom: EXPOSED_BOM_NODE_IDS.length,
};

// ---- geography (RADAR) --------------------------------------------------
//
// RADAR plots this graph, so every node has to be placeable. Ring 3 sites and
// ring 2 suppliers carry authored coordinates; ring 1 BOM lines inherit their
// manufacturer's with a golden-angle offset; ring 0 is Meridian's own plant.
// The guard below is what keeps that true: add a node without a coordinate and
// the build fails here rather than dropping it silently off the map.
export const GRAPH_GEO_OK = (() => {
  const missing = GRAPH.nodes.filter(
    (n) => !Number.isFinite(n.lat) || !Number.isFinite(n.lng)
  );
  if (missing.length) {
    throw new Error(
      `${missing.length} graph node(s) have no coordinate and cannot be mapped: ` +
        missing
          .slice(0, 5)
          .map((n) => n.id)
          .join(", ")
    );
  }
  const drawable = GRAPH.edges.filter((e) => e.source !== e.target).length;
  return { placed: GRAPH.nodes.length, drawableEdges: drawable };
})();

// lib/data/sites.ts publishes its own copy of ten of these coordinates (the
// map detail panel and the quarantine zone draw against them). Pinning used to
// be what kept the two files aligned; now that pinning covers every ring 3
// site, this guard is what makes a one-sided coordinate edit fail the build
// instead of splitting one physical place into two map positions.
export const SITES_AGREE_OK = (() => {
  for (const s of SITES) {
    const p = s.isCustomer ? NODE_XY[CUSTOMER_NODE_ID] : NODE_XY[s.id];
    if (!p) throw new Error(`sites.ts entry ${s.id} has no graph placement`);
    if (Math.abs(p.lat - s.lat) > 1e-9 || Math.abs(p.lng - s.lng) > 1e-9) {
      throw new Error(
        `sites.ts and graph.ts disagree about ${s.id}: ` +
          `${s.lat},${s.lng} vs ${p.lat},${p.lng}`
      );
    }
  }
  return SITES.length;
})();

// The one lane the scenario is about: quarantined backend → port → air reroute
// → Chicago inbound. Its final inland leg (Chicago → Meridian) is drawn by the
// map but is deliberately NOT an edge here: Meridian connects to BOM lines,
// not to logistics nodes, and inventing an edge would move the 162 count that
// GRAPH and the legend both report.
export const FREIGHT_LANE = [
  "NODE-KHH-ASE",
  "NODE-PORT-KHH",
  "NODE-ORD",
  "NODE-CHI",
] as const;

// Nodes RADAR keeps when the FULL NETWORK toggle is off. EXPOSED only, not
// EXPOSED plus AT_RISK, which pulls in another 15 nodes and blurs the very
// distinction the narrowed view exists to make. Two additions: Meridian, which
// is the destination every exposed lane is heading for, and the two CLEAR
// logistics nodes the stuck freight routes through, without which the lane
// stops mid-Pacific.
export const EXPOSED_PATH_NODE_IDS: string[] = (() => {
  const keep = new Set<string>([...FREIGHT_LANE, CUSTOMER_NODE_ID]);
  for (const n of GRAPH.nodes) if (n.status === "EXPOSED") keep.add(n.id);
  return GRAPH.nodes.filter((n) => keep.has(n.id)).map((n) => n.id);
})();

// ---- edge-confidence integrity (dev-time guard against silent drift) ----
// Every edge confidence must be legal and non-forbidden, the modeled edges must
// form a real spread rather than collapsing back onto one constant, and the
// INSUFFICIENT COVERAGE edge must still be sitting below the 60% floor.
export const GRAPH_CONFIDENCE_OK = (() => {
  for (const e of GRAPH.edges) {
    assertConfidence(e.confidence, `EDGE ${e.source}→${e.target}`);
    const { lo, hi } = spanFor(e.provenance);
    if (e.confidence < lo || e.confidence > hi) {
      throw new Error(
        `edge ${e.source}→${e.target} confidence ${e.confidence} is outside the ${e.provenance} span ${lo}-${hi}`
      );
    }
  }

  const modeled = GRAPH.edges.filter((e) => e.provenance === "MODELED");
  const distinctModeled = new Set(modeled.map((e) => e.confidence)).size;
  if (distinctModeled < 8) {
    throw new Error(
      `modeled edge confidences are too uniform: ${distinctModeled} distinct values across ${modeled.length} edges`
    );
  }

  const thin = GRAPH.edges.find(
    (e) =>
      (e.source === INSUFFICIENT_COVERAGE_EDGE.source &&
        e.target === INSUFFICIENT_COVERAGE_EDGE.target) ||
      (e.source === INSUFFICIENT_COVERAGE_EDGE.target &&
        e.target === INSUFFICIENT_COVERAGE_EDGE.source)
  );
  if (!thin) throw new Error("the INSUFFICIENT COVERAGE edge is missing from the graph");
  if (thin.confidence >= 60) {
    throw new Error(
      `the INSUFFICIENT COVERAGE edge must stay below 60%, found ${thin.confidence}`
    );
  }

  return {
    distinctModeled,
    distinctObserved: new Set(
      GRAPH.edges.filter((e) => e.provenance === "OBSERVED").map((e) => e.confidence)
    ).size,
    insufficientCoverage: thin.confidence,
  };
})();
