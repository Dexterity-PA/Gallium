// Hero map geometry, computed once at module scope on the server and handed
// to the client as plain serialisable data. This is the marketing fallback
// for the product's RADAR map: the product component (components/radar/
// WorldMap.tsx) is an interactive instrument wired into scenario and focus
// context, with pan/zoom, a detail panel and incident colouring, none of
// which can be dimmed or driven into an autonomous loop from outside. The
// hero instead re-derives the SAME picture from the same data with the same
// projection decisions: equirectangular, Pacific-centred (rotation 146.5E),
// ONE uniform scale on both axes, window derived from the data so a node
// added later cannot fall off the edge.
//
// Nothing here is invented: land comes from the bundled 110m topology, every
// node position comes from lib/data/graph.ts (guard-enforced coordinates),
// the freight lane and exposed set are the product's own exports, and the
// two labels are site labels from lib/data/sites.ts.

import {
  geoBounds,
  geoInterpolate,
  geoPath,
  geoProjection,
  type GeoRawProjection,
} from "d3-geo";
import { feature } from "topojson-client";
import {
  GRAPH,
  FREIGHT_LANE,
  EXPOSED_PATH_NODE_IDS,
  CUSTOMER_NODE_ID,
  PROPAGATION_ORIGIN_ID,
} from "@/lib/data/graph";
import { SITES, QUARANTINE_ZONE, CUSTOMER_SITE_ID } from "@/lib/data/sites";
import type { GraphNode } from "@/lib/types";
// Bundled at build time, same as the product map. Because this module is
// only imported by a server component, the topology stays on the server;
// the client receives finished path strings.
import worldTopo from "../../../public/geo/world-110m.json";

const DEG = Math.PI / 180;
// The product's centre of rotation (components/radar/WorldMap.tsx). Puts the
// Pacific mid-frame, the seam at 33.5W, and the freight lane as a short
// eastward arc. Do not change one without the other.
const LNG_ROT = 146.5;
const PAD_DEG = 4;
const PX_PER_DEG = 4; // viewBox units per degree; one uniform factor, both axes

type PlacedNode = GraphNode & { lat: number; lng: number };
const NODES = GRAPH.nodes as PlacedNode[];
const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));

const wrapLng = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;
const rotOf = (lng: number) => wrapLng(lng - LNG_ROT);

// The freight lane's true great circle peaks near the Bering Strait, far
// north of any node; the frame has to contain the lane, not just its
// endpoints, so the arc is sampled and folded into the extents.
const FREIGHT_ARC_SAMPLES: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (let i = 1; i < FREIGHT_LANE.length; i++) {
    const a = NODE_BY_ID.get(FREIGHT_LANE[i - 1]) as PlacedNode;
    const b = NODE_BY_ID.get(FREIGHT_LANE[i]) as PlacedNode;
    const interp = geoInterpolate([a.lng, a.lat], [b.lng, b.lat]);
    for (let t = 0; t <= 24; t++) out.push(interp(t / 24));
  }
  return out;
})();

const ROTS = [
  ...NODES.map((n) => rotOf(n.lng)),
  ...FREIGHT_ARC_SAMPLES.map(([lng]) => rotOf(lng)),
];
const LATS = [
  ...NODES.map((n) => n.lat),
  ...FREIGHT_ARC_SAMPLES.map(([, lat]) => lat),
];
const LNG_MIN = Math.min(...ROTS) - PAD_DEG;
const LNG_MAX = Math.max(...ROTS) + PAD_DEG;
const LAT_MIN = Math.min(...LATS) - PAD_DEG;
const LAT_MAX = Math.max(...LATS) + PAD_DEG;
const ROT_MID = (LNG_MIN + LNG_MAX) / 2;
const LAT_MID = (LAT_MIN + LAT_MAX) / 2;

const W = (LNG_MAX - LNG_MIN) * PX_PER_DEG;
const H = (LAT_MAX - LAT_MIN) * PX_PER_DEG;

// Equirectangular identity raw projection; the Pacific centring is applied
// through d3's rotation so land clipping at the seam is handled for us.
const RAW_EQUIRECT: GeoRawProjection = Object.assign(
  (lambda: number, phi: number): [number, number] => [lambda, phi],
  { invert: (x: number, y: number): [number, number] => [x, y] }
);

const projection = geoProjection(RAW_EQUIRECT)
  .rotate([-LNG_ROT, 0])
  .scale(PX_PER_DEG / DEG)
  .translate([W / 2 - PX_PER_DEG * ROT_MID, H / 2 + PX_PER_DEG * LAT_MID]);

const path = geoPath(projection);

const project = (lng: number, lat: number): [number, number] =>
  projection([lng, lat]) as [number, number];

// ---- lanes ---------------------------------------------------------------
// Same great-circle sampler as the product map: sample count scales with the
// arc's own angular distance, and a lane that crosses the antimeridian seam
// starts a new subpath at the crossing instead of wrapping across the pane.
const MIN_GC_STEPS = 3;
const MAX_GC_STEPS = 64;

function angularDistanceDeg(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const aLatR = aLat * DEG;
  const bLatR = bLat * DEG;
  const dLngR = (bLng - aLng) * DEG;
  const cosC =
    Math.sin(aLatR) * Math.sin(bLatR) + Math.cos(aLatR) * Math.cos(bLatR) * Math.cos(dLngR);
  return Math.acos(Math.min(1, Math.max(-1, cosC))) / DEG;
}

function laneD(aLng: number, aLat: number, bLng: number, bLat: number): string {
  const angle = angularDistanceDeg(aLng, aLat, bLng, bLat);
  const steps = Math.max(MIN_GC_STEPS, Math.round((angle / 180) * MAX_GC_STEPS));
  const interp = geoInterpolate([aLng, aLat], [bLng, bLat]);
  const parts: string[] = [];
  let prevRot = 0;
  for (let i = 0; i <= steps; i++) {
    const [lng, lat] = interp(i / steps);
    const rot = rotOf(lng);
    const [x, y] = project(lng, lat);
    const pen = i > 0 && Math.abs(rot - prevRot) <= 180 ? "L" : "M";
    parts.push(`${pen}${x.toFixed(2)} ${y.toFixed(2)}`);
    prevRot = rot;
  }
  return parts.join(" ");
}

const FREIGHT_LEGS = new Set<string>();
for (let i = 1; i < FREIGHT_LANE.length; i++) {
  FREIGHT_LEGS.add(`${FREIGHT_LANE[i - 1]}|${FREIGHT_LANE[i]}`);
  FREIGHT_LEGS.add(`${FREIGHT_LANE[i]}|${FREIGHT_LANE[i - 1]}`);
}

const EXPOSED = new Set(EXPOSED_PATH_NODE_IDS);

// Every non-freight edge of the whole network, as one path string. The full
// network is visible behind the headline, dim; the freight lane is drawn
// separately from FREIGHT_LANE itself so its legs are never doubled.
const contextD = GRAPH.edges
  .flatMap((e) => {
    const a = NODE_BY_ID.get(e.source);
    const b = NODE_BY_ID.get(e.target);
    if (!a || !b || a.id === b.id) return [];
    if (FREIGHT_LEGS.has(`${a.id}|${b.id}`)) return [];
    return [laneD(a.lng, a.lat, b.lng, b.lat)];
  })
  .join(" ");

const freightD = (() => {
  const parts: string[] = [];
  for (let i = 1; i < FREIGHT_LANE.length; i++) {
    const a = NODE_BY_ID.get(FREIGHT_LANE[i - 1]) as PlacedNode;
    const b = NODE_BY_ID.get(FREIGHT_LANE[i]) as PlacedNode;
    parts.push(laneD(a.lng, a.lat, b.lng, b.lat));
  }
  return parts.join(" ");
})();

// ---- the marker's route --------------------------------------------------
// The autonomous loop traces the stuck freight's route UPSTREAM, the
// direction the exposure analysis runs: from the Chicago inbound leg back
// across the Pacific to the Port of Kaohsiung, where it docks and holds.
// A paused frame therefore reads as what it is: freight held at Kaohsiung.
const ROUTE_IDS = [...FREIGHT_LANE].reverse(); // CHI -> ORD -> PORT-KHH -> A&T
// The marker docks at the PORT, not the plant; drop the final intra-city hop.
const TRAVEL_IDS = ROUTE_IDS.slice(0, ROUTE_IDS.length - 1);

const route: Array<[number, number]> = (() => {
  const pts: Array<[number, number]> = [];
  for (let i = 1; i < TRAVEL_IDS.length; i++) {
    const a = NODE_BY_ID.get(TRAVEL_IDS[i - 1]) as PlacedNode;
    const b = NODE_BY_ID.get(TRAVEL_IDS[i]) as PlacedNode;
    const angle = angularDistanceDeg(a.lng, a.lat, b.lng, b.lat);
    const steps = Math.max(8, Math.round(angle * 1.5));
    const interp = geoInterpolate([a.lng, a.lat], [b.lng, b.lat]);
    for (let t = i === 1 ? 0 : 1; t <= steps; t++) {
      const [lng, lat] = interp(t / steps);
      const [x, y] = project(lng, lat);
      pts.push([Number(x.toFixed(2)), Number(y.toFixed(2))]);
    }
  }
  return pts;
})();

const dock = route[route.length - 1];

// ---- nodes ---------------------------------------------------------------
export type HeroNodeTier = "context" | "exposed" | "origin" | "customer";

const NODE_R: Record<HeroNodeTier, number> = {
  context: 1.0,
  exposed: 1.7,
  origin: 2.4,
  customer: 2.2,
};

const nodes = NODES.map((n) => {
  const tier: HeroNodeTier =
    n.id === PROPAGATION_ORIGIN_ID
      ? "origin"
      : n.id === CUSTOMER_NODE_ID
      ? "customer"
      : EXPOSED.has(n.id)
      ? "exposed"
      : "context";
  const [x, y] = project(n.lng, n.lat);
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), tier };
});

// ---- quarantine zone -----------------------------------------------------
const quarantineD =
  path({
    type: "Polygon",
    coordinates: [[...QUARANTINE_ZONE, QUARANTINE_ZONE[0]]],
  }) ?? "";

// ---- labels --------------------------------------------------------------
// One label, the destination. The origin end of the story sits behind the
// hero's text scrim at desktop widths, where a ghosted line of type reads as
// a rendering accident; the pulsing dock marker and the dashed quarantine
// box mark Kaohsiung instead. The text is site data from lib/data/sites.ts,
// uppercased; nothing is authored here.
const siteLabel = (id: string): string => {
  const s = SITES.find((x) => x.id === id);
  return (s?.label ?? id).toUpperCase();
};

const customerXY = project(
  (NODE_BY_ID.get(CUSTOMER_NODE_ID) as PlacedNode).lng,
  (NODE_BY_ID.get(CUSTOMER_NODE_ID) as PlacedNode).lat
);

const labels = [
  {
    x: Number((customerXY[0] + 6).toFixed(2)),
    y: Number((customerXY[1] - 6).toFixed(2)),
    text: siteLabel(CUSTOMER_SITE_ID),
    anchor: "start" as const,
  },
];

// ---- land ----------------------------------------------------------------
// The SVG deliberately lets land bleed past the viewBox letterbox (no hard
// seams at the frame edge), which means everything the projection can reach
// gets painted. Antarctica then shows up as a full-width slab with a hard
// top edge across the bottom of the hero, so any landmass lying entirely
// below 55S is dropped before the path is built. Nothing in the network is
// within 50 degrees of it.
const land = feature(
  worldTopo as never,
  (worldTopo as never as { objects: { countries: never } }).objects.countries
) as unknown as GeoJSON.FeatureCollection;

const landAboveSouthernOcean: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: land.features.filter((f) => geoBounds(f)[1][1] > -55),
};

const landD = path(landAboveSouthernOcean) ?? "";

// ---- export --------------------------------------------------------------
export interface HeroMapGeo {
  w: number;
  h: number;
  landD: string;
  contextD: string;
  freightD: string;
  quarantineD: string;
  nodes: Array<{ x: number; y: number; tier: HeroNodeTier }>;
  nodeR: Record<HeroNodeTier, number>;
  route: Array<[number, number]>;
  dock: [number, number];
  labels: Array<{ x: number; y: number; text: string; anchor: "start" | "end" }>;
}

export const HERO_MAP: HeroMapGeo = {
  w: Number(W.toFixed(2)),
  h: Number(H.toFixed(2)),
  landD,
  contextD,
  freightD,
  quarantineD,
  nodes,
  nodeR: NODE_R,
  route,
  dock,
  labels,
};
