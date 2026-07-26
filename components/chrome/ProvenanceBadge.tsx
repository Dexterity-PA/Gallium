// Data provenance badge (DESIGN.md §9 / BRIEF). Fixed bottom-right, above the
// ticker. Never removed, faded, or repositioned for balance.
// z-index sits above the drawer so it stays visible in every recorded frame,
// even when the EXPOSURE drawer occupies the right edge.
//
// Inset is the shared 24px safe margin (SAFE_INSET in components/ui/Panel.tsx):
// this badge is the one element pinned to the viewport's right edge on all six
// screens, so at the old var(--sp-3) it sat 8px off the edge and was the first
// thing to look clipped on a narrow window.
export function ProvenanceBadge() {
  return (
    <div
      className="label pointer-events-none fixed z-[60] select-none"
      style={{
        right: "var(--safe-inset)",
        bottom: "calc(var(--h-ticker) + var(--sp-1))",
      }}
    >
      <span
        className="px-1 py-0.5"
        style={{ background: "color-mix(in srgb, var(--bg-base) 82%, transparent)" }}
      >
        FICTIONAL SCENARIO · REPRESENTATIVE DATA, CUSTOMER IDENTIFIERS ANONYMIZED
      </span>
    </div>
  );
}
