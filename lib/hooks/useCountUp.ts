"use client";

import { useEffect, useRef, useState } from "react";

// Numbers tween, never snap (DESIGN.md §5). ease-out, ≤300ms by default.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface CountUpOptions {
  duration?: number; // ms
  from?: number; // start value on first mount
  enabled?: boolean; // when false, jump straight to target
}

export function useCountUp(
  target: number,
  { duration = 900, from = 0, enabled = true }: CountUpOptions = {}
): number {
  const [value, setValue] = useState<number>(enabled ? from : target);
  const fromRef = useRef<number>(enabled ? from : target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const start = performance.now();
    const startValue = fromRef.current;
    const delta = target - startValue;
    if (delta === 0) return;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = startValue + delta * easeOut(t);
      setValue(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, duration, enabled]);

  return value;
}
