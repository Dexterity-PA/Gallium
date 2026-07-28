import type { ReactNode } from "react";

// Section owns the page's vertical rhythm and the ordinal in the left margin.
// Every numbered band on the marketing page renders through it, so section
// spacing is decided exactly once.
//
// Layout: a centered column capped at --site-max with --site-gutter insets.
// At md and up the grid opens an --site-ordinal-col left margin column where
// the ordinal and eyebrow sit; below md they stack above the content.
export function Section({
  id,
  ordinal,
  eyebrow,
  children,
  className = "",
}: {
  id?: string;
  /** "01" .. "05", rendered in mono in the left margin. */
  ordinal?: string;
  /** Mono label rendered under the ordinal, e.g. "THE PROBLEM". */
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={className}
      style={{
        paddingBlock: "calc(var(--site-sp-section) / 2)",
      }}
    >
      <div
        className="mx-auto grid w-full grid-cols-1 md:grid-cols-[var(--site-ordinal-col)_minmax(0,1fr)]"
        style={{
          maxWidth: "var(--site-max)",
          paddingInline: "var(--site-gutter)",
          columnGap: "var(--site-sp-4)",
          rowGap: "var(--site-sp-3)",
        }}
      >
        <div aria-hidden={ordinal === undefined && eyebrow === undefined}>
          {ordinal !== undefined && (
            <div
              style={{
                fontFamily: "var(--site-font-mono)",
                fontSize: "var(--site-t-label)",
                letterSpacing: "var(--site-ls-label)",
                color: "var(--site-accent)",
              }}
            >
              {ordinal}
            </div>
          )}
          {eyebrow !== undefined && (
            <div
              className="mt-1 uppercase"
              style={{
                fontFamily: "var(--site-font-mono)",
                fontSize: "var(--site-t-label)",
                letterSpacing: "var(--site-ls-label)",
                color: "var(--site-fg-dim)",
              }}
            >
              {eyebrow}
            </div>
          )}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

// The section heading treatment, shared so every band sets its header the
// same way: Newsreader at the section step, tight leading, primary ink.
export function SectionHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={className}
      style={{
        fontFamily: "var(--site-font-text)",
        fontSize: "var(--site-t-section)",
        lineHeight: "var(--site-lh-heading)",
        fontWeight: 500,
        color: "var(--site-fg)",
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
  );
}
