// The data moat, rendered as a number on screen (DATA.md §9).
// `observed` increments +1 every 20s during the demo; over a two-minute
// recording it visibly rises. This is the detail most worth getting right.
export const COUNTERS = {
  observed: 1_847,
  modeled: 412,
} as const;
