import { CLOSING } from "@/lib/site/content";
import { Section, SectionHeader } from "@/components/site/primitives/Section";
import { Reveal } from "@/components/site/motion/Reveal";
import { RuleDraw } from "@/components/site/motion/RuleDraw";

// The closing band. id="company" is the nav's Company anchor. Left-aligned
// to match the rest of the page. The primary action is a plain <a> so /app
// is a hard navigation into the product, never a client transition.
export default function ClosingCta() {
  const primary = CLOSING.actions.find((a) => a.primary) ?? CLOSING.actions[0];
  const secondary =
    CLOSING.actions.find((a) => !a.primary) ??
    CLOSING.actions[CLOSING.actions.length - 1];

  return (
    <Section id="company">
      <RuleDraw strong />
      <Reveal className="pt-[var(--site-sp-5)]">
        <SectionHeader>{CLOSING.header}</SectionHeader>
        <div className="mt-[var(--site-sp-4)] flex flex-wrap items-baseline gap-x-[var(--site-sp-4)] gap-y-[var(--site-sp-2)]">
          <a
            href={primary.href}
            className="inline-block uppercase"
            style={{
              fontFamily: "var(--site-font-mono)",
              fontSize: "var(--site-t-label)",
              letterSpacing: "var(--site-ls-label)",
              color: "var(--site-accent)",
              border: "1px solid var(--site-accent)",
              borderRadius: 2,
              padding: "0.75rem 1.5rem",
            }}
          >
            {primary.label}
          </a>
          <a
            href={secondary.href}
            className="inline-block"
            style={{
              fontFamily: "var(--site-font-mono)",
              fontSize: "var(--site-t-label)",
              letterSpacing: "0.02em",
              color: "var(--site-fg-dim)",
              borderBottom: "1px solid var(--site-rule-strong)",
              paddingBottom: "0.125rem",
            }}
          >
            {secondary.label}
          </a>
        </div>
      </Reveal>
    </Section>
  );
}
