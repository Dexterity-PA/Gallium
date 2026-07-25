// Data provenance badge (DESIGN.md §9 / BRIEF). Fixed bottom-right, above the
// ticker. Never removed, faded, or repositioned for balance.
// z-index sits above the drawer so it stays visible in every recorded frame,
// even when the EXPOSURE drawer occupies the right edge.
export function ProvenanceBadge() {
  return (
    <div
      className="label pointer-events-none fixed z-[60] select-none"
      style={{ right: "var(--sp-3)", bottom: "calc(var(--h-ticker) + var(--sp-1))" }}
    >
      <span
        className="px-1 py-0.5"
        style={{ background: "color-mix(in srgb, var(--bg-base) 82%, transparent)" }}
      >
        FICTIONAL SCENARIO — REPRESENTATIVE DATA, CUSTOMER IDENTIFIERS ANONYMIZED
      </span>
    </div>
  );
}
