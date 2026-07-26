import type { BomLine } from "@/lib/types";

/* ============================================================
   DAYS TO PRODUCTION HALT: the runway math, and nothing else.

   This lives apart from lib/derive/impact.ts for one structural reason:
   impact.ts imports lib/data/scenario.ts (for the interactive control), and
   scenario.ts imports lib/data/event.ts. If event.ts then imported impact.ts
   to derive its own IMPACT.daysToHalt, the cycle
   event -> impact -> scenario -> event would evaluate scenario.ts while
   event.ts was still initializing, and scenario.ts reads PRIMARY_EVENT at
   module top level. That is a TDZ crash at import, dependent on which module
   the bundler happens to enter first.

   The halt math needs none of that: it takes BomLine[] and returns numbers.
   Kept dependency-free here, it is importable from event.ts, impact.ts, and
   any screen, so DAYS TO HALT has exactly one definition. impact.ts
   re-exports everything below, so existing import sites keep working.
   ============================================================ */

//   BUFFER_WEEKS (10)              Meridian's standard on-hand safety-stock
//                                   policy for MD-7200 critical components:
//                                   10 weeks (70 days) of forward cover,
//                                   independent of any one part's lead time.
//   BASELINE_LEAD_TIME_WEEKS (10)  What that buffer is sized to absorb: a
//                                   normal ~10-week critical-component lead
//                                   time. The buffer has zero slack left
//                                   over for any week a part's lead time
//                                   runs longer than this.
//   EROSION_DAYS_PER_OVERRUN_WEEK  For every week the bottleneck EXPOSED
//   (0.6)                          line's lead time exceeds that 10-week
//                                   baseline, 0.6 days come off the 70-day
//                                   buffer: the excess reach of an
//                                   increasingly hard-to-source part eats
//                                   into the runway even though the part
//                                   itself is not the one running out.
//
// FORMULA:
//   bottleneckWeeks = max(leadTimeWeeks) across exposed lines
//   overrunWeeks    = max(0, bottleneckWeeks - BASELINE_LEAD_TIME_WEEKS)
//   daysToHalt      = BUFFER_DAYS - round(overrunWeeks * 0.6)
//
// Baseline: the bottleneck is BOM-13 (SUB-BT-INF, substrate, MODELED) at 41
// weeks, the same part LeadTimePressure.tsx names as the "Longest Pole".
// overrun = 41 - 10 = 31 weeks. 70 - round(31 * 0.6) = 70 - 19 = 51 days.
//
// Note for anyone re-deriving this by hand: 41 is the max across the EXPOSED
// lines only. BOM-07 (38w) and BOM-12 (37w) are the next two; the longer
// lead times further down the BOM sit on AT_RISK and CLEAR lines, which have
// not lost their route and so do not erode the buffer.

export const BUFFER_WEEKS = 10;
export const BASELINE_LEAD_TIME_WEEKS = 10;
export const EROSION_DAYS_PER_OVERRUN_WEEK = 0.6;
export const BUFFER_DAYS = BUFFER_WEEKS * 7; // 70

export interface DaysToHaltBreakdown {
  daysToHalt: number;
  bufferDays: number;
  bottleneck: BomLine | null;
  bottleneckLeadTimeWeeks: number;
  overrunWeeks: number;
  erosionDays: number;
}

export function daysToHalt(exposedLines: BomLine[]): DaysToHaltBreakdown {
  if (exposedLines.length === 0) {
    return {
      daysToHalt: BUFFER_DAYS,
      bufferDays: BUFFER_DAYS,
      bottleneck: null,
      bottleneckLeadTimeWeeks: 0,
      overrunWeeks: 0,
      erosionDays: 0,
    };
  }
  const bottleneck = exposedLines.reduce((a, b) =>
    b.leadTimeWeeks > a.leadTimeWeeks ? b : a
  );
  const overrunWeeks = Math.max(0, bottleneck.leadTimeWeeks - BASELINE_LEAD_TIME_WEEKS);
  const erosionDays = Math.round(overrunWeeks * EROSION_DAYS_PER_OVERRUN_WEEK);
  return {
    daysToHalt: Math.max(0, BUFFER_DAYS - erosionDays),
    bufferDays: BUFFER_DAYS,
    bottleneck,
    bottleneckLeadTimeWeeks: bottleneck.leadTimeWeeks,
    overrunWeeks,
    erosionDays,
  };
}

/** Runway after a set of resolutions, held to the buffer that actually
 *  exists. A resolution restores a route; it does not manufacture inventory,
 *  so no combination of actions can push the runway past BUFFER_DAYS. Without
 *  this ceiling RESOLVE reported 177 days against a 70-day buffer. */
export function recoveredDaysToHalt(baseDays: number, daysGained: number): number {
  return Math.min(BUFFER_DAYS, baseDays + Math.max(0, daysGained));
}
