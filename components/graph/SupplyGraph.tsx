"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GRAPH } from "@/lib/data/graph";
import { buildContaminationSchedule } from "@/components/graph/ContaminationSequence";
import {
  NodeDetailPanel,
  nodeDetailFromGraphNode,
} from "@/components/shared/NodeDetailPanel";
import { GraphStats } from "@/components/graph/GraphStats";
import type { GraphNode } from "@/lib/types";

const SCHEDULE = buildContaminationSchedule();

// Persistent caption naming the cyan trace, from real node labels along the
// scripted path (Meridian → BOM → supplier → Kaohsiung origin). The floating
// TIER-2 tooltip is not enough on its own — this spells the path out.
const TRACE_CAPTION = (() => {
  const byId = new Map(GRAPH.nodes.map((n) => [n.id, n.label]));
  const names = SCHEDULE.tracePathIds.map((id) => byId.get(id) ?? id);
  return `CONTAMINATION PATH — ${names.join(" → ")}`;
})();

// trace links as undirected keys
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const TRACE_LINKS = new Set<string>();
for (let i = 0; i < SCHEDULE.tracePathIds.length - 1; i++) {
  TRACE_LINKS.add(pairKey(SCHEDULE.tracePathIds[i], SCHEDULE.tracePathIds[i + 1]));
}

// Ring layout — concentric ELLIPTICAL tiers centered on the canvas center.
//   0 Meridian · 1 the 31 BOM lines · 2 suppliers/mfrs · 3 fabs/backend/logistics
// RING_RY is the VERTICAL semi-axis per ring; the horizontal semi-axis is
// RING_RY * aspect (canvas w/h). Making every ring an ellipse whose bbox matches
// the canvas aspect lets zoomToFit fill a wide 16:9 frame with no side margins
// (circular rings would leave big left/right gaps). Gaps (190/160/150 vertical)
// are far larger than any node so rings never collide.
const RING_RY: Record<number, number> = { 0: 0, 1: 190, 2: 350, 3: 500 };
const RADIAL_STRENGTH = 0.9; // firmly holds each node on its ellipse (radius only)
const CHARGE_STRENGTH = -55; // light: fine-tune angular spacing without disturbing the seed
const CHARGE_DISTANCE_MAX = 220; // keep repulsion local so rings don't bow
const LINK_DISTANCE = 42;
const LINK_STRENGTH = 0.08; // very gentle angular nudge; never collapses radii

// The cyan trace nodes are seeded onto ONE fixed spoke (upper-right, clear of the
// bottom-left legend and bottom-right REPLAY) so the trace reads as a straight
// radial line stepping inward Kaohsiung(r3) → S-TI(r2) → ISO5852SDW(r1) → Meridian.
const TRACE_SPOKE_RAD = -Math.PI / 4;

// Assign every node to a ring from its tier (ring field) or, defensively, its kind.
const ringOf = (n: { ring?: number; kind?: string }): number => {
  if (typeof n.ring === "number") return n.ring;
  switch (n.kind) {
    case "CUSTOMER":
      return 0;
    case "BOM":
      return 1;
    case "SUPPLIER":
      return 2;
    default:
      return 3; // FAB | BACKEND | LOGISTICS
  }
};

// Elliptical generalization of forceRadial: pulls each node onto the ellipse
// (rx,ry) of its ring while leaving it free to move ANGULARLY. Reduces to a plain
// radial force when rx === ry. Ring 0 (rx=ry=0, and pinned) is skipped.
function ellipticalRadial(
  cx: number,
  cy: number,
  axesOf: (n: any) => { rx: number; ry: number },
  strength: number
) {
  let simNodes: any[] = [];
  const force = (alpha: number) => {
    for (const node of simNodes) {
      const { rx, ry } = axesOf(node);
      if (rx <= 0 || ry <= 0) continue;
      const dx = node.x - cx || 1e-6;
      const dy = node.y - cy || 1e-6;
      const u = dx / rx;
      const v = dy / ry;
      const rho = Math.sqrt(u * u + v * v) || 1e-6;
      const k = ((1 - rho) / rho) * strength * alpha;
      node.vx += dx * k;
      node.vy += dy * k;
    }
  };
  (force as any).initialize = (n: any[]) => {
    simNodes = n;
  };
  return force;
}

// Meridian is the largest node and sits amber at dead center.
const radius = (n: { exposureValue: number; kind?: string }) =>
  n.kind === "CUSTOMER"
    ? 2 + Math.sqrt(n.exposureValue) + 6
    : 2 + Math.sqrt(n.exposureValue);

const GREEN = "#2ED573";
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
function lerpHex(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function endId(x: unknown): string {
  return typeof x === "object" && x !== null ? (x as { id: string }).id : (x as string);
}

export function SupplyGraph() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Import the canvas library client-only via effect so the ref attaches to the
  // real forwardRef component (next/dynamic does not forward the ref reliably).
  const [FG, setFG] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    import("react-force-graph-2d").then((m) => {
      if (alive) setFG(() => m.default);
    });
    return () => {
      alive = false;
    };
  }, []);

  const ready = size.w > 0 && size.h > 0 && !!FG;

  // mutable, per-mount clone so the sim can add x/y and replay can reset
  const data = useMemo(
    () => ({
      nodes: GRAPH.nodes.map((n) => ({ ...n })),
      links: GRAPH.edges.map((e) => ({ ...e })),
    }),
    []
  );

  // sequence display state, read inside canvas paint (refs = no churn)
  const activated = useRef<Set<string>>(new Set());
  const activatedAt = useRef<Map<string, number>>(new Map());
  const centerAmber = useRef(false);
  const traceActive = useRef(false);
  const originFlare = useRef(false);
  const selected = useRef<GraphNode | null>(null);
  const neighborIds = useRef<Set<string>>(new Set());
  const hovered = useRef<Set<string>>(new Set()); // hover-dim (no selection)
  const pinned = useRef<Set<string>>(new Set()); // dragged-and-pinned nodes
  const lastClick = useRef<{ id: string; t: number }>({ id: "", t: 0 });
  const [, force] = useState(0);
  const repaint = useCallback(() => force((n) => n + 1), []);
  const [traceLabel, setTraceLabel] = useState(false);
  // Reveal only after the layout has settled + fit, so there is no visible
  // reflow after first paint (canvas stays invisible while the sim relaxes).
  const [revealed, setRevealed] = useState(false);
  const started = useRef(false); // sequence auto-starts once, post-reveal
  // Click-selected node for the fixed detail panel (Job 1). Kept as state so the
  // HTML overlay re-renders; mirrors the `selected` ref that drives canvas
  // dimming, so both stay in lock-step without disturbing the sequence.
  const [detailNode, setDetailNode] = useState<GraphNode | null>(null);

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

  // Ring-constrain the layout by tier. forceRadial fixes RADIUS but not ANGLE,
  // so we (a) deterministically seed every node evenly around its ring, then
  // (b) hold it there with an elliptical radial force while charge fine-tunes
  // angular spacing and links give a gentle nudge. Rings are ellipses matched to
  // the canvas aspect so a wide frame is filled. Re-applied on resize.
  useEffect(() => {
    if (!FG || !ready) return;
    const id = requestAnimationFrame(() => {
      const fg = fgRef.current;
      if (!fg) return;
      const cx = size.w / 2;
      const cy = size.h / 2;
      // Match ring aspect to the canvas so ellipses fill a wide frame and
      // zoomToFit leaves no side margins.
      const aspect = Math.min(2.4, Math.max(0.6, size.w / size.h));
      const rxOf = (ring: number) => (RING_RY[ring] ?? 0) * aspect;
      const ryOf = (ring: number) => RING_RY[ring] ?? 0;
      const axesOf = (n: any) => {
        const ring = ringOf(n);
        return { rx: rxOf(ring), ry: ryOf(ring) };
      };

      try {
        const nodes = data.nodes as any[];

        // --- deterministic angular seeding: fill each ring evenly so the radial
        // force holds full concentric ellipses instead of collapsing to a fan ---
        const byRing: Record<number, any[]> = { 1: [], 2: [], 3: [] };
        for (const n of nodes) {
          const ring = ringOf(n);
          if (ring >= 1 && ring <= 3) byRing[ring].push(n);
        }
        // Trace nodes (ISO5852SDW BOM, its supplier, Kaohsiung origin) — align
        // onto one straight spoke; index 0 is Meridian (pinned center).
        const traceSet = new Set<string>([
          SCHEDULE.tracePathIds[1],
          SCHEDULE.tracePathIds[2],
          SCHEDULE.tracePathIds[3],
        ]);
        for (const ring of [1, 2, 3] as const) {
          const group = byRing[ring]
            .slice()
            .sort((a, b) => String(a.id).localeCompare(String(b.id)));
          const count = Math.max(1, group.length);
          const base = ring * 0.35; // stagger rings so spokes don't all align
          group.forEach((n, i) => {
            const theta = traceSet.has(n.id)
              ? TRACE_SPOKE_RAD
              : base + (2 * Math.PI * i) / count;
            n.x = cx + rxOf(ring) * Math.cos(theta);
            n.y = cy + ryOf(ring) * Math.sin(theta);
            n.vx = 0;
            n.vy = 0;
          });
        }

        // Pin Meridian (ring 0) dead center. Full symmetric rings make the node
        // bbox center coincide with it, so zoomToFit renders it frame-centered.
        const center = nodes.find((n) => n.kind === "CUSTOMER");
        if (center) {
          center.fx = cx;
          center.fy = cy;
          center.x = cx;
          center.y = cy;
        }

        // Neutralize the default centering force — the elliptical radial force
        // plus the pinned Meridian anchor the layout at the canvas center.
        fg.d3Force("center")?.strength?.(0);

        const charge = fg.d3Force("charge");
        charge?.strength(CHARGE_STRENGTH);
        charge?.distanceMax?.(CHARGE_DISTANCE_MAX);

        const link = fg.d3Force("link");
        link?.distance(LINK_DISTANCE);
        link?.strength?.(LINK_STRENGTH);

        fg.d3Force("radial", ellipticalRadial(cx, cy, axesOf, RADIAL_STRENGTH));

        fg.d3ReheatSimulation?.();
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [FG, ready, size.w, size.h, data]);

  // Safety net: if onEngineStop never fires, fit + reveal once the layout has
  // had time to settle so the canvas can't stay hidden.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      fgRef.current?.zoomToFit?.(0, 40);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setRevealed(true))
      );
    }, 2600);
    return () => window.clearTimeout(t);
  }, [ready]);

  const runSequence = useCallback(() => {
    const timers: number[] = [];
    activated.current = new Set();
    activatedAt.current = new Map();
    centerAmber.current = false;
    traceActive.current = false;
    originFlare.current = false;
    setTraceLabel(false);
    repaint();

    timers.push(
      window.setTimeout(() => {
        originFlare.current = true;
        activated.current.add(SCHEDULE.originId);
        activatedAt.current.set(SCHEDULE.originId, performance.now());
        repaint();
      }, SCHEDULE.originFlareMs)
    );
    for (const a of SCHEDULE.activations) {
      timers.push(
        window.setTimeout(() => {
          activated.current.add(a.id);
          activatedAt.current.set(a.id, performance.now());
          repaint();
        }, a.atMs)
      );
    }
    timers.push(
      window.setTimeout(() => {
        centerAmber.current = true;
        repaint();
      }, SCHEDULE.centerAmberMs)
    );
    timers.push(
      window.setTimeout(() => {
        traceActive.current = true;
        setTraceLabel(true);
        repaint();
      }, SCHEDULE.traceAtMs)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [repaint]);

  // Auto-run the contamination sequence ONCE, only after reveal, so every
  // activation is actually seen (not played to a hidden canvas).
  useEffect(() => {
    if (!revealed || started.current) return;
    started.current = true;
    const cleanup = runSequence();
    return cleanup;
  }, [revealed, runSequence]);

  // Anchor the TIER-2 EXPOSURE label to the middle of the cyan trace (the span
  // between the ISO5852SDW BOM node and its supplier) rather than floating it at
  // the top. Tracks live node positions and the canvas zoom transform so it
  // stays pinned to the path through settling, replay, pan, and zoom.
  useEffect(() => {
    const el = labelRef.current;
    if (!traceLabel) {
      if (el) el.style.opacity = "0";
      return;
    }
    // tracePathIds = [Meridian, G-BOM-07 (ISO5852SDW), supplier, Kaohsiung origin]
    const midIds = [SCHEDULE.tracePathIds[1], SCHEDULE.tracePathIds[2]];
    let raf = 0;
    const tick = () => {
      const fg = fgRef.current;
      const node = labelRef.current;
      if (fg && node && typeof fg.graph2ScreenCoords === "function") {
        const pts = (midIds
          .map((id) => (data.nodes as any[]).find((n) => n.id === id))
          .filter(
            (n) => n && typeof n.x === "number" && typeof n.y === "number"
          )) as Array<{ x: number; y: number }>;
        if (pts.length) {
          const ax = pts.reduce((s, n) => s + n.x, 0) / pts.length;
          const ay = pts.reduce((s, n) => s + n.y, 0) / pts.length;
          const p = fg.graph2ScreenCoords(ax, ay);
          node.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y - 12}px)`;
          node.style.opacity = "1";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [traceLabel, data]);

  // Fit instantly, then reveal on a LATER frame so the fitted transform is
  // actually painted before the fade-in starts (revealing in the same tick can
  // flash one unfitted frame). Two rAFs = the canvas has painted the fit.
  const fitThenReveal = useCallback(() => {
    fgRef.current?.zoomToFit?.(0, 40);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setRevealed(true))
    );
  }, []);

  const handleEngineStop = useCallback(() => {
    // Layout is final here — fit, then reveal (no post-paint reflow).
    fitThenReveal();
  }, [fitThenReveal]);

  // 200ms green→status fade on activation (DESIGN §5 node status change).
  const displayColor = (n: GraphNode): string => {
    if (n.kind === "CUSTOMER") return "#FFB020";
    const at = activatedAt.current.get(n.id);
    if (at === undefined) return GREEN;
    const target =
      n.provenance === "MODELED"
        ? "#A78BFA" // violet stays reserved
        : n.status === "AT_RISK"
        ? "#FF8C42"
        : "#FF4757"; // red / exposed
    const t = easeOutCubic(Math.min(1, (performance.now() - at) / 200));
    return lerpHex(GREEN, target, t);
  };

  // Dim rule: selection takes priority; else hover dims everything not adjacent
  // to the hovered node; else nothing dims.
  const isDimmed = (id: string): boolean => {
    if (selected.current !== null) {
      return id !== selected.current.id && !neighborIds.current.has(id);
    }
    if (hovered.current.size > 0) return !hovered.current.has(id);
    return false;
  };

  // A link is dimmed unless BOTH endpoints are in the active (selected/hover)
  // set — so only edges incident to the focus node stay lit.
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

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, scale: number) => {
      const r = radius(node);
      const dim = isDimmed(node.id);
      ctx.globalAlpha = dim ? 0.15 : 1;

      if (node.id === SCHEDULE.originId && originFlare.current) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = "#FF4757";
        ctx.globalAlpha = dim ? 0.1 : 0.5;
        ctx.lineWidth = 1 / scale;
        ctx.stroke();
        ctx.globalAlpha = dim ? 0.15 : 1;
      }
      if (node.kind === "CUSTOMER" && centerAmber.current) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = "#FFB020";
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = displayColor(node);
      ctx.fill();

      // pin cue for dragged-and-pinned nodes (amber ring)
      if (pinned.current.has(node.id) && node.kind !== "CUSTOMER") {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255,176,32,0.75)";
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([2 / scale, 2 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    },
    []
  );

  const isTrace = (l: any) =>
    traceActive.current && TRACE_LINKS.has(pairKey(endId(l.source), endId(l.target)));

  const linkColor = (l: any): string => {
    if (isTrace(l)) return "#00D9FF";
    if (linkDimmed(l)) return "rgba(120,130,150,0.07)";
    return l.provenance === "MODELED" ? "rgba(167,139,250,0.5)" : "#2A303D";
  };
  const linkWidth = (l: any): number => (isTrace(l) ? 2 : 1);
  const linkDash = (l: any): number[] | null => (l.provenance === "MODELED" ? [2, 2] : null);
  const linkParticles = (l: any): number => (isTrace(l) ? 4 : 0);

  const neighborsOf = useCallback(
    (id: string) => {
      const ids = new Set<string>([id]);
      (data.links as any[]).forEach((l) => {
        const s = endId(l.source);
        const t = endId(l.target);
        if (s === id) ids.add(t);
        if (t === id) ids.add(s);
      });
      return ids;
    },
    [data]
  );

  const onNodeClick = useCallback(
    (node: any) => {
      // Double-click a pinned/dragged node to unpin it (Meridian stays pinned).
      const now = performance.now();
      const isDouble =
        lastClick.current.id === node.id && now - lastClick.current.t < 350;
      lastClick.current = { id: node.id, t: now };
      if (isDouble && node.kind !== "CUSTOMER") {
        node.fx = undefined;
        node.fy = undefined;
        pinned.current.delete(node.id);
        clearSelection();
        fgRef.current?.d3ReheatSimulation?.();
        return;
      }

      // Toggle: clicking the selected node again closes the panel + un-dims.
      if (selected.current?.id === node.id) {
        clearSelection();
        return;
      }
      selected.current = node;
      neighborIds.current = neighborsOf(node.id);
      setDetailNode(node as GraphNode);
      repaint();
    },
    [neighborsOf, repaint, clearSelection]
  );

  // Hover dims everything not adjacent to the hovered node (when nothing is
  // click-selected). Cleared on hover-out.
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

  // Dragged nodes pin where dropped (double-click unpins). Meridian is already
  // pinned at centre; re-pinning it after a drag is harmless.
  const onNodeDragEnd = useCallback(
    (node: any) => {
      node.fx = node.x;
      node.fy = node.y;
      pinned.current.add(node.id);
      repaint();
    },
    [repaint]
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[var(--bg-base)]">
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
            nodeRelSize={4}
            nodeCanvasObject={nodeCanvasObject}
            // Pointer/drag hit area = the node's DRAWN radius (not the 4px
            // default), so the whole visible node is grabbable — this is what
            // makes dragging actually work.
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius(node) + 2, 0, 2 * Math.PI);
              ctx.fill();
            }}
            enableNodeDrag={true}
            linkLabel={(l: any) =>
              l.provenance === "MODELED"
                ? "MODELED — inferred from industry structure, not per-part observed. Converts to OBSERVED as network coverage grows."
                : "OBSERVED — verified from supplier documentation, import records, and manufacturer disclosures."
            }
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkLineDash={linkDash}
            linkDirectionalParticles={linkParticles}
            linkDirectionalParticleColor={() => "#00D9FF"}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.006}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onNodeDragEnd={onNodeDragEnd}
            onBackgroundClick={clearSelection}
            cooldownTime={1800}
            onEngineStop={handleEngineStop}
            d3VelocityDecay={0.32}
          />
        </div>
      ) : null}

      <div
        ref={labelRef}
        style={{ opacity: 0, transform: "translate(-9999px,-9999px)" }}
        className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap border border-[color-mix(in_srgb,var(--cyan)_40%,transparent)] bg-[color-mix(in_srgb,var(--bg-base)_85%,transparent)] px-2 py-1 text-[10px] leading-none tracking-[0.08em] text-[var(--cyan)] transition-opacity duration-200"
      >
        {SCHEDULE.traceLabel}
      </div>

      {/* persistent caption naming the cyan trace (appears with the trace) */}
      <div
        className="pointer-events-none absolute left-2 top-2 z-10 max-w-[min(70%,520px)] border border-[color-mix(in_srgb,var(--cyan)_40%,transparent)] bg-[color-mix(in_srgb,var(--bg-base)_85%,transparent)] px-2 py-1 text-[9px] leading-tight tracking-[0.06em] text-[var(--cyan)] transition-opacity duration-300"
        style={{ opacity: traceLabel ? 1 : 0 }}
      >
        {TRACE_CAPTION}
      </div>

      <GraphStats />

      <NodeDetailPanel
        detail={detailNode ? nodeDetailFromGraphNode(detailNode) : null}
        onClose={clearSelection}
      />

      <button
        type="button"
        onClick={runSequence}
        className="absolute bottom-2 right-2 z-10 flex items-center gap-1 text-[10px] tracking-[0.08em] text-[var(--text-lo)] transition-colors hover:text-[var(--amber)]"
      >
        <span aria-hidden>↻</span> REPLAY
      </button>
    </div>
  );
}
