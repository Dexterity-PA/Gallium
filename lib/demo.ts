// Determinism controls for the demo (DATA.md §10).
// Every "random-feeling" behavior is seeded from DEMO_SEED, and the
// on-screen clock starts from a FIXED epoch rather than wall-clock time,
// so every recorded take plays identically. (Resolves the "real time" vs
// "repeatable takes" tension in BRIEF/DATA by keeping the *cadence* live:
// it ticks every real second, while the *value* is deterministic.)

export const DEMO_SEED = 0x6a11b3; // fixed constant, do not change between takes

// 2026-07-22 14:32:07 UTC, matching the status-bar mock in BRIEF, and sits
// 9s after the primary event (14:31:58) so a just-detected alert reads right.
export const DEMO_EPOCH_MS = Date.UTC(2026, 6, 22, 14, 32, 7);

// Scripted feed arrival offsets (ms from load). See DATA.md §2.
export const FEED_ARRIVALS_MS = [3200, 5600, 8000] as const;
export const PRIMARY_ARRIVAL_MS = 8000;

// Tick engine intervals (BRIEF "Tick engine").
export const TICK = {
  clockMs: 1000,
  leadTimeMs: 12000,
  observedMs: 20000,
} as const;
