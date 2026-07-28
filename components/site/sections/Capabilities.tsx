import { CAPABILITIES } from "@/lib/site/content";
import { Section, SectionHeader } from "@/components/site/primitives/Section";
import { Eyebrow } from "@/components/site/primitives/Eyebrow";
import { Prose } from "@/components/site/primitives/Prose";
import { Reveal } from "@/components/site/motion/Reveal";
import { RuleDraw } from "@/components/site/motion/RuleDraw";

// Section 02: the four capabilities as a ledger of rows, not a card grid.
// Each row is mono label | serif claim + one supporting sentence, separated
// by hairlines that draw on entry. The fourth row (emphasis) is the
// differentiator and carries slightly more weight: accent label, a small
// claim-size bump, and its sentence in primary ink.
export default function Capabilities() {
  return (
    <Section
      id="capabilities"
      ordinal={CAPABILITIES.ordinal}
      eyebrow={CAPABILITIES.eyebrow}
    >
      <Reveal>
        <SectionHeader>{CAPABILITIES.header}</SectionHeader>
      </Reveal>

      <Reveal amount={0.08} className="mt-[var(--site-sp-5)]">
        {CAPABILITIES.rows.map((row, i) => {
          const emphasis = "emphasis" in row && row.emphasis === true;
          return (
            <div key={row.label}>
              <RuleDraw delay={i * 0.06} />
              <div
                className="grid grid-cols-1 gap-y-[var(--site-sp-2)] md:grid-cols-[7rem_minmax(0,1fr)] md:gap-x-[var(--site-sp-4)]"
                style={{ paddingBlock: "var(--site-sp-4)" }}
              >
                <div className="md:pt-[0.45rem]">
                  <Eyebrow accent={emphasis}>{row.label}</Eyebrow>
                </div>
                <div className="min-w-0">
                  <h3
                    style={{
                      fontFamily: "var(--site-font-text)",
                      fontWeight: 600,
                      color: "var(--site-fg)",
                      lineHeight: "var(--site-lh-heading)",
                      letterSpacing: "-0.01em",
                      fontSize: emphasis
                        ? "clamp(1.4375rem, 1.16rem + 0.95vw, 2rem)"
                        : "clamp(1.3125rem, 1.09rem + 0.75vw, 1.75rem)",
                    }}
                  >
                    {row.claim}
                  </h3>
                  <Prose dim={!emphasis} className="mt-[var(--site-sp-2)]">
                    {row.body}
                  </Prose>
                </div>
              </div>
            </div>
          );
        })}
        <RuleDraw delay={CAPABILITIES.rows.length * 0.06} />
      </Reveal>
    </Section>
  );
}
