import type { ReactNode } from "react";
import { SAMPLE_DATA_LABEL } from "@/lib/site/content";

// The frame every product screenshot or embedded product view sits in:
// a 1px rule, the instrument's recessed surface, and a visible SAMPLE DATA
// label. No shadow, no perspective tilt, no fake browser chrome. The label
// is not optional and not removable; honesty about the fictional demo data
// is a hard constraint of this site.
export function Figure({
  caption,
  className = "",
  children,
}: {
  /** Optional caption line under the frame, set in mono. */
  caption?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={`m-0 ${className}`}>
      <div
        className="relative"
        style={{
          border: "1px solid var(--site-rule-strong)",
          background: "var(--site-recess)",
        }}
      >
        <span
          className="absolute right-0 top-0 z-10 select-none uppercase"
          style={{
            fontFamily: "var(--site-font-mono)",
            fontSize: "var(--site-t-label)",
            letterSpacing: "var(--site-ls-label)",
            color: "var(--site-fg-dim)",
            background: "var(--site-recess)",
            borderLeft: "1px solid var(--site-rule-strong)",
            borderBottom: "1px solid var(--site-rule-strong)",
            padding: "0.25rem 0.5rem",
          }}
        >
          {SAMPLE_DATA_LABEL}
        </span>
        {children}
      </div>
      {caption !== undefined && (
        <figcaption
          className="mt-2"
          style={{
            fontFamily: "var(--site-font-mono)",
            fontSize: "var(--site-t-label)",
            letterSpacing: "0.02em",
            color: "var(--site-fg-dim)",
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
