"use client";

import { useSyncExternalStore } from "react";

// The one reduced-motion source of truth for the marketing site. Every Wave 1
// component that animates anything must consult this instead of reading the
// media query itself.
//
// Hydration safety: the server snapshot is false, and useSyncExternalStore
// also uses the server snapshot during hydration, so the client's first
// render always matches the server HTML byte for byte. If the visitor has
// reduced motion enabled, React re-renders with true immediately after
// hydration. (The previous framer-motion useReducedMotion() ?? false wrapper
// read the media query synchronously on the client's first render, which
// made the server and client disagree and threw a React 19 hydration error
// whenever reduced motion was on.)
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
