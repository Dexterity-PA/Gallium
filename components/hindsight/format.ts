// Shared presentational formatters for the HINDSIGHT screen. Manual string
// handling rather than toLocaleDateString or Intl, the same choice
// SourcePanel's formatRetrieved makes, so server and client render
// identically and nothing depends on the runtime locale.

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function formatTimestamp(iso: string): string {
  return iso.replace("T", " ").replace("Z", " UTC").slice(0, 20);
}

export function deltaLabel(d: number): string {
  return `${d >= 0 ? "+" : ""}${d}D`;
}
