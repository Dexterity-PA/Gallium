import type { CSSProperties } from "react";
import { Section, SectionHeader } from "@/components/site/primitives/Section";
import { Prose } from "@/components/site/primitives/Prose";
import { Reveal } from "@/components/site/motion/Reveal";
import { WEDGE } from "@/lib/site/content";

// Section 03, THE WEDGE. Deliberately the quietest band on the page: one
// header, one dim paragraph, one hairline diagram of the join. Nothing here
// competes with the copy; the restraint is the argument.

const labelStyle: CSSProperties = {
  fontFamily: "var(--site-font-mono)",
  fontSize: "var(--site-t-label)",
  letterSpacing: "var(--site-ls-label)",
  color: "var(--site-fg-dim)",
  lineHeight: 1,
  whiteSpace: "nowrap",
};

// Two source lines converging to one joined line. The labels are live HTML
// so they never scale with the viewport; only the lines stretch. The SVG is
// deliberately distorted (preserveAspectRatio "none") and every stroke uses
// vector-effect non-scaling-stroke, so the hairlines stay exactly 1px at any
// width. Source lines sit at rule weight; the joined line is inked one step
// darker, because the join is the part that exists only here.
function JoinDiagram() {
  return (
    <div
      aria-hidden
      className="grid"
      style={{
        maxWidth: "40rem",
        height: "6rem",
        gridTemplateColumns: "auto minmax(3.5rem, 1fr) auto",
        columnGap: "var(--site-sp-2)",
      }}
    >
      <div className="flex h-full flex-col justify-between uppercase">
        <span style={labelStyle}>Ownership data</span>
        <span style={labelStyle}>Part data</span>
      </div>
      <svg
        className="h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 6 L 46 6 L 68 50"
          fill="none"
          stroke="var(--site-rule-strong)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 0 94 L 46 94 L 68 50"
          fill="none"
          stroke="var(--site-rule-strong)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 68 50 L 100 50"
          fill="none"
          stroke="var(--site-fg-dim)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex h-full items-center uppercase">
        <span style={labelStyle}>The join</span>
      </div>
    </div>
  );
}

export default function Wedge() {
  return (
    <Section ordinal={WEDGE.ordinal} eyebrow={WEDGE.eyebrow}>
      <Reveal>
        <SectionHeader>{WEDGE.header}</SectionHeader>
        <Prose dim className="mt-[var(--site-sp-3)]">
          <p>{WEDGE.body}</p>
        </Prose>
        <div className="mt-[var(--site-sp-5)]">
          <JoinDiagram />
        </div>
      </Reveal>
    </Section>
  );
}
