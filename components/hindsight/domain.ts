import type { HindsightEvent } from "@/lib/data/hindsight";
import { deltaDays } from "@/lib/data/hindsight";

export interface LeadDomain {
  min: number;
  max: number;
  toPct: (v: number) => number;
}

// One shared domain for every lead-time visual on this screen: the per-row
// inline bar in the table and the distribution strip below it. Computed once
// in the page and passed down as a prop, so the two views are reading the
// same numbers rather than two independent calculations that happen to agree
// today and could quietly drift apart later.
//
// The domain always includes zero, because the sign of a lead time (before
// the benchmark vs after it) is the fact this screen exists to prove.
export function computeLeadDomain(events: HindsightEvent[]): LeadDomain {
  const deltas = events.map(deltaDays);
  const dataMin = Math.min(0, ...deltas);
  const dataMax = Math.max(0, ...deltas);
  const span = Math.max(1, dataMax - dataMin);
  const pad = Math.max(2, Math.round(span * 0.15));
  const min = dataMin - pad;
  const max = dataMax + pad;
  return { min, max, toPct: (v: number) => ((v - min) / (max - min)) * 100 };
}
