"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { animate, useInView } from "framer-motion";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

// A figure that counts to its real value once, on entry: 1.2s, ease out,
// never replays. The server renders the FINAL value (so the locked figures
// are in the HTML for non-JS readers and crawlers); a layout effect snaps to
// zero before first paint only when the animation is actually going to run.
// Reduced motion renders the final value immediately and never animates.
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  duration = 1.2,
  className = "",
}: {
  value: number;
  /** Turns the tweened number into the display string, e.g. (n) => `$${n.toFixed(1)}M`. */
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotionSafe();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(() => format(value));
  const armed = useRef(false);

  // Pre-paint: if we will animate, start from zero instead of flashing the
  // final value. Runs once on hydration.
  useLayoutEffect(() => {
    if (!reduced && !armed.current) {
      armed.current = true;
      setDisplay(format(0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(format(value));
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(format(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, value, duration]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {display}
    </span>
  );
}
