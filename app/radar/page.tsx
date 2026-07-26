"use client";

import { useEffect, useMemo, useState } from "react";
import { FEED_EVENTS } from "@/lib/data/event";
import { CUSTOMER } from "@/lib/data/customer";
import { useDemoClock, formatClock } from "@/lib/hooks/useDemoClock";
import { EventFeed, type FeedRow } from "@/components/radar/EventFeed";
import { WorldMap, MAP_WINDOW, type MapFocusRequest } from "@/components/radar/WorldMap";
import { ImpactSummary } from "@/components/radar/ImpactSummary";
import { Panel } from "@/components/ui/Panel";

const keyOf = (t: string, head: string) => `${t}|${head}`;

// Map an event to the map site it flies to. Keyword-matched on the headline;
// compliance / macro rows with no geographic node return null (no fly).
function eventSiteId(head: string): string | null {
  const h = head.toUpperCase();
  if (h.includes("HSINCHU") || h.includes("FAB UTIL")) return "NODE-HSC";
  if (h.includes("TW ROUTES") || h.includes("TAIPEI") || h.includes("TPE")) return "NODE-TPE";
  if (
    h.includes("KAOHSIUNG") ||
    h.includes("SUBSTRATE") ||
    h.includes("OPTOCOUPLER") ||
    h.includes("DISCRETE")
  )
    return "NODE-KHH-ASE";
  return null;
}
const PREEXISTING = FEED_EVENTS.filter((e) => e.arrivesAtMs === undefined);
const TIMED = FEED_EVENTS.filter((e) => e.arrivesAtMs !== undefined).sort(
  (a, b) => (a.arrivesAtMs ?? 0) - (b.arrivesAtMs ?? 0)
);

export default function RadarPage() {
  const { clockMs } = useDemoClock();
  const [arrived, setArrived] = useState(0);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocusRequest | null>(null);
  // BOM line id currently isolated on the map ("BOM-07"), or null. Lives here
  // because it flows from the Impact panel (where a part row is clicked) to
  // the map (where the path is drawn); clicking the same row again clears it.
  const [isolatedPart, setIsolatedPart] = useState<string | null>(null);

  // Scripted arrivals at 3.2s / 5.6s / 8.0s (DATA.md §2). Deterministic offsets.
  useEffect(() => {
    const timers: number[] = [];
    TIMED.forEach((ev, i) => {
      timers.push(
        window.setTimeout(() => {
          setArrived(i + 1);
          setFlashKey(keyOf(ev.t, ev.head));
          timers.push(window.setTimeout(() => setFlashKey(null), 450));
        }, ev.arrivesAtMs)
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const rows: FeedRow[] = useMemo(() => {
    const visible = [...PREEXISTING, ...TIMED.slice(0, arrived)];
    return [...visible]
      .reverse()
      .map((e) => ({ ...e, key: keyOf(e.t, e.head) }));
  }, [arrived]);

  const impactActive = arrived >= TIMED.length;

  return (
    <div
      className="grid h-full min-h-0"
      style={{
        gridTemplateColumns: "380px 1fr 320px",
        gap: "1px",
        background: "var(--rule)",
      }}
    >
      <Panel label="Event Feed" corner={`${formatClock(clockMs)} UTC`} className="h-full" noPad>
        <EventFeed
          events={rows}
          flashKey={flashKey}
          onEventClick={(ev) => {
            const siteId = eventSiteId(ev.head);
            if (siteId) setFocus({ siteId, nonce: Date.now() });
          }}
        />
      </Panel>

      <Panel
        label="Global Shipping · Live"
        // Derived from the projection, not typed here: the crop widens whenever
        // the network gains a node outside it, and a hardcoded corner label
        // would go on claiming the old window.
        corner={MAP_WINDOW.label}
        className="h-full"
        noPad
        bodyClassName="overflow-hidden"
      >
        <WorldMap focus={focus} isolate={isolatedPart} />
      </Panel>

      <Panel
        label={`Impact · ${CUSTOMER.focusProduct.line}`}
        corner="Q4 2026"
        className="h-full"
        noPad
        bodyClassName="overflow-auto"
      >
        <ImpactSummary
          active={impactActive}
          isolatedPart={isolatedPart}
          onSelectPart={(bomId) => setIsolatedPart((cur) => (cur === bomId ? null : bomId))}
        />
      </Panel>
    </div>
  );
}
