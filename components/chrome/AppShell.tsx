"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DemoClockContext,
  useDemoClockProvider,
} from "@/lib/hooks/useDemoClock";
import { useDemoState } from "@/lib/hooks/useDemoState";
import { StatusBar } from "@/components/chrome/StatusBar";
import { NavRail } from "@/components/chrome/NavRail";
import { Ticker } from "@/components/chrome/Ticker";
import { ProvenanceBadge } from "@/components/chrome/ProvenanceBadge";
import { CommandPalette } from "@/components/chrome/CommandPalette";

// The fixed instrument panel (DESIGN.md §4). 100vh, no page scroll; the three
// chrome bands never scroll away. 1px hairlines separate every region.
//
// Chrome gating: the entry/resolution flow lives at "/" and must render with
// NO dashboard chrome at all — no LIVE badge, no ticker, no OBSERVED/MODELED
// counters (see AGENTS brief). Every other route keeps the exact chrome below,
// unchanged, but only once a BOM is "loaded" (sample or uploaded) — a direct
// or stale visit to a dashboard route before that bounces back to "/"
// client-side, no full reload. `useDemoState` is the localStorage-backed
// flag; `hydrated` avoids flashing the wrong thing before the client can
// read it.
export function AppShell({ children }: { children: React.ReactNode }) {
  const clock = useDemoClockProvider();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { loaded, hydrated } = useDemoState();
  const isEntryRoute = pathname === "/";

  const togglePalette = useCallback(() => setPaletteOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePalette]);

  // Gate: once we actually know the loaded state, send unloaded visits to
  // any dashboard route back to the entry screen.
  useEffect(() => {
    if (hydrated && !loaded && !isEntryRoute) {
      router.replace("/");
    }
  }, [hydrated, loaded, isEntryRoute, router]);

  // Entry/resolution screen: bare, none of the instrument-panel chrome.
  if (isEntryRoute) {
    return <>{children}</>;
  }

  // Not yet confirmed loaded (first paint before hydration, or mid-redirect
  // after a reset / stale direct nav) — render nothing rather than flash the
  // full dashboard chrome.
  if (!hydrated || !loaded) {
    return null;
  }

  return (
    <DemoClockContext.Provider value={clock}>
      <div
        className="grid h-full w-full overflow-hidden bg-base"
        style={{
          gridTemplateRows: "var(--h-statusbar) 1fr var(--h-ticker)",
        }}
      >
        <StatusBar onOpenPalette={togglePalette} />

        <div
          className="grid min-h-0"
          style={{ gridTemplateColumns: "var(--w-navrail) 1fr" }}
        >
          <NavRail />
          <main className="relative min-h-0 min-w-0 overflow-hidden border-l border-rule">
            {children}
          </main>
        </div>

        <Ticker />
      </div>

      <ProvenanceBadge />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </DemoClockContext.Provider>
  );
}
