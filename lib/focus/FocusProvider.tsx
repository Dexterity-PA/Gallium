"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { BomLine } from "@/lib/types";
import { FOCUS_PARAM, resolveFocusValue } from "./resolve";

// App-level focused-part state, built the same way as ScenarioProvider
// (lib/hooks/useScenario.tsx): one context mounted in app/app/layout.tsx, so a
// part focused on RADAR is still focused on EXPOSURE or GRAPH. The value is
// always a resolved BomLine object, never a bare id string, so consumers
// cannot each re-resolve it differently and disagree.
//
// URL contract: ?focus=MPN is the durable representation. Deep links and
// hard reloads restore focus from it; setFocusedPart / clearFocus rewrite it
// in place (history.replaceState, which the Next.js router integrates with,
// so useSearchParams elsewhere stays in sync). Client-side nav through bare
// hrefs drops the param; the context state survives regardless and the sync
// below quietly re-appends the param so the address bar stays shareable.
// An unresolvable ?focus= value means no focus: no crash, no fuzzy rescue.
//
// Deliberately NOT persisted (same reasoning as the scenario control): a
// fresh load without ?focus= always starts unfocused, the frame the demo
// recording resets to.

interface FocusValue {
  focusedPart: BomLine | null;
  setFocusedPart: (line: BomLine) => void;
  clearFocus: () => void;
}

const FocusContext = createContext<FocusValue>({
  focusedPart: null,
  setFocusedPart: () => {},
  clearFocus: () => {},
});

// Rewrite the current URL's ?focus= in place. replaceState, not push: focus
// changes must not stack history entries under the back button.
function writeFocusParam(mpn: string | null) {
  const url = new URL(window.location.href);
  if (mpn) url.searchParams.set(FOCUS_PARAM, mpn);
  else url.searchParams.delete(FOCUS_PARAM);
  window.history.replaceState(null, "", url.toString());
}

// The only useSearchParams consumer in the provider, isolated in its own
// component behind Suspense so a production prerender CSR-bails this null
// renderer alone, not the whole app tree (next docs: use-search-params,
// "Prerendering").
function FocusUrlSync({
  focusedRef,
  apply,
}: {
  focusedRef: React.RefObject<BomLine | null>;
  apply: (line: BomLine | null) => void;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const raw = params.get(FOCUS_PARAM);
  const prevPathname = useRef<string | null>(null);

  // Keyed on the URL (raw + pathname), never on the focused part itself:
  // state changes write the URL directly in setFocusedPart/clearFocus, and
  // re-running this effect on state change would fight them. The ref gives
  // the effect the current part without making it a dependency.
  useEffect(() => {
    const navigated = pathname !== prevPathname.current;
    prevPathname.current = pathname;
    const current = focusedRef.current;
    if (raw === null) {
      // Re-append the param ONLY when an actual route change dropped it
      // (nav links are bare hrefs; state is the survivor). A missing param
      // on the same route is this provider's own clearFocus write and must
      // not be fought, even if the router ever batches that write's params
      // update into the same commit as the state change.
      if (navigated && current) writeFocusParam(current.mpn);
      return;
    }
    const line = resolveFocusValue(raw);
    if (!line) {
      // Unknown MPN in the URL: report the miss by focusing nothing.
      if (current) apply(null);
      return;
    }
    if (line.id !== current?.id) apply(line);
  }, [raw, pathname, focusedRef, apply]);

  return null;
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focusedPart, setFocused] = useState<BomLine | null>(null);
  const focusedRef = useRef<BomLine | null>(null);
  // Kept in an effect (not during render) per react-hooks/refs. Parent
  // effects run after child effects, but FocusUrlSync only reads the ref
  // when the URL changes, which is always a later commit than the state
  // change that this effect records.
  useEffect(() => {
    focusedRef.current = focusedPart;
  }, [focusedPart]);

  const setFocusedPart = useCallback((line: BomLine) => {
    setFocused(line);
    writeFocusParam(line.mpn);
  }, []);

  const clearFocus = useCallback(() => {
    setFocused(null);
    writeFocusParam(null);
  }, []);

  const value = useMemo<FocusValue>(
    () => ({ focusedPart, setFocusedPart, clearFocus }),
    [focusedPart, setFocusedPart, clearFocus]
  );

  return (
    <FocusContext.Provider value={value}>
      <Suspense fallback={null}>
        <FocusUrlSync focusedRef={focusedRef} apply={setFocused} />
      </Suspense>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocusedPart(): FocusValue {
  return useContext(FocusContext);
}
