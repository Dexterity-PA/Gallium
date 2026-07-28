import { CONTACT_EMAIL, PRICING_COPY } from "@/lib/site/content";
import { PRICING_TIERS, type PricingTier } from "@/lib/site/pricing";
import { Section, SectionHeader } from "@/components/site/primitives/Section";
import { Eyebrow } from "@/components/site/primitives/Eyebrow";
import { Prose } from "@/components/site/primitives/Prose";
import { Reveal } from "@/components/site/motion/Reveal";
import { RuleDraw } from "@/components/site/motion/RuleDraw";

// ============================================================================
// SECTION 05: PRICING
//
// EVERY FIGURE IN THIS SECTION IS A PLACEHOLDER, PENDING APPROVAL.
// No price is written here. All tiers, figures, and feature lists come from
// lib/site/pricing.ts, and the header copy from lib/site/content.ts, so a
// price changes in exactly one place and this component never goes stale.
//
// Form: a ruled table, not cards. Three columns at lg+ separated by vertical
// hairlines; stacked with horizontal hairlines below lg. No shadows, no
// badge, no toggle. ENTERPRISE has price null and renders as a conversation
// (a mailto link), never a figure.
// ============================================================================

// The price slot reserves one section-step line in every column so the
// feature lists start on the same horizontal at lg+, whether the tier shows
// a figure or the contact link.
const PRICE_SLOT_HEIGHT = "calc(var(--site-t-section) * var(--site-lh-heading))";

// Per-column frame. Stacked below lg, each feature list already closes with
// its own bottom hairline, so tiers after the first only need breathing room;
// at lg+ a left hairline separates the columns instead.
const CELL_FRAME = [
  "lg:pr-[var(--site-sp-4)]",
  "mt-[var(--site-sp-4)] lg:mt-0 lg:border-l [border-color:var(--site-rule)] lg:px-[var(--site-sp-4)]",
  "mt-[var(--site-sp-4)] lg:mt-0 lg:border-l [border-color:var(--site-rule)] lg:pl-[var(--site-sp-4)]",
] as const;

function TierColumn({ tier }: { tier: PricingTier }) {
  return (
    <div>
      <h3 className="m-0">
        <Eyebrow>{tier.name}</Eyebrow>
      </h3>

      <div
        className="flex items-end"
        style={{ minHeight: PRICE_SLOT_HEIGHT, marginTop: "var(--site-sp-2)" }}
      >
        {tier.price !== null ? (
          <div className="flex items-baseline" style={{ gap: "var(--site-sp-2)" }}>
            <span
              style={{
                fontFamily: "var(--site-font-mono)",
                fontSize: "var(--site-t-section)",
                lineHeight: "var(--site-lh-heading)",
                fontVariantNumeric: "tabular-nums",
                color: "var(--site-fg)",
              }}
            >
              {tier.price}
            </span>
            {tier.cadence !== null && (
              <span
                className="whitespace-nowrap"
                style={{
                  fontFamily: "var(--site-font-mono)",
                  fontSize: "var(--site-t-label)",
                  letterSpacing: "var(--site-ls-label)",
                  color: "var(--site-fg-dim)",
                }}
              >
                {tier.cadence}
              </span>
            )}
          </div>
        ) : (
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="lowercase underline underline-offset-4 transition-opacity hover:opacity-70"
            style={{
              fontFamily: "var(--site-font-mono)",
              fontSize: "var(--site-t-body)",
              lineHeight: "var(--site-lh-heading)",
              color: "var(--site-accent)",
              textDecorationColor: "var(--site-rule-strong)",
            }}
          >
            contact us
          </a>
        )}
      </div>

      <ul
        className="m-0 list-none p-0 border-b [border-color:var(--site-rule)]"
        style={{ marginTop: "var(--site-sp-3)" }}
      >
        {tier.features.map((feature) => (
          <li
            key={feature}
            className="border-t [border-color:var(--site-rule)]"
            style={{
              paddingBlock: "var(--site-sp-1)",
              fontFamily: "var(--site-font-text)",
              fontSize: "var(--site-t-body)",
              lineHeight: "var(--site-lh-body)",
              color: "var(--site-fg-dim)",
            }}
          >
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Pricing() {
  return (
    <Section
      id="pricing"
      ordinal={PRICING_COPY.ordinal}
      eyebrow={PRICING_COPY.eyebrow}
    >
      <Reveal>
        <SectionHeader>{PRICING_COPY.header}</SectionHeader>
        <Prose dim className="mt-[var(--site-sp-2)]">
          {PRICING_COPY.sub}
        </Prose>
      </Reveal>

      <div className="mt-[var(--site-sp-4)]">
        <Reveal amount={0.5}>
          <div className="flex justify-end pb-[var(--site-sp-1)]">
            <Eyebrow>{PRICING_COPY.disclaimer}</Eyebrow>
          </div>
        </Reveal>
        <RuleDraw strong />

        <div className="mt-[var(--site-sp-4)] grid grid-cols-1 lg:grid-cols-3">
          {PRICING_TIERS.map((tier, i) => (
            <Reveal
              key={tier.id}
              delay={i * 0.1}
              amount={0.2}
              className={CELL_FRAME[i] ?? ""}
            >
              <TierColumn tier={tier} />
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
