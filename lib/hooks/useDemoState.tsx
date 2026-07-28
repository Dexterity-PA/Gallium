"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { LoadedSummary, ResolutionSummary } from "@/lib/uploadResolution";
import { toLoadedSummary } from "@/lib/uploadResolution";

// Whether a BOM has been "loaded" (sample or uploaded). The gate between the
// entry/resolution flow and the real dashboard (see AppShell). Backed by
// localStorage rather than a real backend, so:
//   - the dashboard survives a hard reload once loaded
//   - RESET can clear it and bounce back to "/app" without a full page reload
// `hydrated` distinguishes "we don't know yet" (first paint, before the
// client can read localStorage) from "known to be false". AppShell needs
// that distinction to avoid flashing the wrong thing.

const STORAGE_KEY = "gallium.demoState.v1";

interface StoredState {
  loaded: boolean;
  summary: LoadedSummary | null;
}

const DEFAULT_STATE: StoredState = { loaded: false, summary: null };

interface DemoStateValue extends StoredState {
  hydrated: boolean;
  markLoaded: (summary: ResolutionSummary) => void;
  reset: () => void;
}

const DemoStateContext = createContext<DemoStateValue>({
  ...DEFAULT_STATE,
  hydrated: false,
  markLoaded: () => {},
  reset: () => {},
});

export function DemoStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as StoredState);
    } catch {
      // corrupt or unavailable storage: fall back to the entry screen
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: StoredState) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort only; in-memory state still updates
    }
  }, []);

  const markLoaded = useCallback(
    (summary: ResolutionSummary) => persist({ loaded: true, summary: toLoadedSummary(summary) }),
    [persist]
  );

  const reset = useCallback(() => persist(DEFAULT_STATE), [persist]);

  return (
    <DemoStateContext.Provider value={{ ...state, hydrated, markLoaded, reset }}>
      {children}
    </DemoStateContext.Provider>
  );
}

export function useDemoState(): DemoStateValue {
  return useContext(DemoStateContext);
}
