"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { DEMO_EPOCH_MS } from "@/lib/demo";
import { COUNTERS } from "@/lib/data/counters";

// The tick engine (BRIEF "Tick engine"). One provider drives all live motion.
// The clock starts at a FIXED epoch and advances one second per real second,
// so cadence is live but values are deterministic across takes.

export interface DemoClockState {
  clockMs: number; // display clock (UTC), starts at DEMO_EPOCH_MS
  elapsedMs: number; // real ms since mount (for scripted arrivals)
  observed: number; // +1 every 20s
  modeled: number; // constant during the demo
  tickerTick: number; // floor(elapsed / 4s) — drives seeded ticker walk
  leadTick: number; // floor(elapsed / 12s) — drives lead-time bumps
}

const INITIAL: DemoClockState = {
  clockMs: DEMO_EPOCH_MS,
  elapsedMs: 0,
  observed: COUNTERS.observed,
  modeled: COUNTERS.modeled,
  tickerTick: 0,
  leadTick: 0,
};

const DemoClockContext = createContext<DemoClockState>(INITIAL);

export function useDemoClock(): DemoClockState {
  return useContext(DemoClockContext);
}

export function useDemoClockProvider(): DemoClockState {
  const [state, setState] = useState<DemoClockState>(INITIAL);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = performance.now();
    const id = window.setInterval(() => {
      const elapsed = performance.now() - (startRef.current ?? 0);
      const sec = Math.round(elapsed / 1000);
      setState((prev) => {
        const next: DemoClockState = {
          clockMs: DEMO_EPOCH_MS + sec * 1000,
          elapsedMs: elapsed,
          observed: COUNTERS.observed + Math.floor(sec / 20),
          modeled: COUNTERS.modeled,
          tickerTick: Math.floor(sec / 4),
          leadTick: Math.floor(sec / 12),
        };
        // Avoid re-render churn when nothing meaningful changed.
        if (
          next.clockMs === prev.clockMs &&
          next.observed === prev.observed &&
          next.tickerTick === prev.tickerTick &&
          next.leadTick === prev.leadTick
        ) {
          return prev;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return state;
}

export { DemoClockContext };

// UTC HH:MM:SS formatter for the status bar.
export function formatClock(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
