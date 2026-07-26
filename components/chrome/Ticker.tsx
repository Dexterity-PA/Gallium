"use client";

import { useMemo } from "react";
import { TICKER_ITEMS } from "@/lib/data/ticker";
import type { TickerItem } from "@/lib/types";
import { useDemoClock } from "@/lib/hooks/useDemoClock";
import { mulberry32 } from "@/lib/rng";
import { DEMO_SEED } from "@/lib/demo";

// Small seeded random walk on the numeric part of a value, preserving unit
// text and decimal precision so the ticker "breathes" without layout jitter.
function walk(value: string, seed: number): string {
  const m = value.match(/-?\d+(?:\.\d+)?/);
  if (!m) return value;
  const raw = m[0];
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  const rand = mulberry32(seed);
  const step = decimals > 0 ? Math.pow(10, -decimals) : 1;
  const move = (rand() < 0.45 ? -1 : rand() < 0.55 ? 0 : 1) * step;
  const next = parseFloat(raw) + move;
  return value.replace(raw, next.toFixed(decimals));
}

function Item({ item, i, tick }: { item: TickerItem; i: number; tick: number }) {
  const value = item.critical ? item.value : walk(item.value, DEMO_SEED ^ (i * 2654435761) ^ tick);
  const up = item.dir === "up";
  const flat = item.dir === "flat";
  // Two semantics only, and they are the two the ticker is about
  // (tokens.css RULE 4): --critical for a move against us, --ok for one
  // in our favour. A flat row is neither, so it gets the plain secondary
  // text colour and no arrow (RULE 1: no fourth text colour, no semantic
  // one either, for a level that hasn't moved).
  const color = flat ? "var(--text-secondary)" : item.critical || up ? "var(--critical)" : "var(--ok)";
  return (
    <span className="inline-flex items-center gap-1 px-4">
      <span className="label">{item.label}</span>
      <span className="tabular-nums" style={{ color }}>
        {value}
      </span>
      {flat ? null : (
        <span aria-hidden style={{ color }}>
          {up ? "▲" : "▼"}
        </span>
      )}
      {item.delta ? (
        <span className="tabular-nums" style={{ color }}>
          {item.delta}
        </span>
      ) : null}
      <span className="pl-2 text-rule-strong" aria-hidden>
        ·
      </span>
    </span>
  );
}

export function Ticker() {
  const { tickerTick } = useDemoClock();

  // Duplicate the sequence so the -50% translate loops seamlessly.
  const items = useMemo(() => [...TICKER_ITEMS, ...TICKER_ITEMS], []);

  return (
    <footer
      className="flex items-center overflow-hidden border-t border-rule bg-panel text-label"
      style={{ height: "var(--h-ticker)" }}
    >
      <div
        className="flex shrink-0 items-center whitespace-nowrap"
        style={{ animation: "ticker-scroll 40s linear infinite" }}
      >
        {items.map((item, i) => (
          <Item key={i} item={item} i={i % TICKER_ITEMS.length} tick={tickerTick} />
        ))}
      </div>
    </footer>
  );
}
