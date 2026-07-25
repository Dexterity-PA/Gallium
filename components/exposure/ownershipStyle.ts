import type { OwnershipStatus } from "@/lib/types";

// Ownership (affiliates-screening) posture reads on its own glyph axis,
// distinct from the logistics STATUS column. Terminals use characters, not
// icon components (DESIGN.md §6.7).
//
// Only the threshold crosser carries a hue. FLAGGED is --critical; REVIEW and
// CLEAR separate by glyph and text weight (⚑ / ◆ / ●) rather than by adding an
// amber and a green to a panel that already spends its two accents. A missing
// status defaults to CLEAR defensively.

export function ownershipColor(o: OwnershipStatus | undefined): string {
  switch (o) {
    case "FLAGGED":
      return "var(--critical)";
    case "REVIEW":
      return "var(--text-primary)";
    case "CLEAR":
    default:
      return "var(--text-dim)";
  }
}

export function ownershipGlyph(o: OwnershipStatus | undefined): string {
  switch (o) {
    case "FLAGGED":
      return "⚑";
    case "REVIEW":
      return "◆";
    case "CLEAR":
    default:
      return "●";
  }
}
