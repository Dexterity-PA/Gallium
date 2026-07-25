"use client";

import { useEffect, useMemo, useState } from "react";
import { FEED_EVENTS } from "@/lib/data/event";
import { CUSTOMER } from "@/lib/data/customer";
import { useDemoClock, formatClock } from "@/lib/hooks/useDemoClock";
import { EventFeed, type FeedRow } from "@/components/radar/EventFeed";
import { WorldMap, type MapFocusRequest } from "@/components/radar/WorldMap";
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
        label="Global Shipping — Live"
        corner="CYL · 102W–136E"
        className="h-full"
        noPad
        bodyClassName="overflow-hidden"
      >
        <WorldMap focus={focus} />
      </Panel>

      <Panel
        label={`Impact — ${CUSTOMER.focusProduct.line}`}
        corner="Q4 2026"
        className="h-full"
        noPad
        bodyClassName="overflow-auto"
      >
        <ImpactSummary active={impactActive} />
      </Panel>
    </div>
  );
}
