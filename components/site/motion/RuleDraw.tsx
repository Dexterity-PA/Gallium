"use client";

import { motion } from "framer-motion";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

// The hairline that draws itself: scaleX 0 to 1 from the left, 600ms, once.
// Transform only, so the layout never moves. Reduced motion: a plain
// opacity fade to the finished rule.
export function RuleDraw({
  strong = false,
  delay = 0,
  className = "",
}: {
  strong?: boolean;
  /** Seconds. */
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotionSafe();

  return (
    <motion.div
      aria-hidden
      className={className}
      style={{
        height: 1,
        background: strong ? "var(--site-rule-strong)" : "var(--site-rule)",
        transformOrigin: "left center",
      }}
      initial={reduced ? { opacity: 0 } : { scaleX: 0 }}
      whileInView={reduced ? { opacity: 1 } : { scaleX: 1 }}
      viewport={{ once: true, amount: "some" }}
      transition={
        reduced
          ? { duration: 0.2 }
          : { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }
      }
    />
  );
}
