import type { ReactNode } from "react";

// Inline mono label: uppercase, tracked, dim. For the ordinal + eyebrow pair
// in a section's left margin, use Section's own props; this is for labels
// inside content (a Figure caption kicker, a pricing tier name).
export function Eyebrow({
  accent = false,
  className = "",
  children,
}: {
  /** The single site accent, for the rare label that marks an action. */
  accent?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`uppercase ${className}`}
      style={{
        fontFamily: "var(--site-font-mono)",
        fontSize: "var(--site-t-label)",
        letterSpacing: "var(--site-ls-label)",
        color: accent ? "var(--site-accent)" : "var(--site-fg-dim)",
      }}
    >
      {children}
    </span>
  );
}
