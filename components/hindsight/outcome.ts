import type { HindsightOutcome } from "@/lib/data/hindsight";

// Shared between HindsightTable and LeadTimeDistribution so a row and its
// point on the strip always read as the same colour. Outcome is the one
// place this screen spends its RULE-4 colour budget: --ok for a clean win,
// --critical for the miss. PARTIAL sits on --text-primary, a base text
// colour, not semantic, so a future PARTIAL row does not add a third accent.

export function outcomeTone(o: HindsightOutcome): string {
  switch (o) {
    case "CAUGHT":
      return "var(--ok)";
    case "PARTIAL":
      return "var(--text-primary)";
    case "MISSED":
      return "var(--critical)";
  }
}

export function outcomeGlyph(o: HindsightOutcome): string {
  switch (o) {
    case "CAUGHT":
      return "●";
    case "PARTIAL":
      return "◆";
    case "MISSED":
      return "▲";
  }
}
