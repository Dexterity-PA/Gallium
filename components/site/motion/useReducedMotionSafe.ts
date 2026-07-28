"use client";

import { useReducedMotion } from "framer-motion";

// The one reduced-motion source of truth for the marketing site. Every Wave 1
// component that animates anything must consult this instead of reading the
// media query itself: framer-motion's hook returns null during SSR, and this
// wrapper resolves that to false so callers get a plain boolean.
export function useReducedMotionSafe(): boolean {
  return useReducedMotion() ?? false;
}
