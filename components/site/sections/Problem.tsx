import { PROBLEM } from "@/lib/site/content";
import { Section, SectionHeader } from "@/components/site/primitives/Section";
import { Prose } from "@/components/site/primitives/Prose";
import { Reveal } from "@/components/site/motion/Reveal";
import { RuleDraw } from "@/components/site/motion/RuleDraw";

// Section 01, THE PROBLEM. Three claims stacked with generous air and a
// hairline drawn between each pair. No cards, no icons, no figures: the
// argument is carried entirely by type. All copy comes from lib/site/content.
export default function Problem() {
  return (
    <Section id="problem" ordinal={PROBLEM.ordinal} eyebrow={PROBLEM.eyebrow}>
      <Reveal>
        <SectionHeader>{PROBLEM.header}</SectionHeader>
      </Reveal>

      <div style={{ marginTop: "var(--site-sp-5)" }}>
        {PROBLEM.blocks.map((block, i) => (
          <div key={block.claim}>
            {i > 0 && (
              <RuleDraw className="my-[var(--site-sp-5)] lg:my-[var(--site-sp-6)]" />
            )}
            <Reveal>
              <h3
                style={{
                  fontFamily: "var(--site-font-text)",
                  fontSize: "clamp(1.3125rem, 1.1rem + 0.75vw, 1.75rem)",
                  lineHeight: "var(--site-lh-heading)",
                  fontWeight: 600,
                  color: "var(--site-fg)",
                  letterSpacing: "-0.005em",
                  maxWidth: "30ch",
                }}
              >
                {block.claim}
              </h3>
              <Prose dim className="mt-[var(--site-sp-2)]">
                <p>{block.body}</p>
              </Prose>
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  );
}
