"use client";

import { useDemoClock, formatClock } from "@/lib/hooks/useDemoClock";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { useDemoState } from "@/lib/hooks/useDemoState";
import { CUSTOMER } from "@/lib/data/customer";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// Thin vertical hairline divider between segments (DESIGN.md: separators are
// 1px rules, not pipe characters).
function Div() {
  return <div className="h-full w-px shrink-0 bg-rule" />;
}

export function StatusBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { clockMs, observed, modeled } = useDemoClock();
  const { reset } = useDemoState();
  // +1 increments tween rather than snap (DESIGN.md §5, 180ms).
  const observedAnim = useCountUp(observed, { duration: 180, from: observed });

  return (
    // One accent only: --ok on the LIVE indicator, plus --modeled where it is
    // reserved to mean modeled. The wordmark and values carry weight and
    // --text-primary instead of a colour, so the bar does not compete with
    // whichever screen is mounted below it.
    <header
      className="flex select-none items-stretch border-b border-rule bg-panel text-label"
      style={{ height: "var(--h-statusbar)" }}
    >
      <div className="label flex items-center px-4 font-bold text-primary">
        GALLIUM
      </div>
      <Div />
      <div className="label flex items-center px-3 text-primary">
        {CUSTOMER.name.toUpperCase()}
      </div>
      <Div />
      <div className="flex items-center gap-1 px-3 text-ok">
        <span className="anim-live leading-none" aria-hidden>
          ●
        </span>
        <span className="label text-ok">LIVE</span>
      </div>
      <Div />
      <div className="flex items-center px-3 tabular-nums text-primary">
        {formatClock(clockMs)}
        <span className="label ml-1">UTC</span>
      </div>
      <Div />
      <div className="flex items-center gap-2 px-3 tabular-nums">
        <span className="label">OBSERVED</span>
        <span className="text-primary">{fmt(Math.round(observedAnim))}</span>
        <span className="text-dim">/</span>
        <span className="label">MODELED</span>
        {/* --modeled is reserved for modeled/inferred data (tokens.css RULE 2) */}
        <span className="text-modeled">{fmt(modeled)}</span>
      </div>

      <div className="flex-1" />

      <Div />
      <button
        type="button"
        onClick={reset}
        title="Reset demo: clear loaded BOM and return to entry"
        className="label flex items-center gap-1 px-3 transition-colors hover:text-primary"
        aria-label="Reset demo: clear loaded BOM and return to entry"
      >
        <span aria-hidden>↺</span>
        <span>RESET</span>
      </button>
      <Div />
      <button
        type="button"
        onClick={onOpenPalette}
        className="label flex items-center gap-1 px-3 transition-colors hover:text-primary"
        aria-label="Open command palette"
      >
        <span aria-hidden>⌘</span>
        <span>K</span>
      </button>
    </header>
  );
}
