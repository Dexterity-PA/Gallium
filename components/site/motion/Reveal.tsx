"use client";

import { Children, type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

// The site's one entrance animation: an 8px rise plus opacity, staggered
// 40ms per direct child, firing exactly once. Scroll back never replays it.
//
// Every direct child is wrapped in a motion.div that carries the item
// variant, so a caller staggers a list simply by passing list items as
// direct children. Because the wrapper is a real div (transforms do not
// apply to display: contents), do NOT put Reveal directly between a grid
// or flex parent and its children; reveal the block, not the row.
//
// Reduced motion: the rise is dropped and the reveal becomes a plain
// opacity fade.
export function Reveal({
  children,
  className = "",
  delay = 0,
  amount = 0.25,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds before the first child starts. */
  delay?: number;
  /** How much of the block must be in view before firing (0 to 1). */
  amount?: number;
}) {
  const reduced = useReducedMotionSafe();

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : 0.04,
        delayChildren: delay,
      },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.2 : 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {Children.map(children, (child) => (
        <motion.div variants={item}>{child}</motion.div>
      ))}
    </motion.div>
  );
}
