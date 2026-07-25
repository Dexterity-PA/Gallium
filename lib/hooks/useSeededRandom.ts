"use client";

import { useRef } from "react";
import { mulberry32, seededInt } from "@/lib/rng";

export { mulberry32, seededInt };

/**
 * Hook: a ref-stable seeded generator that survives re-renders.
 * Same seed → same sequence, every mount.
 */
export function useSeededRandom(seed: number): () => number {
  const ref = useRef<(() => number) | null>(null);
  if (ref.current === null) {
    ref.current = mulberry32(seed);
  }
  return ref.current;
}
