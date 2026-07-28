"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/components/site/motion/useReducedMotionSafe";
import type { HeroMapGeo } from "./laneGeometry";

// The hero's backdrop: the whole Meridian network, dim, with one animated
// story in it. The loop is autonomous (rAF against its own clock, never
// coupled to scroll, so it can never desync):
//
//   0.0s   marker docked at the Port of Kaohsiung, holding (page load lands
//          mid-hold on purpose: the first painted frame IS the story frame)
//   22.5s  fade out, brief idle
//   26.5s  fade in at Chicago inbound and trace the freight route UPSTREAM,
//          the direction the exposure analysis runs, back across the Pacific
//   38.5s  dock at Kaohsiung, hold with a slow pulse ... loop (40s period)
//
// A paused frame at any point in the hold reads as blocked freight, which is
// the honest state of the sample scenario. Transform and opacity only: the
// marker moves via translate, the pulse and the dock ping are opacity plus
// scale. Below 768px, and under prefers-reduced-motion at any width, the
// loop never starts and the static frame renders with the marker already
// docked at Kaohsiung.

const PERIOD = 40; // seconds, total loop
const FADE_IN = 1.2; // fade up at Chicago
const TRAVEL_END = 13.2; // docked from here (in loop-local time)
const HOLD_END = 35.5; // fade out from here
const FADE_OUT = 2.0;
const PULSE_PERIOD = 4.2; // opacity breathing while docked
const BASE_ALPHA = 0.9;
const START_OFFSET = TRAVEL_END + 9; // first paint lands mid-hold

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function HeroMap({ geo }: { geo: HeroMapGeo }) {
  const reduced = useReducedMotionSafe();
  // Below 768px the static frame renders instead: no animation cost on
  // mobile CPUs. Defaults true (static) so the first client frame on a
  // small screen never runs a spurious animation tick.
  const [small, setSmall] = useState(true);
  const markerRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setSmall(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const animate = !reduced && !small;

  // Cumulative arc length over the route polyline, so travel speed follows
  // distance rather than sample density.
  const cum = useMemo(() => {
    const out = new Float64Array(geo.route.length);
    for (let i = 1; i < geo.route.length; i++) {
      const [ax, ay] = geo.route[i - 1];
      const [bx, by] = geo.route[i];
      out[i] = out[i - 1] + Math.hypot(bx - ax, by - ay);
    }
    return out;
  }, [geo.route]);

  useEffect(() => {
    const el = markerRef.current;
    if (!el) return;
    const [dx, dy] = geo.dock;
    if (!animate) {
      el.setAttribute("transform", `translate(${dx} ${dy})`);
      el.setAttribute("opacity", String(BASE_ALPHA));
      return;
    }
    const total = cum[cum.length - 1];
    const start = performance.now() - START_OFFSET * 1000;
    let raf = 0;
    const tick = (now: number) => {
      const t = ((now - start) / 1000) % PERIOD;
      let x = dx;
      let y = dy;
      let opacity = 0;
      if (t < FADE_IN) {
        [x, y] = geo.route[0];
        opacity = (t / FADE_IN) * BASE_ALPHA;
      } else if (t < TRAVEL_END) {
        const u = easeInOut((t - FADE_IN) / (TRAVEL_END - FADE_IN));
        const target = u * total;
        // binary search the cumulative table
        let lo = 0;
        let hi = cum.length - 1;
        while (lo + 1 < hi) {
          const mid = (lo + hi) >> 1;
          if (cum[mid] <= target) lo = mid;
          else hi = mid;
        }
        const span = cum[hi] - cum[lo] || 1;
        const f = (target - cum[lo]) / span;
        const [ax, ay] = geo.route[lo];
        const [bx, by] = geo.route[hi];
        x = ax + (bx - ax) * f;
        y = ay + (by - ay) * f;
        opacity = BASE_ALPHA;
      } else if (t < HOLD_END) {
        // docked and holding: slow breathing between 0.55 and 0.9
        const p = (t - TRAVEL_END) / PULSE_PERIOD;
        opacity = 0.725 + 0.175 * Math.cos(2 * Math.PI * p);
      } else if (t < HOLD_END + FADE_OUT) {
        opacity = BASE_ALPHA * (1 - (t - HOLD_END) / FADE_OUT);
      }
      el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      el.setAttribute("opacity", opacity.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, cum, geo.route, geo.dock]);

  const [dockX, dockY] = geo.dock;

  return (
    <svg
      viewBox={`0 0 ${geo.w} ${geo.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      {animate && (
        <style>{`
          @keyframes galliumHeroPing {
            0% { transform: scale(0.4); opacity: 0.5; }
            70% { transform: scale(2.6); opacity: 0; }
            100% { transform: scale(2.6); opacity: 0; }
          }
        `}</style>
      )}

      {/* land, at texture weight */}
      <path d={geo.landD} fill="rgba(230, 227, 220, 0.05)" stroke="none" />

      {/* the whole network, dim: this is context, not the story */}
      <path
        d={geo.contextD}
        fill="none"
        stroke="rgba(230, 227, 220, 0.09)"
        strokeWidth={0.75}
        vectorEffect="non-scaling-stroke"
      />

      {/* quarantine zone over the Taiwan Strait */}
      <path
        d={geo.quarantineD}
        fill="rgba(194, 160, 90, 0.05)"
        stroke="rgba(194, 160, 90, 0.32)"
        strokeWidth={1}
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />

      {/* the freight lane: drawn dashed, the route the held freight is not
          flying. The single site accent is the only colour on the map. */}
      <path
        d={geo.freightD}
        fill="none"
        stroke="rgba(194, 160, 90, 0.42)"
        strokeWidth={1.25}
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
      />

      {/* nodes */}
      {geo.nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={geo.nodeR[n.tier]}
          fill={
            n.tier === "context"
              ? "rgba(230, 227, 220, 0.2)"
              : n.tier === "customer"
              ? "rgba(230, 227, 220, 0.55)"
              : "rgba(194, 160, 90, 0.6)"
          }
        />
      ))}

      {/* dock ping at the Port of Kaohsiung: animated while the loop runs,
          a static held ring otherwise */}
      {animate ? (
        <circle
          cx={dockX}
          cy={dockY}
          r={3}
          fill="none"
          stroke="rgba(194, 160, 90, 0.55)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: "galliumHeroPing 4.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
          }}
        />
      ) : (
        <circle
          cx={dockX}
          cy={dockY}
          r={4}
          fill="none"
          stroke="rgba(194, 160, 90, 0.35)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* the freight marker; rAF drives transform and opacity only.
          Server render = docked, the static frame. */}
      <g ref={markerRef} transform={`translate(${dockX} ${dockY})`} opacity={BASE_ALPHA}>
        <circle r={2.4} fill="rgba(194, 160, 90, 0.9)" />
      </g>

      {/* two labels name the story; site data, not copy. Hidden below md,
          where the band is too small for 3px type. */}
      {geo.labels.map((l) => (
        <text
          key={l.text}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          className="hidden md:inline"
          style={{
            fontFamily: "var(--site-font-mono)",
            fontSize: 6.5,
            letterSpacing: "0.08em",
            fill: "rgba(230, 227, 220, 0.38)",
          }}
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}
