import type { Status, Severity, Provenance } from "@/lib/types";

// Terminals use characters, not icon components (DESIGN.md §6.7).
//
// ONE accent on this axis. EXPOSED / CRITICAL is --critical; the lesser steps
// used to be orange and green, which put four hues on a panel at equal weight
// and made none of them mean anything. They now separate by glyph and by text
// weight instead: ▲ at --text-primary for the middle step, ● at --text-dim for
// the clear one. Nothing below EXPOSED gets a colour.

export function statusColor(status: Status): string {
  switch (status) {
    case "EXPOSED":
      return "var(--critical)";
    case "AT_RISK":
      return "var(--text-primary)";
    case "CLEAR":
      return "var(--text-dim)";
  }
}

export function statusGlyph(status: Status): string {
  switch (status) {
    case "EXPOSED":
      return "▲";
    case "AT_RISK":
      return "◆";
    case "CLEAR":
      return "●";
  }
}

export function severityColor(sev: Severity): string {
  switch (sev) {
    case "CRITICAL":
      return "var(--critical)";
    case "WARN":
      return "var(--text-primary)";
    case "INFO":
      return "var(--text-dim)";
  }
}

export function severityGlyph(sev: Severity): string {
  return sev === "INFO" ? "●" : "▲";
}

// Provenance drives whether a value reads in --modeled (inferred) or not.
export function provenanceColor(
  p: Provenance,
  fallback = "var(--text-primary)"
): string {
  return p === "MODELED" ? "var(--modeled)" : fallback;
}

export function StatusGlyph({ status }: { status: Status }) {
  return (
    <span style={{ color: statusColor(status) }} aria-label={status}>
      {statusGlyph(status)}
    </span>
  );
}
