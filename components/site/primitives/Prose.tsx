import type { ReactNode } from "react";

// The measure cap for running text: 65ch, applied to text blocks only.
// Never wrap a grid row or a full-width band in Prose; it exists so a
// paragraph cannot sprawl across a 2560px viewport.
export function Prose({
  dim = false,
  className = "",
  children,
}: {
  /** Secondary ink for supporting paragraphs. */
  dim?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        maxWidth: "65ch",
        fontFamily: "var(--site-font-text)",
        fontSize: "var(--site-t-body)",
        lineHeight: "var(--site-lh-body)",
        color: dim ? "var(--site-fg-dim)" : "var(--site-fg)",
      }}
    >
      {children}
    </div>
  );
}
