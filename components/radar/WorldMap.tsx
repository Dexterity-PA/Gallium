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
  geoPath,
  geoProjection,
  type GeoProjection,
  type GeoRawProjection,
} from "d3-geo";
import { feature } from "topojson-client";
import { SITES, QUARANTINE_ZONE, CUSTOMER_SITE_ID } from "@/lib/data/sites";
import { BOM } from "@/lib/data/bom";
import type { Site } from "@/lib/types";
import {
  NodeDetailPanel,
  nodeDetailFromSite,
  type NodeDetail,
} from "@/components/shared/NodeDetailPanel";
// Bundled at build time — nothing loads from the network at runtime.
import worldTopo from "../../public/geo/world-110m.json";

const INBOUND_ID = "NODE-CHI"; // Chicago inbound — ocean freight terminus

// ---- framing (unchanged: uniform equirectangular, no stretch) ------------
// The base projection fits every site inside the panel with ~5° margin and ONE
// scale factor on both axes (kx === ky), so landmasses keep their true shape.
// Pan/zoom is layered on TOP of this fit as a screen-space transform, so the
// projection decision (uniform crop, intentional letterbox) is preserved and
// the home / reset view is exactly this fit.
const LNG_MIN = -102;
const LNG_MAX = 136;
const LAT_MIN = 0;
const LAT_MAX = 52;
const DEG = Math.PI / 180;

const GRATICULE = geoGraticule().step([20, 20]);

// Equirectangular identity raw projection. `invert` is what makes the cursor
// lat/long readout possible — d3 only exposes projection.invert when the raw
// projection supplies one, and the identity is its own inverse.
const RAW_EQUIRECT: GeoRawProjection = Object.assign(
  (lambda: number, phi: number): [number, number] => [lambda, phi],
  { invert: (x: number, y: number): [number, number] => [x, y] }
);

const MIN_Z = 1; // home = fit; cannot zoom out past the full map
const MAX_Z = 8;

const TICK = 8; // px — edge tick length for the cursor lat/long marks

// The readout must never claim a coordinate that does not exist. Longitude
// wraps (panning hard at high zoom runs past ±180); latitude clamps, because
// the uniform fit letterboxes past the poles — the pane's top and bottom edges
// sit beyond ±90 and inverting there yields a latitude no place has.
const wrapLng = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;
const clampLat = (l: number) => Math.min(90, Math.max(-90, l));

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
  for (const s of SITES) {
    const t = tok[s.id];
    out[s.id] = t
      ? BOM.filter((b) => b.status === "EXPOSED" && b.actualExposure?.includes(t)).length
      : 0;
  }
  return out;
})();

// Lanes drawn on the map are ONLY the ones the active scenario touches: the
// origins inside the quarantine zone. The other six origins are still on the
// map as nodes, but drawing their lanes too made the arcs read as decoration.
const SCENARIO_ORIGINS = SITES.filter(
  (s) => s.exposed && s.id !== CUSTOMER_SITE_ID && s.id !== INBOUND_ID
);

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

export function WorldMap({ focus }: { focus?: MapFocusRequest | null } = {}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [hover, setHover] = useState<Site | null>(null);
  const [selected, setSelected] = useState<Site | null>(null);
  const [view, setView] = useState<View>({ z: 1, panX: 0, panY: 0 });
  // Raw cursor position in pane coordinates — drives the edge ticks and the
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

  // Base (fit) projection + static geographic paths. Independent of view.
  const { projection, pathD, gratD } = useMemo(() => {
    if (!(w > 0 && h > 0)) {
      return { projection: null as GeoProjection | null, pathD: "", gratD: "" };
    }
    const k = Math.min(w / (LNG_MAX - LNG_MIN), h / (LAT_MAX - LAT_MIN));
    const proj = geoProjection(RAW_EQUIRECT)
      .scale(k / DEG)
      .translate([
        w / 2 - k * ((LNG_MIN + LNG_MAX) / 2),
        h / 2 + k * ((LAT_MIN + LAT_MAX) / 2),
      ]);
    const path = geoPath(proj);
    return { projection: proj, pathD: path(land) ?? "", gratD: path(GRATICULE()) ?? "" };
  }, [w, h, land]);

  // base-projection coords for a lng/lat (pre-transform)
  const base = useCallback(
    (lng: number, lat: number): [number, number] =>
      projection ? (projection([lng, lat]) as [number, number]) : [0, 0],
    [projection]
  );

  const cx = w / 2;
  const cy = h / 2;

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

  // fly-to animation handle (declared early: pan/zoom/reset all cancel it)
  const flyRaf = useRef(0);
  const cancelFly = useCallback(() => {
    if (flyRaf.current) cancelAnimationFrame(flyRaf.current);
    flyRaf.current = 0;
  }, []);

  const clampView = useCallback(
    (v: View): View => {
      const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z));
      // keep the map from being dragged off-screen: allowed pan grows with zoom.
      const maxX = (z - 1) * w * 0.6;
      const maxY = (z - 1) * h * 0.6;
      return {
        z,
        panX: Math.min(maxX, Math.max(-maxX, v.panX)),
        panY: Math.min(maxY, Math.max(-maxY, v.panY)),
      };
    },
    [w, h]
  );

  // ---- zoom about an anchor point (cursor for wheel, centre for buttons) ----
  const zoomTo = useCallback(
    (nextZ: number, ax: number, ay: number) => {
      setView((v) => {
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
    [cx, cy, clampView]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!ready) return;
      e.preventDefault();
      const rect = wrapRef.current?.getBoundingClientRect();
      const ax = rect ? e.clientX - rect.left : cx;
      const ay = rect ? e.clientY - rect.top : cy;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * factor));
        const bx = (ax - cx - v.panX) / v.z + cx;
        const by = (ay - cy - v.panY) / v.z + cy;
        return clampView({ z, panX: ax - cx - z * (bx - cx), panY: ay - cy - z * (by - cy) });
      });
    },
    [ready, cx, cy, clampView]
  );

  const zoomStep = useCallback(
    (dir: 1 | -1) => zoomTo(view.z * (dir === 1 ? 1.6 : 1 / 1.6), cx, cy),
    [zoomTo, view.z, cx, cy]
  );

  const resetView = useCallback(() => {
    cancelFly();
    setView({ z: 1, panX: 0, panY: 0 });
  }, []);

  // ---- drag-to-pan -------------------------------------------------------
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false); // suppresses the click that ends a drag
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    justDragged.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
      d.moved = true;
      justDragged.current = true;
      d.x = e.clientX;
      d.y = e.clientY;
      cancelFly();
      setView((v) => clampView({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
    },
    [clampView, cancelFly]
  );
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);
  // Background click clears the selection. Site/arc clicks stopPropagation, so
  // they never reach here; a click that ended a drag is suppressed.
  const onBackgroundClick = useCallback(() => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    setSelected(null);
  }, []);

  // ---- fly-to (feed → node) ---------------------------------------------
  const flyToSite = useCallback(
    (site: Site) => {
      if (!projection) return;
      cancelFly();
      const [bx, by] = base(site.lng, site.lat);
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
        setView({
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
    const site = SITES.find((s) => s.id === focus.siteId);
    if (!site) return;
    setSelected(site);
    flyToSite(site);
  }, [focus, ready, flyToSite]);

  useEffect(() => () => cancelFly(), [cancelFly]);

  // ---- geometry helpers --------------------------------------------------
  const rockford = SITES.find((s) => s.id === CUSTOMER_SITE_ID)!;
  const chicago = SITES.find((s) => s.id === INBOUND_ID)!;
  const [rx, ry] = ready ? project(rockford.lng, rockford.lat) : [0, 0];
  const [chx, chy] = ready ? project(chicago.lng, chicago.lat) : [0, 0];

  const arcPath = (x0: number, y0: number, x1: number, y1: number, lift = 0.28) => {
    const cxm = (x0 + x1) / 2;
    const cym = (y0 + y1) / 2 - Math.hypot(x1 - x0, y1 - y0) * lift;
    return `M ${x0} ${y0} Q ${cxm} ${cym} ${x1} ${y1}`;
  };

  const selectSite = useCallback((s: Site) => {
    setSelected((cur) => (cur?.id === s.id ? null : s));
  }, []);

  const detail: NodeDetail | null = selected
    ? nodeDetailFromSite(selected, { affected: AFFECTED[selected.id] })
    : null;

  const coord = useMemo(() => {
    if (!cursor) return null;
    const ll = unproject(cursor.x, cursor.y);
    return ll ? formatCoord(ll[0], ll[1]) : null;
  }, [cursor, unproject]);

  // group transform: zoom about centre, then pan (screen space)
  const groupTransform = `translate(${view.panX} ${view.panY}) translate(${cx} ${cy}) scale(${view.z}) translate(${-cx} ${-cy})`;

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

          {/* geographic layer — scales/pans with the view transform */}
          <g transform={groupTransform}>
            {/* Graticule sits below the threshold of notice on purpose — it is
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
                per-country variation — landmass is a backdrop. */}
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
          </g>

          {/* ocean lanes — scenario only: quarantined origin → Chicago inbound
              (screen space, clickable) */}
          {SCENARIO_ORIGINS.map((s, i) => {
            const [x0, y0] = project(s.lng, s.lat);
            const d = arcPath(x0, y0, chx, chy);
            const color = "var(--critical)";
            const on = selected?.id === s.id;
            return (
              <g key={s.id}>
                {/* wide invisible hit target so thin arcs are clickable */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={10}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSite(s);
                  }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={on ? 1.8 : 1.2}
                  strokeOpacity={on ? 0.95 : 0.75}
                  strokeDasharray="3 4"
                  pointerEvents="none"
                />
                <circle
                  r={2}
                  fill={color}
                  pointerEvents="none"
                  style={{
                    offsetPath: `path("${d}")`,
                    offsetRotate: "0deg",
                    animation: `packet-stall 3s ease-in-out ${(i % 3) * 0.4}s infinite`,
                  }}
                />
              </g>
            );
          })}

          {/* Final inland leg: Chicago inbound → Rockford assembly. Kept because
              it is the last leg of the quarantined freight — without it the
              scenario lanes stop at a port and never reach the customer. Neutral
              tone: the disruption is upstream of here. */}
          {(() => {
            const d = arcPath(chx, chy, rx, ry, 0.4);
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

          {/* sites — constant-size 4px squares in screen space */}
          {SITES.map((s) => {
            const [x, y] = project(s.lng, s.lat);
            const isKhh = s.id === "NODE-KHH-ASE";
            const isSel = selected?.id === s.id;
            const color = s.exposed
              ? "var(--critical)"
              : s.isCustomer
              ? "var(--warn)"
              : "var(--text-dim)";
            return (
              <g key={s.id}>
                {/* Affected node: ONE thin ring, no glow, no stacked second
                    pulse. --critical held well back so the pulse registers as
                    a heartbeat rather than an alarm. */}
                {isKhh ? (
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
                {/* Selection is structural, not semantic — neutral, so the two
                    accents on this panel stay --critical and --warn. */}
                {isSel ? (
                  <rect
                    x={x - 6}
                    y={y - 6}
                    width={12}
                    height={12}
                    fill="none"
                    stroke="var(--text-primary)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                ) : null}
                <rect
                  x={x - 3}
                  y={y - 3}
                  width={6}
                  height={6}
                  fill={color}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover((cur) => (cur?.id === s.id ? null : cur))}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSite(s);
                  }}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}

          {/* Cursor lat/long: 8px ticks at the four pane edges. Edge marks
              locate the cursor on both axes without drawing a line across the
              frame — the full-length crosshair read as a targeting reticle. */}
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
        <div className="label pointer-events-none absolute bottom-2 left-2 z-10 tabular-nums">
          {coord ?? "—"}
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

      {/* hover tooltip */}
      {ready && hover
        ? (() => {
            const [hx, hy] = project(hover.lng, hover.lat);
            const flip = hx > w - 180;
            return (
              <div
                className="pointer-events-none absolute z-10 border border-rule-strong bg-elevated px-2 py-1"
                style={{
                  left: flip ? undefined : hx + 8,
                  right: flip ? w - hx + 8 : undefined,
                  top: hy + 8,
                  minWidth: 150,
                }}
              >
                <div className="text-body text-primary">{hover.label}</div>
                <div className="text-label text-secondary">{hover.function}</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="label">PARTS AFFECTED</span>
                  <span
                    className="text-value tabular-nums"
                    style={{
                      color: AFFECTED[hover.id] > 0 ? "var(--critical)" : "var(--text-secondary)",
                    }}
                  >
                    {AFFECTED[hover.id]}
                  </span>
                </div>
                <div className="label mt-0.5">CLICK FOR DETAIL</div>
              </div>
            );
          })()
        : null}

      <NodeDetailPanel detail={detail} onClose={() => setSelected(null)} />
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
  // Hairline square, --fs-label glyph. No fill weight, no accent colour — this
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
