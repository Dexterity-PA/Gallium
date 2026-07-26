import type { Provenance } from "@/lib/types";

// Confidence as named bands with RANGES, not one canonical number per band.
//
// History, because the pendulum has swung twice here. The original data layer
// sprinkled ad-hoc percentages (94%, 97%, 66%…) that implied a measurement we
// do not have. The fix was to collapse each band to a single canonical value,
// which removed the false precision but replaced it with a worse tell: every
// feed row read CONF 90%, every observed BOM line read 100%, and a screen full
// of identical numbers is the single loudest "this data was generated" signal
// in the product. Nothing real is that uniform.
//
// So a band is now a RANGE, and each record picks its own value inside it. The
// band still carries the meaning (how corroborated is this?); the value inside
// the band carries the texture (how corroborated is THIS one, specifically?).
// The guard below still refuses anything outside the ranges, so the bands are
// as load-bearing as they were; there is just no longer one number per band.
//
// Two provenance classes, five bands:
//   OBSERVED  CONFIRMED     93–99  first-party confirmed (ERP / procurement / physical)
//   OBSERVED  CORROBORATED  80–92  multiple independent external sources agree
//   MODELED   HIGH          70–79  strong / multi-thread inference
//   MODELED   MEDIUM        60–69  moderate inference
//   MODELED   LOW           45–59  weak / single-thread inference
//
// 90 and 100 are FORBIDDEN outright. They are the two values a generator
// reaches for, they read as placeholders rather than measurements, and both
// sit inside otherwise-legal ranges, so they get an explicit veto instead of
// relying on authors to avoid them.

export type ConfidenceBand =
  | "CONFIRMED"
  | "CORROBORATED"
  | "MODELED_HIGH"
  | "MODELED_MED"
  | "MODELED_LOW";

export interface BandRange {
  lo: number; // inclusive
  hi: number; // inclusive
  provenance: Provenance;
}

export const CONFIDENCE_RANGE: Record<ConfidenceBand, BandRange> = {
  CONFIRMED: { lo: 93, hi: 99, provenance: "OBSERVED" },
  CORROBORATED: { lo: 80, hi: 92, provenance: "OBSERVED" },
  MODELED_HIGH: { lo: 70, hi: 79, provenance: "MODELED" },
  MODELED_MED: { lo: 60, hi: 69, provenance: "MODELED" },
  MODELED_LOW: { lo: 45, hi: 59, provenance: "MODELED" },
};

// Values that may never appear on screen, in any band. See the note above.
export const FORBIDDEN_CONFIDENCE = [90, 100];

// Representative value per band: the number to reach for when a record has no
// reason to differ from its band's centre (and the value lib/news/classify.ts
// assigns to a freshly classified article). Deliberately NOT round: these are
// mid-band picks, not band definitions. Prefer an authored per-record value
// over these wherever the record has a reason of its own.
export const CONFIDENCE_VALUE: Record<ConfidenceBand, number> = {
  CONFIRMED: 96,
  CORROBORATED: 88,
  MODELED_HIGH: 74,
  MODELED_MED: 63,
  MODELED_LOW: 58,
};

// Named shortcuts, so data modules read as bands rather than magic numbers.
export const CONFIRMED = CONFIDENCE_VALUE.CONFIRMED; // 96
export const CORROBORATED = CONFIDENCE_VALUE.CORROBORATED; // 88
export const MODELED_HIGH = CONFIDENCE_VALUE.MODELED_HIGH; // 74
export const MODELED_MED = CONFIDENCE_VALUE.MODELED_MED; // 63
export const MODELED_LOW = CONFIDENCE_VALUE.MODELED_LOW; // 58

const BANDS = Object.entries(CONFIDENCE_RANGE) as Array<[ConfidenceBand, BandRange]>;

/** The bands legal for a provenance class, ordered low → high. */
export function bandsFor(p: Provenance): Array<[ConfidenceBand, BandRange]> {
  return BANDS.filter(([, r]) => r.provenance === p).sort((a, b) => a[1].lo - b[1].lo);
}

/** The full legal span for a provenance class, e.g. OBSERVED → 80–99. */
export function spanFor(p: Provenance): { lo: number; hi: number } {
  const rs = bandsFor(p).map(([, r]) => r);
  return { lo: Math.min(...rs.map((r) => r.lo)), hi: Math.max(...rs.map((r) => r.hi)) };
}

/** Which band a value falls in, or null if it is outside every band. */
export function bandOf(v: number): ConfidenceBand | null {
  const hit = BANDS.find(([, r]) => v >= r.lo && v <= r.hi);
  return hit ? hit[0] : null;
}

export function isForbidden(v: number): boolean {
  return FORBIDDEN_CONFIDENCE.includes(v);
}

/** In a legal band for `p`, and not a forbidden value. */
export function isConfidenceValue(v: number, p: Provenance): boolean {
  if (!Number.isInteger(v) || isForbidden(v)) return false;
  const band = bandOf(v);
  return !!band && CONFIDENCE_RANGE[band].provenance === p;
}

// Nudge a value off a forbidden number, downward: 90 → 89, 100 → 99. Down
// rather than up so a nudge never inflates a claim.
function unforbid(v: number): number {
  return isForbidden(v) ? v - 1 : v;
}

// Map an arbitrary raw score onto a legal value for its provenance class.
// Formerly this collapsed onto the single nearest band value, which is what
// flattened the whole graph onto 55/65/75/90/100. It now CLAMPS into the
// class's legal span and preserves whatever variation the caller had, so a
// machine-generated spread stays a spread.
export function snapConfidence(v: number, p: Provenance): number {
  const { lo, hi } = spanFor(p);
  const clamped = Math.min(hi, Math.max(lo, Math.round(v)));
  return unforbid(clamped);
}

// Throwing guard for the data modules: a confidence outside its provenance's
// bands, or sitting on a forbidden value, is a data-layer bug and should
// fail at import.
export function assertBand(v: number, p: Provenance, where: string): number {
  if (isForbidden(v)) {
    throw new Error(
      `confidence ${v} is forbidden (never render ${FORBIDDEN_CONFIDENCE.join(" or ")}) at ${where}`
    );
  }
  if (!isConfidenceValue(v, p)) {
    const legal = bandsFor(p)
      .map(([name, r]) => `${name} ${r.lo}-${r.hi}`)
      .join(" / ");
    throw new Error(`confidence ${v} is not a ${p} band value (${legal}) at ${where}`);
  }
  return v;
}

// Provenance-agnostic variant: the value must land in SOME band and must not
// be forbidden. Used by the event feed, where a row's confidence reflects how
// corroborated that specific signal is rather than a fixed provenance class,
// an unattributed early report legitimately reads in the MODELED range even
// though the feed itself is an observation stream.
export function assertConfidence(v: number, where: string): number {
  if (isForbidden(v)) {
    throw new Error(
      `confidence ${v} is forbidden (never render ${FORBIDDEN_CONFIDENCE.join(" or ")}) at ${where}`
    );
  }
  if (!Number.isInteger(v) || !bandOf(v)) {
    throw new Error(`confidence ${v} falls in no band at ${where}`);
  }
  return v;
}

// The anti-uniformity guard. A list rendered in order must not repeat a
// confidence in consecutive positions, because that adjacency is what reads as
// generated, far more than the values themselves do.
export function assertNoAdjacentRepeats(values: number[], where: string): true {
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]) {
      throw new Error(
        `confidence ${values[i]} repeats at adjacent positions ${i - 1}/${i} in ${where}`
      );
    }
  }
  return true;
}
