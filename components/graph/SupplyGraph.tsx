"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GRAPH } from "@/lib/data/graph";
import {
  buildBackgroundLayout,
  ringExtent,
  ringStrokePx,
  type FlowNode,
} from "@/components/graph/graphLayout";
import {
  LAYOUT,
  NODE_BY_ID,
  SCOPE_LABEL,
  type FlowView,
} from "@/components/graph/flowModel";
import {
  NodeDetailPanel,
  nodeDetailFromGraphNode,
  type NodeDetail,
  type NodeDetailField,
} from "@/components/shared/NodeDetailPanel";
import { GraphStats } from "@/components/graph/GraphStats";
import type { GraphNode } from "@/lib/types";

// The layout, the schedule and both tallies all live in flowModel.ts so the
// panel header (app/graph/page.tsx) reads the exact numbers this canvas draws.
// Nothing size-describing is computed locally any more.

function maxWeightOf(view: FlowView): number {
  return Math.max(1, ...view.layout.edges.map((e) => e.weight));
}
function flowAdjacencyOf(view: FlowView): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const n of view.layout.nodes) m.set(n.id, new Set());
  for (const e of view.layout.edges) {
    m.get(e.source)?.add(e.target);
    m.get(e.target)?.add(e.source);
  }
  return m;
}

// Deterministic background arrangement of the full 90-node network: inert
// context texture behind the flow when the toggle is on. Not the same LAYOUT
// (column/rank) as the flow, since this is decoration rather than a spatially
// consistent view of the same nodes, but it IS emitted in the flow's
// world-coordinate space so it can be painted through the same pan/zoom
// transform as the foreground instead of drifting out of sync while panning.
const BACKGROUND = buildBackgroundLayout(
  GRAPH.nodes,
  GRAPH.edges,
  { x: LAYOUT.colX[1], y: 0 },
  Math.max(LAYOUT.width, LAYOUT.height) * 0.55
);
const BACKGROUND_BY_ID = new Map(BACKGROUND.nodes.map((n) => [n.id, n]));

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function endId(x: unknown): string {
  return typeof x === "object" && x !== null ? (x as { id: string }).id : (x as string);
}

function weightT(w: number, maxWeight: number): number {
  return maxWeight <= 1 ? 0 : (w - 1) / (maxWeight - 1);
}

// Edge weight has to actually read: a 3-line edge unmistakably heavier than
// a 1-line edge, and a 1-line edge visibly receding rather than looking the
// same as everything else. The floor matters more than the previous pass
// gave it credit for: every column-1 (supplier to BOM) edge is weight 1 by
// construction (one BOM line, one supplier), and 7 of the 10 column-0 edges
// are ALSO weight 1 (only the 3 convergent suppliers are heavier), so 21 of
// 24 rendered edges sit at this floor. It has to be a real line, not a hint
// of one.
const EDGE_MIN_ALPHA = 0.55;
const EDGE_MAX_ALPHA = 0.95;
const EDGE_MIN_WIDTH = 1.3;
const EDGE_MAX_WIDTH = 4.2;
function edgeAlpha(weight: number, maxWeight: number): number {
  return EDGE_MIN_ALPHA + weightT(weight, maxWeight) * (EDGE_MAX_ALPHA - EDGE_MIN_ALPHA);
}
function edgeWidthFor(weight: number, maxWeight: number): number {
  return EDGE_MIN_WIDTH + weightT(weight, maxWeight) * (EDGE_MAX_WIDTH - EDGE_MIN_WIDTH);
}

// ---- label separation (all SCREEN px, deliberately) ----------------------
// A canvas label is drawn at a zoom-independent size, and so are the strokes
// it has to clear (the convergence ring, the origin band's outline). Express
// the clearance in world units and it collapses as you zoom out while the
// glyphs stay put, which is how the first character ended up sitting on the
// mark. Every number here is screen px, converted to world at draw time.
const LABEL_GAP_PX = 11; // clear air between the drawn mark and the first glyph
const LABEL_PLATE_PAD_PX = 3; // knockout overhang either side of the text
const LABEL_PLATE_HALF_H_PX = 7;
// The knockout is what keeps the edges leaving a node from running through
// its own name. Not fully opaque: the edge stays faintly continuous behind
// the text instead of appearing severed. No blur, no shadow (RULE 5).
const LABEL_PLATE_ALPHA = 0.86;
const ORIGIN_STROKE_PX = 1.5; // the origin band's outline, one value for draw + offset

// Custom fit, not the built-in zoomToFit: that call only sees node positions,
// not label text (the origin's label reads left, column-3 labels read right)
// and cannot express asymmetric margins. Padding is in screen px, so it holds
// regardless of world scale.
//
// These four are half of the occupancy story (graphLayout.ts's column spacing
// is the other half). Each is a MEASURED overhang plus 24px of edge clearance,
// not a guess, because every px of pad beyond what a label needs is a px the
// diagram cannot use:
//   left   141px, the origin's site name reading back from the band
//   right  109px, the longest MPN reading out from its dot
//   top     71px, the stats block in the top-right corner, plus half a line
//   bottom  63px, the legend bottom-left (the toggles bottom-right are shorter)
// The two horizontal overhangs are pixel-measured off a rendered frame, and
// they are screen-constant (canvas type is drawn at a fixed px size), so they
// hold at both viewports rather than only the one they came from.
const FIT_PAD_LEFT = 165;
const FIT_PAD_RIGHT = 133;
const FIT_PAD_TOP = 90;
const FIT_PAD_BOTTOM = 78;

function computeBBox(nodes: FlowNode[]) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const n of nodes) {
    const halfH = n.barHalfHeight ?? n.radius;
    xMin = Math.min(xMin, n.x - n.radius);
    xMax = Math.max(xMax, n.x + n.radius);
    yMin = Math.min(yMin, n.y - halfH);
    yMax = Math.max(yMax, n.y + halfH);
  }
  return { xMin, xMax, yMin, yMax };
}


// Canvas 2D never resolves var(...), so every color/size used inside ctx calls
// is read once from computed style at mount and cached here.
interface Palette {
  critical: string;
  modeled: string;
  trace: string;
  textSecondary: string;
  rule: string;
  bgBase: string;
  fsLabel: string; // e.g. "10px"
  fontMono: string;
  radiusMax: number; // RULE 6 ceiling, parsed from --radius-max
}

export function SupplyGraph({
  view,
  fullNetwork,
  onToggleFullNetwork,
}: {
  /** The scenario's flow view (flowModel.ts flowViewFor). The page keys this
   *  component on view.key, so within one mount the view never changes and
   *  a scenario change replays the reveal sequence from a clean canvas. */
  view: FlowView;
  fullNetwork: boolean;
  onToggleFullNetwork: () => void;
}) {
  const LAYOUT = view.layout;
  const SCHEDULE = view.schedule;
  const MAX_WEIGHT = useMemo(() => maxWeightOf(view), [view]);
  const FLOW_ADJACENCY = useMemo(() => flowAdjacencyOf(view), [view]);
  const CONTENT_BBOX = useMemo(() => computeBBox(LAYOUT.nodes), [LAYOUT]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const [FG, setFG] = useState<any>(null);
  const paletteRef = useRef<Palette | null>(null);
  useEffect(() => {
    let alive = true;
    import("react-force-graph-2d").then((m) => {
      if (!alive) return;
      const css = getComputedStyle(document.documentElement);
      const t = (n: string) => css.getPropertyValue(n).trim();
      paletteRef.current = {
        critical: t("--critical"),
        modeled: t("--modeled"),
        trace: t("--trace"),
        textSecondary: t("--text-secondary"),
        rule: t("--rule"),
        bgBase: t("--bg-base"),
        fsLabel: t("--fs-label") || "10px",
        fontMono: t("--font-mono") || "monospace",
        radiusMax: parseFloat(t("--radius-max")) || 0,
      };
      setFG(() => m.default);
    });
    return () => {
      alive = false;
    };
  }, []);

  const ready = size.w > 0 && size.h > 0 && !!FG;

  // Static graphData: positions are fixed (fx/fy), never mutated by a sim.
  const data = useMemo(
    () => ({
      nodes: LAYOUT.nodes.map((n) => ({ ...n, fx: n.x, fy: n.y })),
      links: LAYOUT.edges.map((e) => ({ ...e })),
    }),
    [LAYOUT]
  );

  const dataNodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);

  // Debug hook for structural verification (node col/x/y otherwise only
  // visible inside the FG canvas's own closure).
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__supplyGraphNodes = data.nodes;
    (window as any).__supplyGraphLayout = LAYOUT;
    (window as any).__supplyGraphViewKey = view.key;
    // World to screen, asked of the canvas itself rather than reconstructed
    // from the last zoom event: a programmatic fit does not always emit one,
    // so the cached transform can lag what is actually painted.
    (window as any).__supplyGraphToScreen = (x: number, y: number) =>
      fgRef.current?.graph2ScreenCoords?.(x, y) ?? null;
  }, [data, LAYOUT, view.key]);

  const selected = useRef<GraphNode | null>(null);
  const neighborIds = useRef<Set<string>>(new Set());
  const hovered = useRef<Set<string>>(new Set());
  const [, force] = useState(0);
  const repaint = useCallback(() => force((n) => n + 1), []);
  const [detailNode, setDetailNode] = useState<GraphNode | null>(null);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const started = useRef(false);
  const sequenceStart = useRef<number | null>(null);
  // The foreground's live pan/zoom transform, captured off FG's own zoom
  // event, shared with the background canvas so it never drifts out of sync
  // while panning with the full-network toggle on.
  const bgTransform = useRef({ k: 1, x: 0, y: 0 });

  const clearSelection = useCallback(() => {
    selected.current = null;
    neighborIds.current = new Set();
    setDetailNode(null);
    repaint();
  }, [repaint]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize((p) => {
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        return p.w === w && p.h === h ? p : { w, h };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Static, deterministic full-network context texture. Positions never
  // change (no simulation), only the shared pan/zoom transform does, so this
  // redraws on toggle, resize, AND every foreground zoom/pan tick.
  const drawBackground = useCallback(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, size.w) * dpr;
    canvas.height = Math.max(1, size.h) * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const p = paletteRef.current;
    if (!fullNetwork || !p || size.w <= 0 || size.h <= 0) return;

    // Same transform order FG applies to its own canvas (translate, then
    // scale). Positions below are already in the flow's world space.
    const { k, x, y } = bgTransform.current;
    ctx.translate(x, y);
    ctx.scale(k, k);

    const byId = BACKGROUND_BY_ID;
    ctx.strokeStyle = p.rule;
    ctx.lineWidth = 1 / k;
    for (const e of BACKGROUND.edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.fillStyle = p.rule;
    for (const n of BACKGROUND.nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.6 / k, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [fullNetwork, size]);

  useEffect(() => {
    drawBackground();
  }, [drawBackground, ready]);

  const onZoom = useCallback(
    (t: { k: number; x: number; y: number }) => {
      bgTransform.current = t;
      if (typeof window !== "undefined") (window as any).__supplyGraphTransform = t;
      drawBackground();
    },
    [drawBackground]
  );

  // Ask the canvas what transform it is actually painting with, rather than
  // trusting the last onZoom event: a programmatic fit does not reliably emit
  // one, and a background painted from the stale value lands hundreds of px
  // away from the flow it is supposed to sit behind.
  const readTransform = useCallback(() => {
    const fg = fgRef.current;
    const g2s = fg?.graph2ScreenCoords;
    if (typeof g2s !== "function") return null;
    const origin = g2s.call(fg, 0, 0);
    const unit = g2s.call(fg, 1, 0);
    if (!origin || !unit) return null;
    return { k: unit.x - origin.x, x: origin.x, y: origin.y };
  }, []);

  const syncBackgroundToView = useCallback(() => {
    const t = readTransform();
    if (!t || !isFinite(t.k) || t.k <= 0) return;
    bgTransform.current = t;
    if (typeof window !== "undefined") (window as any).__supplyGraphTransform = t;
    drawBackground();
  }, [drawBackground, readTransform]);

  // Asymmetric fit: centerAt the adjusted focus point, then zoom, matching the
  // order the library's own zoomToFit uses (centerAt first; zoom's scaleTo
  // keeps whatever point centerAt just set centered as k changes).
  const fitView = useCallback(() => {
    const fg = fgRef.current;
    if (!fg || size.w <= 0 || size.h <= 0) return;
    const bboxW = CONTENT_BBOX.xMax - CONTENT_BBOX.xMin;
    const bboxH = CONTENT_BBOX.yMax - CONTENT_BBOX.yMin;
    const usableW = Math.max(1, size.w - FIT_PAD_LEFT - FIT_PAD_RIGHT);
    const usableH = Math.max(1, size.h - FIT_PAD_TOP - FIT_PAD_BOTTOM);
    const scale = Math.max(0.4, Math.min(4, Math.min(usableW / bboxW, usableH / bboxH)));

    const bboxCenterX = (CONTENT_BBOX.xMin + CONTENT_BBOX.xMax) / 2;
    const bboxCenterY = (CONTENT_BBOX.yMin + CONTENT_BBOX.yMax) / 2;
    const desiredScreenX = FIT_PAD_LEFT + usableW / 2;
    const desiredScreenY = FIT_PAD_TOP + usableH / 2;
    const focusX = bboxCenterX - (desiredScreenX - size.w / 2) / scale;
    const focusY = bboxCenterY - (desiredScreenY - size.h / 2) / scale;

    fg.centerAt?.(focusX, focusY, 0);
    fg.zoom?.(scale, 0);
  }, [size, CONTENT_BBOX]);

  // Fit the fixed layout into whatever the container measures, then reveal on
  // a later frame so the fitted transform is actually painted first (no flash
  // of an unfitted frame). No simulation to wait for, since position is
  // already final, so this fires as soon as the panel is measured and FG loads.
  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => {
      fitView();
      syncBackgroundToView();
      requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    });
    return () => cancelAnimationFrame(id);
  }, [ready, fitView, syncBackgroundToView]);

  // After reveal, a container resize only re-fits the view (pure canvas
  // transform). Positions themselves never change.
  useEffect(() => {
    if (!ready || !revealed) return;
    fitView();
    syncBackgroundToView();
  }, [ready, revealed, size.w, size.h, fitView, syncBackgroundToView]);

  // Column-by-column reveal, eased (no bounce), fixed 6s total. Driven by a
  // bounded rAF loop that forces a re-render each frame: the canvas library
  // pauses its own redraw once idle, so a fresh render is what makes the
  // per-frame eased opacity actually paint.
  const runSequence = useCallback(() => {
    sequenceStart.current = performance.now();
    setHeaderVisible(false);
    repaint();

    const headerTimer = window.setTimeout(() => {
      setHeaderVisible(true);
    }, SCHEDULE.headerAtMs);

    let raf = 0;
    const loop = () => {
      repaint();
      const elapsed = performance.now() - (sequenceStart.current ?? 0);
      if (elapsed < SCHEDULE.totalMs + SCHEDULE.fadeMs) {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.clearTimeout(headerTimer);
      cancelAnimationFrame(raf);
    };
  }, [repaint]);

  useEffect(() => {
    if (!revealed || started.current) return;
    started.current = true;
    const cleanup = runSequence();
    return cleanup;
  }, [revealed, runSequence]);

  const stageProgress = (stageMs: number): number => {
    if (sequenceStart.current == null) return 1;
    const e = performance.now() - sequenceStart.current - stageMs;
    if (e <= 0) return 0;
    if (e >= SCHEDULE.fadeMs) return 1;
    return easeOutCubic(e / SCHEDULE.fadeMs);
  };
  const colStageMs = (col: 0 | 1 | 2) =>
    col === 0 ? SCHEDULE.originAtMs : col === 1 ? SCHEDULE.column2AtMs : SCHEDULE.column3AtMs;

  const isDimmed = (id: string): boolean => {
    if (selected.current !== null) {
      return id !== selected.current.id && !neighborIds.current.has(id);
    }
    if (hovered.current.size > 0) return !hovered.current.has(id);
    return false;
  };
  const linkDimmed = (l: any): boolean => {
    const s = endId(l.source);
    const t = endId(l.target);
    const active =
      selected.current !== null
        ? neighborIds.current
        : hovered.current.size > 0
        ? hovered.current
        : null;
    if (!active) return false;
    return !(active.has(s) && active.has(t));
  };

  const neighborsOf = useCallback((id: string) => {
    return new Set<string>([id, ...(FLOW_ADJACENCY.get(id) ?? [])]);
  }, []);

  const onNodeClick = useCallback(
    (node: any) => {
      if (selected.current?.id === node.id) {
        clearSelection();
        return;
      }
      const full = NODE_BY_ID.get(node.id);
      if (!full) return;
      selected.current = full;
      neighborIds.current = neighborsOf(node.id);
      setDetailNode(full);
      repaint();
    },
    [neighborsOf, repaint, clearSelection]
  );

  const onNodeHover = useCallback(
    (node: any) => {
      if (!node) {
        if (hovered.current.size) {
          hovered.current = new Set();
          repaint();
        }
        return;
      }
      hovered.current = neighborsOf(node.id);
      repaint();
    },
    [neighborsOf, repaint]
  );

  // Not memoized: a fresh function reference each render is what makes the
  // canvas library notice the "prop changed" and actually redraw, which the
  // eased per-frame opacity below depends on during the reveal window.
  const nodeCanvasObject = (node: FlowNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const p = paletteRef.current;
    if (!p) return;
    const reveal = stageProgress(colStageMs(node.col));
    if (reveal <= 0) return;
    const dim = isDimmed(node.id);

    const isOrigin = node.col === 0 && node.barHalfHeight;

    ctx.beginPath();
    if (isOrigin && node.barHalfHeight) {
      // The affected site: a band, not a point. Edges leave it at distributed
      // y positions (see linkCanvasObject) instead of converging on this
      // shape's center, so it reads as a site rather than a part. RULE 6: 2px
      // is the rounding ceiling, so the corner radius is read from
      // --radius-max, not the shape's own half-width.
      const w = node.radius * 2;
      const h = node.barHalfHeight * 2;
      const x0 = node.x - node.radius;
      const y0 = node.y - node.barHalfHeight;
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x0, y0, w, h, p.radiusMax);
      } else {
        ctx.rect(x0, y0, w, h);
      }
    } else {
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
    }
    // The origin band fills at reduced alpha and gets a solid outline instead
    // of a full-saturation fill: a wide, fully-saturated bar reads as UI
    // chrome (a scrollbar), not a site. Still unmistakably critical: same hue,
    // just fill-vs-stroke instead of solid-vs-solid. Columns 1/2 are
    // unaffected, since a full-saturation dot is correct for a single part.
    if (isOrigin) {
      ctx.fillStyle = hexToRgba(node.modeled ? p.modeled : p.critical, 0.45);
      ctx.globalAlpha = reveal * (dim ? 0.15 : 1);
      ctx.fill();
      ctx.strokeStyle = node.modeled ? p.modeled : p.critical;
      ctx.lineWidth = ORIGIN_STROKE_PX / scale;
      ctx.globalAlpha = reveal * (dim ? 0.15 : 0.9);
      ctx.stroke();
    } else {
      ctx.fillStyle = node.modeled ? p.modeled : p.critical;
      ctx.globalAlpha = reveal * (dim ? 0.15 : 1);
      ctx.fill();
    }

    // Convergence ring: heavier for a supplier feeding more exposed lines.
    // Same hue as the exposure edges (RULE 3: --trace is reserved for the
    // contamination path, and that IS what this whole view is). Both the
    // radius and the stroke width come from graphLayout, so the label offset
    // below can clear the exact geometry that gets drawn here.
    const ring = node.col === 1 ? ringExtent(node.feedCount) : 0;
    const ringStroke = node.col === 1 ? ringStrokePx(node.feedCount) : 0;
    if (ring > 0) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + ring, 0, 2 * Math.PI);
      ctx.strokeStyle = p.trace;
      ctx.lineWidth = ringStroke / scale;
      ctx.globalAlpha = reveal * (dim ? 0.1 : 0.9);
      ctx.stroke();
    }

    // Label: right of the node, vertically centered, except the origin, whose
    // label reads to the LEFT (nothing is upstream of it to collide with, and
    // it keeps the band from reading as belonging to column 1).
    //
    // The clearance is computed in SCREEN px and only then converted back to
    // world units. Every quantity it has to clear is screen-constant (the
    // ring's stroke, the band's outline, the type size itself), so doing this
    // arithmetic in world units made the gap shrink with the zoom level while
    // the glyphs stayed the same size. That is how the first character kept
    // landing on the mark at the low end of the fit range.
    const strokePx = isOrigin ? ORIGIN_STROKE_PX : ringStroke;
    const extentPx = (node.radius + ring) * scale + strokePx / 2;
    const offsetWorld = (extentPx + LABEL_GAP_PX) / scale;

    ctx.font = `${parseFloat(p.fsLabel) / scale}px ${p.fontMono}`;
    ctx.textBaseline = "middle";
    const alpha = reveal * (dim ? 0.25 : 1);
    const readsLeft = node.col === 0;
    const textX = readsLeft ? node.x - offsetWorld : node.x + offsetWorld;

    // Knockout behind the glyphs. Edges leave a supplier at exactly the y its
    // own label sits on, so without this the name has a --trace line running
    // through its middle, which on camera reads as the label overlapping the
    // node. Links are painted before nodes, so this plate lands on top of
    // them. Flat fill, slightly transparent: the edge stays continuous behind
    // the text rather than looking severed, and there is no blur (RULE 5).
    const textW = ctx.measureText(node.label).width;
    const padWorld = LABEL_PLATE_PAD_PX / scale;
    const halfHWorld = LABEL_PLATE_HALF_H_PX / scale;
    const plateX = readsLeft ? textX - textW - padWorld : textX - padWorld;
    ctx.globalAlpha = alpha * LABEL_PLATE_ALPHA;
    ctx.fillStyle = p.bgBase;
    ctx.fillRect(plateX, node.y - halfHWorld, textW + padWorld * 2, halfHWorld * 2);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.textSecondary;
    ctx.textAlign = readsLeft ? "right" : "left";
    ctx.fillText(node.label, textX, node.y);
    ctx.globalAlpha = 1;
  };

  const nodePointerAreaPaint = (node: FlowNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (node.col === 0 && node.barHalfHeight) {
      const w = node.radius * 2 + 4;
      const h = node.barHalfHeight * 2 + 4;
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(node.x - w / 2, node.y - h / 2, w, h, node.radius + 2);
      } else {
        ctx.rect(node.x - w / 2, node.y - h / 2, w, h);
      }
      ctx.fill();
      return;
    }
    ctx.arc(node.x, node.y, node.radius + 2, 0, 2 * Math.PI);
    ctx.fill();
  };

  // Column-1 (supplier to BOM) edges use the library's default line paint:
  // they are always weight 1, so they sit at the receded end of the range by
  // construction, correctly reading as "no convergence here."
  const linkColor = (l: any): string => {
    const p = paletteRef.current;
    if (!p) return "transparent";
    const reveal = stageProgress(SCHEDULE.column3AtMs);
    if (reveal <= 0) return "transparent";
    const dim = linkDimmed(l);
    return hexToRgba(p.trace, reveal * edgeAlpha(l.weight, MAX_WEIGHT) * (dim ? 0.2 : 1));
  };
  const linkWidth = (l: any): number => edgeWidthFor(l.weight, MAX_WEIGHT);

  // Column-0 (origin to supplier) edges are fully custom-drawn ("replace"):
  // the line itself leaves the band at the supplier's own row (distributed,
  // not converging on the band's center, see graphLayout.ts), and a multi-hop
  // edge gets a tick plus hop count at its precomputed 40%-along anchor. The
  // line stays identical to a direct edge otherwise: same --trace color, same
  // weight-driven width (RULE 3 intact, dashes stay reserved for MODELED).
  // Only the tick marks it as collapsed.
  const linkCanvasObjectMode = (l: any) => (l.col === 0 ? ("replace" as const) : undefined);
  const linkCanvasObject = (l: any, ctx: CanvasRenderingContext2D, scale: number) => {
    if (l.col !== 0) return;
    const p = paletteRef.current;
    if (!p) return;
    const reveal = stageProgress(SCHEDULE.column2AtMs);
    if (reveal <= 0) return;
    const origin = dataNodeById.get(endId(l.source));
    const target = dataNodeById.get(endId(l.target));
    if (!origin || !target) return;
    const dim = linkDimmed(l);

    const sx = origin.x + origin.radius;
    const sy = target.y;
    const tx = target.x;
    const ty = target.y;

    ctx.globalAlpha = reveal * edgeAlpha(l.weight, MAX_WEIGHT) * (dim ? 0.2 : 1);
    ctx.strokeStyle = p.trace;
    ctx.lineWidth = edgeWidthFor(l.weight, MAX_WEIGHT) / scale;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (l.direct || typeof l.tickX !== "number" || typeof l.tickY !== "number") return;

    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const tick = 8 / scale;
    const alpha = reveal * (dim ? 0.2 : 1);

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = p.trace;
    ctx.lineWidth = 1.5 / scale;
    ctx.beginPath();
    ctx.moveTo(l.tickX - px * tick, l.tickY - py * tick);
    ctx.lineTo(l.tickX + px * tick, l.tickY + py * tick);
    ctx.stroke();

    ctx.fillStyle = p.textSecondary;
    ctx.font = `${parseFloat(p.fsLabel) / scale}px ${p.fontMono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(l.hops), l.tickX + px * (tick + 4), l.tickY + py * (tick + 4));
    ctx.globalAlpha = 1;
  };

  // Augment the shared NodeDetail with the collapsed hop, so a multi-hop
  // supplier's intermediate zone site is inspectable rather than hidden
  // behind the single line the flow draws for it.
  const detailFor = (node: GraphNode): NodeDetail => {
    const base = nodeDetailFromGraphNode(node);
    const hop = SCHEDULE.hopBySupplier.get(node.id);
    if (!hop || hop.direct) return base;
    const via = hop.viaIds.map((id) => NODE_BY_ID.get(id)?.label ?? id).join(" → ");
    const field: NodeDetailField = {
      label: "COLLAPSED HOP",
      value: `${hop.hops} hops via ${via}`,
      tone: "var(--trace)",
    };
    return { ...base, fields: [field, ...(base.fields ?? [])] };
  };

  const handleReplay = useCallback(() => {
    runSequence();
  }, [runSequence]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[var(--bg-base)]">
      <canvas
        ref={bgCanvasRef}
        className="pointer-events-none absolute inset-0"
        style={{ width: size.w, height: size.h }}
      />

      {ready ? (
        <div
          className="absolute inset-0"
          style={{ opacity: revealed ? 1 : 0, transition: "opacity 350ms ease-out" }}
        >
          <FG
            ref={fgRef}
            graphData={data}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            nodeId="id"
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            enableNodeDrag={false}
            linkLabel={(l: any) =>
              `${l.weight} BOM line${l.weight === 1 ? "" : "s"} routed through this relationship`
            }
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkCanvasObjectMode={linkCanvasObjectMode}
            linkCanvasObject={linkCanvasObject}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onBackgroundClick={clearSelection}
            onZoom={onZoom}
            minZoom={0.4}
            maxZoom={4}
            cooldownTicks={0}
          />
        </div>
      ) : null}

      <div
        className="text-body pointer-events-none absolute left-2 top-2 z-10 max-w-[min(70%,560px)] border border-[color-mix(in_srgb,var(--trace)_40%,transparent)] bg-[color-mix(in_srgb,var(--bg-base)_85%,transparent)] px-2 py-1 leading-tight tracking-[0.02em] text-trace transition-opacity duration-300"
        style={{ opacity: headerVisible ? 1 : 0 }}
      >
        {SCHEDULE.headerLabel}
      </div>

      <GraphStats
        tally={fullNetwork ? view.fullTally : view.foregroundTally}
        scope={fullNetwork ? SCOPE_LABEL.full : SCOPE_LABEL.foreground}
      />

      <NodeDetailPanel
        detail={detailNode ? detailFor(detailNode) : null}
        onClose={clearSelection}
      />

      {/* both offsets are the shared 24px safe margin, not *-2: this panel
          is full bleed, so the canvas right AND bottom edges are the
          window's (the bottom since the ticker band was removed), and these
          two controls were the outermost glyphs on the screen at 8px out. */}
      <div
        className="absolute z-10 flex flex-col items-end gap-1"
        style={{ right: "var(--safe-inset)", bottom: "var(--safe-inset)" }}
      >
        <button
          type="button"
          onClick={onToggleFullNetwork}
          className="label flex items-center gap-1 text-dim transition-colors hover:text-interactive"
        >
          <span aria-hidden>{fullNetwork ? "▣" : "▢"}</span> FULL NETWORK
        </button>
        <button
          type="button"
          onClick={handleReplay}
          className="label flex items-center gap-1 text-dim transition-colors hover:text-interactive"
        >
          <span aria-hidden>↻</span> REPLAY
        </button>
      </div>
    </div>
  );
}
