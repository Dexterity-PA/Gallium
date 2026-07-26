"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  geoGraticule,
  geoInterpolate,
  geoPath,
  geoProjection,
  type GeoProjection,
  type GeoRawProjection,
} from "d3-geo";
import { feature } from "topojson-client";
import { SITES, QUARANTINE_ZONE, CUSTOMER_SITE_ID } from "@/lib/data/sites";
import { BOM } from "@/lib/data/bom";
import {
  GRAPH,
  EXPOSED_PATH_NODE_IDS,
  FREIGHT_LANE,
  CUSTOMER_NODE_ID,
  PROPAGATION_ORIGIN_ID,
} from "@/lib/data/graph";
import type { GraphNode } from "@/lib/types";
import {
  NodeDetailPanel,
  nodeDetailFromSite,
  type NodeDetail,
} from "@/components/shared/NodeDetailPanel";
// Bundled at build time. Nothing loads from the network at runtime.
import worldTopo from "../../public/geo/world-110m.json";

// ---- the network being plotted ------------------------------------------
// RADAR draws the WHOLE graph and GRAPH draws the single incident. Opposite
// defaults on purpose: the two screens answer different questions, and the old
// version of this map answered GRAPH's, showing the same eight-node sliver a
// column away from the panel that already showed it.
type PlacedNode = GraphNode & { lat: number; lng: number };

const NODES = GRAPH.nodes as PlacedNode[];
const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
const EXPOSED_PATH = new Set(EXPOSED_PATH_NODE_IDS);

// Meridian is one place under two ids: MERIDIAN in the graph, NODE-ROC on the
// map. The detail panel should not care which door you came in through.
const SITE_ALIAS: Record<string, string> = { [CUSTOMER_NODE_ID]: CUSTOMER_SITE_ID };
const SITE_BY_ID = new Map(SITES.map((s) => [s.id, s]));

// The quarantined freight's own route. Its legs are the only lanes that move.
const FREIGHT_LEGS = new Set<string>();
for (let i = 1; i < FREIGHT_LANE.length; i++) {
  FREIGHT_LEGS.add(`${FREIGHT_LANE[i - 1]}|${FREIGHT_LANE[i]}`);
  FREIGHT_LEGS.add(`${FREIGHT_LANE[i]}|${FREIGHT_LANE[i - 1]}`);
}

// Four tiers, not two, because "exposed" turned out to be 49 lanes and drawing
// 49 lanes at alarm weight buries the one lane that is actually the news.
//
//   freight     the quarantined shipment's own route. Bright, dashed, moving.
//   propagation exposure spreading upstream: part → maker → site. Red, quiet.
//   procurement Meridian → an exposed BOM line. Fourteen trans-Pacific arcs
//               that all say the same thing ("we buy this here"), so they are
//               a red wash rather than fourteen more alarms.
//   context     the rest of the network. Neutral, and the whole point of the
//               default view.
type Tier = "freight" | "propagation" | "procurement" | "context";
interface Lane {
  key: string;
  a: PlacedNode;
  b: PlacedNode;
  tier: Tier;
  modeled: boolean;
}

const LANES: Lane[] = GRAPH.edges.flatMap((e, i) => {
  const a = NODE_BY_ID.get(e.source);
  const b = NODE_BY_ID.get(e.target);
  if (!a || !b || a.id === b.id) return [];
  const lit = EXPOSED_PATH.has(a.id) && EXPOSED_PATH.has(b.id);
  const tier: Tier = FREIGHT_LEGS.has(`${a.id}|${b.id}`)
    ? "freight"
    : !lit
    ? "context"
    : a.id === CUSTOMER_NODE_ID || b.id === CUSTOMER_NODE_ID
    ? "procurement"
    : "propagation";
  return [{ key: `${e.source}|${e.target}|${i}`, a, b, tier, modeled: e.provenance === "MODELED" }];
});

const CONTEXT_LANES = LANES.filter((l) => l.tier === "context");
const LIT_LANES = LANES.filter((l) => l.tier !== "context");

// ---- framing ------------------------------------------------------------
// Same projection decision as before: ONE scale factor on both axes, so
// landmasses keep their true shape and the panel keeps its empty margin rather
// than stretching to fill. What changed is the CENTRE. The old window derived
// its extent from raw longitudes, which forces the cut into the Pacific: the
// map ran 123W..146E, Kaohsiung sat on the far right edge, Rockford in the
// left third, and the one lane the screen is about ran WESTWARD across
// Eurasia, backwards for trans-Pacific freight. The projection is now rotated
// so the Pacific is mid-frame and the freight lane is a short eastward arc.
// The cut falls at 33.5W, mid-Atlantic, the one stretch of ocean the network
// only crosses on context routes. Extents are still derived from the data, in
// ROTATED longitudes, so a node added later cannot quietly fall off the edge.
const DEG = Math.PI / 180;
const LNG_ROT = 146.5; // centre of rotation; puts the seam at 33.5W

// The readout must never claim a coordinate that does not exist. Longitude
// wraps; latitude clamps, because the uniform fit letterboxes past the poles
// at the widest zoom, and inverting there yields a latitude no place has.
const wrapLng = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;
const clampLat = (l: number) => Math.min(90, Math.max(-90, l));
const rotOf = (lng: number) => wrapLng(lng - LNG_ROT);

// A node near the rotated antimeridian would wrap or clip; the closest today
// is 36° away (Rotterdam on one side, the US East coast on the other). If the
// data ever drifts into the seam, fail the build instead of drawing it.
{
  const clearance = Math.min(...NODES.map((n) => 180 - Math.abs(rotOf(n.lng))));
  if (clearance < 5) {
    throw new Error(
      `map: a node sits ${clearance.toFixed(1)}° from the antimeridian seam; adjust LNG_ROT`
    );
  }
}

const PAD_DEG = 4;

// The freight lane is drawn as its true great circle, and the KHH→ORD leg
// peaks near the Bering Strait, far north of any node. The frame has to
// contain the lane, not just its endpoints, so the arc is sampled here and
// folded into every extent below.
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
// Rotated degrees. The full window: everything the network touches.
const LNG_MIN = Math.min(...ROTS) - PAD_DEG;
const LNG_MAX = Math.max(...ROTS) + PAD_DEG;
const LAT_MIN = Math.min(...LATS) - PAD_DEG;
const LAT_MAX = Math.max(...LATS) + PAD_DEG;
const ROT_MID = (LNG_MIN + LNG_MAX) / 2;
const LAT_MID = (LAT_MIN + LAT_MAX) / 2;

// The HOME view frames the STORY: the quarantine cluster, the freight lane,
// Meridian, every exposed node. Not the whole network, and on purpose: the
// network spans 294° of longitude against 59° of latitude, and no single
// uniform scale can put that in this pane without sinking the node band into
// a letterbox of southern-hemisphere ocean, which is exactly the crop this
// view replaces. Europe and the US East coast context stay one zoom-out (or a
// pan) away; MIN_Z is still the full derived window.
const STORY_BOX = (() => {
  const ids = new Set<string>([
    ...EXPOSED_PATH_NODE_IDS,
    ...FREIGHT_LANE,
    CUSTOMER_NODE_ID,
  ]);
  const rots = FREIGHT_ARC_SAMPLES.map(([lng]) => rotOf(lng));
  const lats = FREIGHT_ARC_SAMPLES.map(([, lat]) => lat);
  for (const id of ids) {
    const n = NODE_BY_ID.get(id);
    if (n) {
      rots.push(rotOf(n.lng));
      lats.push(n.lat);
    }
  }
  return {
    rotMin: Math.min(...rots) - PAD_DEG,
    rotMax: Math.max(...rots) + PAD_DEG,
    latMin: Math.min(...lats) - PAD_DEG,
    latMax: Math.max(...lats) + PAD_DEG,
  };
})();

const hemi = (deg: number, neg: string, pos: string) =>
  `${Math.round(Math.abs(deg))}${deg < 0 ? neg : pos}`;

// Consumed by the panel corner label, so the header cannot claim a window the
// projection is not actually using. Real-world edges of the derived window,
// read west to east ACROSS the Pacific (the window excludes only the
// Atlantic), hence the PACIFIC marker.
export const MAP_WINDOW = {
  lngMin: wrapLng(LNG_MIN + LNG_ROT),
  lngMax: wrapLng(LNG_MAX + LNG_ROT),
  label: `CYL · PACIFIC · ${hemi(wrapLng(LNG_MIN + LNG_ROT), "W", "E")}–${hemi(
    wrapLng(LNG_MAX + LNG_ROT),
    "W",
    "E"
  )}`,
};

const GRATICULE = geoGraticule().step([20, 20]);

// Equirectangular identity raw projection. `invert` is what makes the cursor
// lat/long readout possible: d3 only exposes projection.invert when the raw
// projection supplies one, and the identity is its own inverse. The Pacific
// centring is applied through d3's rotation, so invert un-rotates too.
const RAW_EQUIRECT: GeoRawProjection = Object.assign(
  (lambda: number, phi: number): [number, number] => [lambda, phi],
  { invert: (x: number, y: number): [number, number] => [x, y] }
);

const MIN_Z = 1; // the full derived window; home sits above this, on the story
const MAX_Z = 8;

const TICK = 8; // px, edge tick length for the cursor lat/long marks

const formatCoord = (lngRaw: number, latRaw: number) => {
  const lng = wrapLng(lngRaw);
  const lat = clampLat(latRaw);
  return (
    `${Math.abs(lat).toFixed(1)}${lat >= 0 ? "N" : "S"} ` +
    `${Math.abs(lng).toFixed(1)}${lng >= 0 ? "E" : "W"}`
  );
};

// Parts affected per site, from BOM actualExposure region tokens.
const AFFECTED: Record<string, number> = (() => {
  const tok: Record<string, string> = {
    "NODE-KHH-ASE": "KAOHSIUNG",
    "NODE-HSC": "HSINCHU",
    "NODE-TPE": "TPE",
  };
  const out: Record<string, number> = {};
  for (const id of Object.keys(tok)) {
    out[id] = BOM.filter(
      (b) => b.status === "EXPOSED" && b.actualExposure?.includes(tok[id])
    ).length;
  }
  return out;
})();

// ---- the two nodes the screen is about ----------------------------------
// Everything else on the map is unlabelled. Naming two things names the story;
// naming ninety names nothing.
const NAMED = [
  { id: PROPAGATION_ORIGIN_ID, name: "KAOHSIUNG A&T", role: "PARTS STUCK", tone: "var(--critical)" },
  { id: CUSTOMER_NODE_ID, name: "MERIDIAN · ROCKFORD", role: "PARTS DUE", tone: "var(--warn)" },
] as const;

export interface MapFocusRequest {
  siteId: string;
  nonce: number; // bump to re-trigger a fly-to for the same site
}

interface View {
  z: number;
  panX: number;
  panY: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---- the one lane renderer ----------------------------------------------
// Every lane, of every tier, is the same geometry: the great circle between
// its endpoints, sampled and pushed through the one projection. There used to
// be two code paths (screen-space quadratic beziers for the lit lanes,
// base-space beziers for context) and the bezier's "lift" was applied
// straight up in screen y, so a lane whose endpoints shared a longitude got a
// control point ON its own chord and rendered as a dead-straight line while
// every neighbour curved. Great circles have no such degenerate case, and the
// freight lane's tall trans-Pacific arc is now the route a 747 actually
// flies, up past the Bering Strait, rather than a decorative bow.
//
// A handful of genuine Europe↔America context routes cross the antimeridian
// seam; the sampler starts a new subpath at the crossing, so those lanes run
// off the frame's edges instead of wrapping across the pane.
const GC_STEPS = 24;
type ProjectFn = (lng: number, lat: number) => [number, number];
function laneD(
  aLng: number,
  aLat: number,
  bLng: number,
  bLat: number,
  projectFn: ProjectFn
): string {
  const interp = geoInterpolate([aLng, aLat], [bLng, bLat]);
  const parts: string[] = [];
  let prevRot = 0;
  for (let i = 0; i <= GC_STEPS; i++) {
    const [lng, lat] = interp(i / GC_STEPS);
    const rot = rotOf(lng);
    const [x, y] = projectFn(lng, lat);
    const pen = i > 0 && Math.abs(rot - prevRot) <= 180 ? "L" : "M";
    parts.push(`${pen}${x.toFixed(2)} ${y.toFixed(2)}`);
    prevRot = rot;
  }
  return parts.join(" ");
}

// Stroke weight and alpha per tier, at rest and when an endpoint is selected.
// The context mesh (drawn inline below, 0.4 / 0.36) is deliberately held
// BELOW the point where it competes: the unexposed network is texture behind
// the story, and the incident has to be findable in a paused frame without
// hunting. --critical is bright enough that 0.2 still reads as red.
const STROKE: Record<Exclude<Tier, "context">, { w: number; on: number; a: number }> = {
  freight: { w: 1.6, on: 2.1, a: 0.95 },
  propagation: { w: 0.9, on: 1.5, a: 0.5 },
  procurement: { w: 0.7, on: 1.3, a: 0.2 },
};

export function WorldMap({ focus }: { focus?: MapFocusRequest | null } = {}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [hover, setHover] = useState<PlacedNode | null>(null);
  const [selected, setSelected] = useState<PlacedNode | null>(null);
  // null = the derived HOME view. Kept as an override rather than a value so
  // that a resize before any interaction re-frames automatically, and reset
  // is just "forget the override".
  const [viewOverride, setViewOverride] = useState<View | null>(null);
  // Inverted against GRAPH on purpose: the whole network is this screen's
  // default and the toggle narrows, where GRAPH starts narrow and widens.
  const [fullNetwork, setFullNetwork] = useState(true);
  // Raw cursor position in pane coordinates. Drives the edge ticks and the
  // corner lat/long readout. Null whenever the pointer is off the pane.
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize((prev) => {
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        return prev.w === w && prev.h === h ? prev : { w, h };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const land = useMemo(
    () =>
      feature(
        worldTopo as never,
        (worldTopo as never as { objects: { countries: never } }).objects.countries
      ) as unknown as GeoJSON.FeatureCollection,
    []
  );

  const { w, h } = size;

  // Base (MIN_Z fit) projection + static geographic paths. Independent of
  // view. The rotation is applied INSIDE the projection, so land, graticule,
  // node placement, and the cursor readout's invert all share it.
  const { projection, pathD, gratD, k } = useMemo(() => {
    if (!(w > 0 && h > 0)) {
      return { projection: null as GeoProjection | null, pathD: "", gratD: "", k: 0 };
    }
    const k = Math.min(w / (LNG_MAX - LNG_MIN), h / (LAT_MAX - LAT_MIN));
    const proj = geoProjection(RAW_EQUIRECT)
      .rotate([-LNG_ROT, 0])
      .scale(k / DEG)
      .translate([w / 2 - k * ROT_MID, h / 2 + k * LAT_MID]);
    const path = geoPath(proj);
    return { projection: proj, pathD: path(land) ?? "", gratD: path(GRATICULE()) ?? "", k };
  }, [w, h, land]);

  // base-projection coords for a lng/lat (pre-transform)
  const base = useCallback(
    (lng: number, lat: number): [number, number] =>
      projection ? (projection([lng, lat]) as [number, number]) : [0, 0],
    [projection]
  );

  const cx = w / 2;
  const cy = h / 2;

  // Base-space bounding box of everything drawable: the plotted network plus
  // the freight lane's sampled arc, which runs far north of any node and must
  // stay reachable by pan. Recomputed only on resize.
  const netBox = useMemo(() => {
    if (!projection) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (lng: number, lat: number) => {
      const [x, y] = projection([lng, lat]) as [number, number];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    };
    for (const n of NODES) grow(n.lng, n.lat);
    for (const [lng, lat] of FREIGHT_ARC_SAMPLES) grow(lng, lat);
    return { x0, y0, x1, y1 };
  }, [projection]);

  // The pan limit is the network's own box, not a constant multiple of the
  // pane. Per axis: when the zoomed box overfills the pane, panning stops with
  // the box edge at most MARGIN px inside the pane, so you can reach the rim
  // of the network but never open water beyond it. When the box fits inside
  // the pane on an axis (low zoom), that axis locks centred rather than
  // sliding. The previous rule only kept 48px of the BOX on screen, and the
  // box's far corners are empty ocean, so a determined drag still ended
  // staring at nothing.
  const MARGIN = 24; // the same 24px safe margin every screen is recorded against
  const clampView = useCallback(
    (v: View): View => {
      const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z));
      if (!netBox) return { z, panX: v.panX, panY: v.panY };
      const axis = (b0: number, b1: number, c: number, extent: number, pan: number) => {
        const near = c + z * (b0 - c); // box edges on screen at pan 0
        const far = c + z * (b1 - c);
        if (far - near >= extent - 2 * MARGIN) {
          const lo = extent - MARGIN - far; // far edge stays >= extent - MARGIN
          const hi = MARGIN - near; // near edge stays <= MARGIN
          return Math.min(hi, Math.max(lo, pan));
        }
        return (extent - (far - near)) / 2 - near; // lock centred
      };
      return {
        z,
        panX: axis(netBox.x0, netBox.x1, cx, w, v.panX),
        panY: axis(netBox.y0, netBox.y1, cy, h, v.panY),
      };
    },
    [netBox, cx, cy, w, h]
  );

  // The derived HOME view: the story frame, fitted and centred. See STORY_BOX.
  const homeView = useMemo((): View => {
    if (!(k > 0)) return { z: 1, panX: 0, panY: 0 };
    const spanX = (STORY_BOX.rotMax - STORY_BOX.rotMin) * k;
    const spanY = (STORY_BOX.latMax - STORY_BOX.latMin) * k;
    const z = Math.min(MAX_Z, Math.max(MIN_Z, Math.min(w / spanX, h / spanY)));
    // story centre in base px, then the pan that puts it at the pane centre
    const bx = cx + k * ((STORY_BOX.rotMin + STORY_BOX.rotMax) / 2 - ROT_MID);
    const by = cy - k * ((STORY_BOX.latMin + STORY_BOX.latMax) / 2 - LAT_MID);
    return clampView({ z, panX: -z * (bx - cx), panY: -z * (by - cy) });
  }, [k, w, h, cx, cy, clampView]);

  const view = viewOverride ?? homeView;

  // base coord → screen coord under the current view (zoom about centre + pan).
  const toScreen = useCallback(
    (bx: number, by: number): [number, number] => [
      cx + view.z * (bx - cx) + view.panX,
      cy + view.z * (by - cy) + view.panY,
    ],
    [cx, cy, view]
  );

  const project = useCallback(
    (lng: number, lat: number): [number, number] => {
      const [bx, by] = base(lng, lat);
      return toScreen(bx, by);
    },
    [base, toScreen]
  );

  // screen coord → lng/lat. Reverses the view transform, then hands the base
  // coord to d3's projection.invert so the projection math has one owner.
  const unproject = useCallback(
    (sx: number, sy: number): [number, number] | null => {
      if (!projection?.invert) return null;
      const bx = (sx - cx - view.panX) / view.z + cx;
      const by = (sy - cy - view.panY) / view.z + cy;
      const inv = projection.invert([bx, by]);
      return inv ? [inv[0], inv[1]] : null;
    },
    [projection, cx, cy, view]
  );

  const ready = !!projection;

  // The context mesh is ~110 lanes. Drawing it in BASE space inside the
  // transformed group means its path data is computed once per resize instead
  // of once per pan frame; the SVG transform does the rest, and a non-scaling
  // stroke keeps it hairline at every zoom.
  const contextD = useMemo(() => {
    if (!projection) return { observed: "", modeled: "" };
    const baseFn: ProjectFn = (lng, lat) => projection([lng, lat]) as [number, number];
    const seg = (l: Lane) => laneD(l.a.lng, l.a.lat, l.b.lng, l.b.lat, baseFn);
    return {
      observed: CONTEXT_LANES.filter((l) => !l.modeled).map(seg).join(" "),
      modeled: CONTEXT_LANES.filter((l) => l.modeled).map(seg).join(" "),
    };
  }, [projection]);

  // fly-to animation handle (declared early: pan/zoom/reset all cancel it)
  const flyRaf = useRef(0);
  const cancelFly = useCallback(() => {
    if (flyRaf.current) cancelAnimationFrame(flyRaf.current);
    flyRaf.current = 0;
  }, []);

  // ---- zoom about an anchor point (cursor for wheel, incident for buttons) ----
  const zoomTo = useCallback(
    (nextZ: number, ax: number, ay: number) => {
      setViewOverride((prev) => {
        const v = prev ?? homeView;
        const z = Math.min(MAX_Z, Math.max(MIN_Z, nextZ));
        // base point currently under the anchor
        const bx = (ax - cx - v.panX) / v.z + cx;
        const by = (ay - cy - v.panY) / v.z + cy;
        // solve pan so that base point stays under the anchor at the new zoom
        const panX = ax - cx - z * (bx - cx);
        const panY = ay - cy - z * (by - cy);
        return clampView({ z, panX, panY });
      });
    },
    [cx, cy, clampView, homeView]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!ready) return;
      e.preventDefault();
      const rect = wrapRef.current?.getBoundingClientRect();
      const ax = rect ? e.clientX - rect.left : cx;
      const ay = rect ? e.clientY - rect.top : cy;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setViewOverride((prev) => {
        const v = prev ?? homeView;
        const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * factor));
        const bx = (ax - cx - v.panX) / v.z + cx;
        const by = (ay - cy - v.panY) / v.z + cy;
        return clampView({ z, panX: ax - cx - z * (bx - cx), panY: ay - cy - z * (by - cy) });
      });
    },
    [ready, cx, cy, clampView, homeView]
  );

  // The buttons anchor on the AFFECTED node, not the pane centre: pressing +
  // from home used to zoom into the geometric middle of the map, which is
  // open ocean, and each press drifted further from the story. Anchored on
  // Kaohsiung, zooming in walks toward the incident and zooming out walks
  // back the same way. Wheel zoom keeps its cursor anchor.
  const zoomStep = useCallback(
    (dir: 1 | -1) => {
      const o = NODE_BY_ID.get(PROPAGATION_ORIGIN_ID) as PlacedNode;
      const [ox, oy] = project(o.lng, o.lat);
      const ax = Math.min(w, Math.max(0, ox));
      const ay = Math.min(h, Math.max(0, oy));
      zoomTo(view.z * (dir === 1 ? 1.6 : 1 / 1.6), ax, ay);
    },
    [zoomTo, view.z, project, w, h]
  );

  const resetView = useCallback(() => {
    cancelFly();
    setViewOverride(null); // forget the override: back to the derived home
  }, [cancelFly]);

  // ---- drag-to-pan -------------------------------------------------------
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false); // suppresses the click that ends a drag
  // Capture is deliberately NOT taken here. Taking it on pointerdown makes the
  // browser retarget the whole gesture to this wrapper, including the click
  // event at the end of it, so a click on a node square was delivered to the
  // background handler and cleared the selection instead of opening the detail
  // panel: nothing on this map could be selected by clicking it. Capture is
  // now taken in onPointerMove, at the moment a drag actually starts, which is
  // the only time panning needs it.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    justDragged.current = false;
  }, []);
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      if (!d.moved) {
        // past the 3px threshold: this is a pan, so take the pointer now and
        // keep receiving moves even if the cursor leaves the pane.
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
      d.moved = true;
      justDragged.current = true;
      d.x = e.clientX;
      d.y = e.clientY;
      cancelFly();
      setViewOverride((prev) => {
        const v = prev ?? homeView;
        return clampView({ ...v, panX: v.panX + dx, panY: v.panY + dy });
      });
    },
    [clampView, cancelFly, homeView]
  );
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);
  // Background click clears the selection. Node/lane clicks stopPropagation, so
  // they never reach here; a click that ended a drag is suppressed.
  const onBackgroundClick = useCallback(() => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    setSelected(null);
  }, []);

  // ---- fly-to (feed → node) ---------------------------------------------
  const flyToNode = useCallback(
    (node: PlacedNode) => {
      if (!projection) return;
      cancelFly();
      const [bx, by] = base(node.lng, node.lat);
      const targetZ = Math.min(MAX_Z, 2.8);
      const target = clampView({
        z: targetZ,
        panX: -targetZ * (bx - cx),
        panY: -targetZ * (by - cy),
      });
      const from = view;
      const start = performance.now();
      const dur = 700;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = easeInOut(t);
        setViewOverride({
          z: from.z + (target.z - from.z) * e,
          panX: from.panX + (target.panX - from.panX) * e,
          panY: from.panY + (target.panY - from.panY) * e,
        });
        if (t < 1) flyRaf.current = requestAnimationFrame(step);
        else flyRaf.current = 0;
      };
      flyRaf.current = requestAnimationFrame(step);
    },
    [projection, base, cx, cy, clampView, view]
  );

  // external focus request from the event feed
  const lastNonce = useRef<number>(-1);
  useEffect(() => {
    if (!focus || !ready) return;
    if (focus.nonce === lastNonce.current) return;
    lastNonce.current = focus.nonce;
    const node = NODE_BY_ID.get(focus.siteId);
    if (!node) return;
    setSelected(node);
    flyToNode(node);
  }, [focus, ready, flyToNode]);

  useEffect(() => () => cancelFly(), [cancelFly]);

  // ---- what is currently drawn ------------------------------------------
  const visibleNodes = useMemo(
    () => (fullNetwork ? NODES : NODES.filter((n) => EXPOSED_PATH.has(n.id))),
    [fullNetwork]
  );

  const selectNode = useCallback((n: PlacedNode) => {
    setSelected((cur) => (cur?.id === n.id ? null : n));
  }, []);

  // Narrowing the view must not leave a detail panel open on a node that is no
  // longer on the map.
  const toggleFullNetwork = useCallback(() => {
    setFullNetwork((on) => {
      const next = !on;
      if (!next) {
        setSelected((s) => (s && EXPOSED_PATH.has(s.id) ? s : null));
        setHover(null);
      }
      return next;
    });
  }, []);

  // Meridian's plant and the nine mapped sites carry a richer record than the
  // graph node does (function text, their own provenance documents), so the map
  // prefers it and falls back to the graph node for the other eighty.
  const detailFor = useCallback((n: PlacedNode): NodeDetail => {
    const site = SITE_BY_ID.get(SITE_ALIAS[n.id] ?? n.id);
    if (site) return nodeDetailFromSite(site, { affected: AFFECTED[site.id] ?? 0 });
    return {
      id: n.id,
      title: n.label,
      subtitle: `${n.kind} · RING ${n.ring}`,
      status: n.status,
      provenance: n.provenance,
      sourceIds: n.sourceIds,
      fields: [{ label: "Coordinates", value: `${n.lat.toFixed(2)}, ${n.lng.toFixed(2)}` }],
      origin: "map",
    };
  }, []);

  const coord = useMemo(() => {
    if (!cursor) return null;
    const ll = unproject(cursor.x, cursor.y);
    return ll ? formatCoord(ll[0], ll[1]) : null;
  }, [cursor, unproject]);

  // group transform: zoom about centre, then pan (screen space)
  const groupTransform = `translate(${view.panX} ${view.panY}) translate(${cx} ${cy}) scale(${view.z}) translate(${-cx} ${-cy})`;

  const rockford = NODE_BY_ID.get(CUSTOMER_NODE_ID) as PlacedNode;
  const chicago = NODE_BY_ID.get("NODE-CHI") as PlacedNode;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full select-none overflow-hidden bg-[var(--bg-base)]"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setCursor(null)}
      onClick={onBackgroundClick}
      style={{ cursor: drag.current?.moved ? "grabbing" : "grab", touchAction: "none" }}
    >
      {ready ? (
        <svg width={w} height={h} className="absolute inset-0">
          <rect x={0} y={0} width={w} height={h} fill="var(--bg-base)" />

          {/* geographic layer: scales/pans with the view transform */}
          <g transform={groupTransform}>
            {/* Graticule sits below the threshold of notice on purpose, since it is
                orientation, not content, and must never read as strongly as a
                coastline. */}
            <path
              d={gratD}
              fill="none"
              stroke="var(--rule)"
              strokeOpacity={0.17}
              strokeWidth={1}
              shapeRendering="crispEdges"
              vectorEffect="non-scaling-stroke"
            />
            {/* One flat tone for all land. No shading, no gradient, no
                per-country variation, because landmass is a backdrop. */}
            <path
              d={pathD}
              fill="var(--bg-elevated)"
              stroke="var(--rule)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
            <polygon
              points={QUARANTINE_ZONE.map(([lng, lat]) => base(lng, lat).join(",")).join(" ")}
              fill="var(--critical)"
              fillOpacity={0.08}
              stroke="var(--critical)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />

            {/* The unexposed network: every remaining lane, at a weight that
                registers as texture. No dash, no motion, no hit target and no
                label, because this layer answers "how big is the network", not
                "where is the problem". Two strokes, not one, so MODELED links
                stay violet and OBSERVED stay neutral, matching GRAPH. */}
            {fullNetwork ? (
              <g fill="none" vectorEffect="non-scaling-stroke" pointerEvents="none">
                <path
                  d={contextD.observed}
                  stroke="var(--text-dim)"
                  strokeOpacity={0.4}
                  strokeWidth={0.6}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={contextD.modeled}
                  stroke="var(--modeled)"
                  strokeOpacity={0.36}
                  strokeWidth={0.6}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ) : null}
          </g>

          {/* Lit lanes, in screen space so their weight is independent of zoom.
              Everything red is on this layer and nothing else is. */}
          {LIT_LANES.map((l) => {
            const d = laneD(l.a.lng, l.a.lat, l.b.lng, l.b.lat, project);
            const isFreight = l.tier === "freight";
            const on = selected?.id === l.a.id || selected?.id === l.b.id;
            const s = STROKE[l.tier as Exclude<Tier, "context">];
            return (
              <g key={l.key}>
                {/* wide invisible hit target so thin arcs are clickable */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={10}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(l.a);
                  }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke="var(--critical)"
                  strokeWidth={on ? s.on : s.w}
                  strokeOpacity={on ? 0.9 : s.a}
                  strokeDasharray={isFreight ? "3 4" : undefined}
                  pointerEvents="none"
                />
                {isFreight ? (
                  <circle
                    r={2}
                    fill="var(--critical)"
                    pointerEvents="none"
                    style={{
                      offsetPath: `path("${d}")`,
                      offsetRotate: "0deg",
                      animation: "packet-stall 3s ease-in-out infinite",
                    }}
                  />
                ) : null}
              </g>
            );
          })}

          {/* Final inland leg: Chicago inbound → Rockford assembly. Drawn, not
              stored: Meridian connects to BOM lines rather than to logistics
              nodes in the graph, and inventing that edge would move the node and
              edge counts GRAPH reports. Neutral tone, because the disruption is
              upstream of here. */}
          {(() => {
            const d = laneD(chicago.lng, chicago.lat, rockford.lng, rockford.lat, project);
            return (
              <g>
                <path
                  d={d}
                  fill="none"
                  stroke="var(--text-dim)"
                  strokeWidth={0.9}
                  strokeOpacity={0.5}
                  strokeDasharray="3 4"
                  pointerEvents="none"
                />
                <circle
                  r={1.6}
                  fill="var(--text-dim)"
                  pointerEvents="none"
                  style={{
                    offsetPath: `path("${d}")`,
                    offsetRotate: "0deg",
                    animation: "packet-flow 1.4s linear infinite",
                  }}
                />
              </g>
            );
          })()}

          {/* Nodes. Constant screen size at every zoom: a dot's size means what
              it is, never how far in you have scrolled. */}
          {visibleNodes.map((n) => {
            const [x, y] = project(n.lng, n.lat);
            const lit = EXPOSED_PATH.has(n.id);
            const isCustomer = n.id === CUSTOMER_NODE_ID;
            const isOrigin = n.id === PROPAGATION_ORIGIN_ID;
            const isSel = selected?.id === n.id;

            if (!lit) {
              // Context node: a dot, not a square. Squares are the vocabulary
              // of the exposed layer and reserving the shape is most of what
              // keeps ninety nodes from flattening into one texture.
              return (
                <circle
                  key={n.id}
                  cx={x}
                  cy={y}
                  r={isSel ? 3 : 1.6}
                  fill={n.provenance === "MODELED" ? "var(--modeled)" : "var(--text-dim)"}
                  fillOpacity={isSel ? 1 : 0.95}
                  stroke={isSel ? "var(--text-primary)" : undefined}
                  strokeWidth={isSel ? 1 : undefined}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover((cur) => (cur?.id === n.id ? null : cur))}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(n);
                  }}
                  style={{ cursor: "pointer" }}
                />
              );
            }

            // Exposed BOM lines are drawn smaller than exposed sites and
            // suppliers: fourteen part markers at full size would out-shout the
            // handful of places that actually stopped.
            const r = n.ring === 1 ? 2 : 3;
            const color = isCustomer ? "var(--warn)" : "var(--critical)";
            return (
              <g key={n.id}>
                {/* Origin node: ONE thin ring, no glow, no stacked second
                    pulse. --critical held well back so the pulse registers as
                    a heartbeat rather than an alarm. */}
                {isOrigin ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={7}
                    fill="none"
                    stroke="var(--critical)"
                    strokeWidth={0.75}
                    strokeOpacity={0.45}
                    pointerEvents="none"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      animation: "ring-expand 2.4s ease-out infinite",
                    }}
                  />
                ) : null}
                {/* Selection is structural, not semantic. Neutral, so the two
                    accents on this panel stay --critical and --warn. */}
                {isSel ? (
                  <rect
                    x={x - r - 3}
                    y={y - r - 3}
                    width={2 * r + 6}
                    height={2 * r + 6}
                    fill="none"
                    stroke="var(--text-primary)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                ) : null}
                <rect
                  x={x - r}
                  y={y - r}
                  width={2 * r}
                  height={2 * r}
                  fill={color}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover((cur) => (cur?.id === n.id ? null : cur))}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(n);
                  }}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}

          {/* The two names. Halo-stroked so they stay readable over land, over
              lanes and over the quarantine fill without a label box. */}
          {NAMED.map((m) => {
            const n = NODE_BY_ID.get(m.id) as PlacedNode;
            const [x, y] = project(n.lng, n.lat);
            const flip = x > w - 150;
            const up = y > h - 26;
            const tx = flip ? x - 10 : x + 10;
            const ty = up ? y - 14 : y + 4;
            return (
              <g
                key={m.id}
                pointerEvents="none"
                textAnchor={flip ? "end" : "start"}
                style={{
                  paintOrder: "stroke",
                  stroke: "var(--bg-base)",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                }}
              >
                <text x={tx} y={ty} fill={m.tone} className="text-label">
                  {m.name}
                </text>
                <text x={tx} y={ty + 10} fill="var(--text-dim)" className="text-label">
                  {m.role}
                </text>
              </g>
            );
          })}

          {/* Cursor lat/long: 8px ticks at the four pane edges. Edge marks
              locate the cursor on both axes without drawing a line across the
              frame: the full-length crosshair read as a targeting reticle. */}
          {cursor ? (
            <g
              stroke="var(--text-secondary)"
              strokeWidth={1}
              strokeOpacity={0.55}
              shapeRendering="crispEdges"
              pointerEvents="none"
            >
              <line x1={cursor.x} y1={0} x2={cursor.x} y2={TICK} />
              <line x1={cursor.x} y1={h - TICK} x2={cursor.x} y2={h} />
              <line x1={0} y1={cursor.y} x2={TICK} y2={cursor.y} />
              <line x1={w - TICK} y1={cursor.y} x2={w} y2={cursor.y} />
            </g>
          ) : null}
        </svg>
      ) : null}

      {/* fixed cursor coordinate readout */}
      {ready ? (
        <div
          className="label pointer-events-none absolute left-2 z-10 tabular-nums"
          // The panel's bottom edge IS the viewport's now that the ticker band
          // is gone, so the readout takes the 24px safe inset, not bottom-2.
          style={{ bottom: "var(--safe-inset)" }}
        >
          {coord ?? "n/a"}
        </div>
      ) : null}

      {/* zoom / reset controls */}
      {ready ? (
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          <MapButton label="+" onClick={() => zoomStep(1)} title="Zoom in" />
          <MapButton label="−" onClick={() => zoomStep(-1)} title="Zoom out" />
          <MapButton label="⤢" onClick={resetView} title="Reset view" />
        </div>
      ) : null}

      {/* Scope toggle. Same glyph, weight and corner as the one on GRAPH so the
          two screens read as one product; the label states the current scope in
          full, which is why this panel needs no legend. */}
      {ready ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFullNetwork();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="label absolute right-2 z-10 flex items-center gap-1 text-dim transition-colors hover:text-interactive"
          style={{ bottom: "var(--safe-inset)" }}
        >
          <span aria-hidden>{fullNetwork ? "▣" : "▢"}</span>{" "}
          {fullNetwork
            ? `FULL NETWORK · ALL ${NODES.length} SITES`
            : `FULL NETWORK · EXPOSED PATH ONLY (${EXPOSED_PATH.size})`}
        </button>
      ) : null}

      {/* hover tooltip */}
      {ready && hover
        ? (() => {
            const [hx, hy] = project(hover.lng, hover.lat);
            const flip = hx > w - 180;
            const affected = AFFECTED[SITE_ALIAS[hover.id] ?? hover.id];
            return (
              <div
                className="pointer-events-none absolute z-10 border border-rule-strong bg-elevated px-2 py-1"
                style={{
                  left: flip ? undefined : hx + 8,
                  right: flip ? w - hx + 8 : undefined,
                  top: Math.min(hy + 8, Math.max(0, h - 72)),
                  minWidth: 150,
                }}
              >
                <div className="text-body text-primary">{hover.label}</div>
                <div className="text-label text-secondary">
                  {SITE_BY_ID.get(SITE_ALIAS[hover.id] ?? hover.id)?.function ??
                    `${hover.kind} · RING ${hover.ring}`}
                </div>
                {typeof affected === "number" ? (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="label">PARTS AFFECTED</span>
                    <span
                      className="text-value tabular-nums"
                      style={{
                        color: affected > 0 ? "var(--critical)" : "var(--text-secondary)",
                      }}
                    >
                      {affected}
                    </span>
                  </div>
                ) : null}
                <div className="label mt-0.5">CLICK FOR DETAIL</div>
              </div>
            );
          })()
        : null}

      <NodeDetailPanel
        detail={selected ? detailFor(selected) : null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function MapButton({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick: () => void;
  title: string;
}) {
  // Hairline square, --fs-label glyph. No fill weight, no accent colour, because this
  // is a control, not a feature.
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex h-6 w-6 items-center justify-center border border-rule-strong bg-panel text-label leading-none text-secondary transition-colors hover:text-primary"
    >
      {label}
    </button>
  );
}
