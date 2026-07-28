import { HERO, SAMPLE_DATA_LABEL } from "@/lib/site/content";
import { Reveal } from "@/components/site/motion/Reveal";
import { HERO_MAP } from "./laneGeometry";
import HeroMap from "./HeroMap";

// The hero: the live Gallium map running slow and dim BEHIND the headline.
// Server component; the geometry is computed at module scope in
// laneGeometry.ts and only finished path strings cross to the client.
//
// The text block sits on a flat alpha scrim (no gradient) so the headline
// holds WCAG AA against the brightest pixel the map can put behind it,
// including the full-accent freight marker passing under the column.
// The map layer is pointer-events: none; nothing in it can steal a click
// from the headline, the actions, or the nav.

const SCRIM = "rgba(16, 18, 22, 0.58)"; // flat alpha over --site-bg, measured

export default function Hero() {
  const [primary, secondary] = HERO.actions;

  return (
    <section className="relative flex items-center overflow-hidden" style={{ minHeight: "100svh" }}>
      {/* the map, behind everything, non-interactive */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <HeroMap geo={HERO_MAP} />
      </div>

      {/* the honesty label: this is a live view of fictional sample data */}
      <span
        className="absolute select-none uppercase"
        style={{
          right: "var(--site-gutter)",
          bottom: "var(--site-sp-3)",
          fontFamily: "var(--site-font-mono)",
          fontSize: "var(--site-t-label)",
          letterSpacing: "var(--site-ls-label)",
          color: "var(--site-fg-dim)",
          background: "var(--site-recess)",
          border: "1px solid var(--site-rule-strong)",
          padding: "0.25rem 0.5rem",
        }}
      >
        {SAMPLE_DATA_LABEL}
      </span>

      <div
        className="relative mx-auto w-full"
        style={{
          maxWidth: "var(--site-max)",
          paddingLeft: "var(--site-gutter)",
          paddingRight: "var(--site-gutter)",
          paddingTop: "var(--site-sp-6)",
          paddingBottom: "var(--site-sp-6)",
        }}
      >
        {/* flat scrim exactly under the text block; negative margin keeps the
            text on the column grid while the scrim breathes past it */}
        <div
          style={{
            maxWidth: "44rem",
            background: SCRIM,
            padding: "var(--site-sp-4)",
            margin: "calc(-1 * var(--site-sp-4))",
          }}
        >
          <Reveal>
            <h1
              style={{
                fontFamily: "var(--site-font-text)",
                fontSize: "var(--site-t-hero)",
                lineHeight: "var(--site-lh-tight)",
                letterSpacing: "-0.015em",
                fontWeight: 500,
                color: "var(--site-fg)",
                margin: 0,
              }}
            >
              {HERO.headline}
            </h1>
            <p
              style={{
                fontFamily: "var(--site-font-text)",
                fontSize: "var(--site-t-body)",
                lineHeight: "var(--site-lh-body)",
                color: "var(--site-fg-dim)",
                maxWidth: "36rem",
                margin: "var(--site-sp-3) 0 0",
              }}
            >
              {HERO.sub}
            </p>
            <div
              className="flex flex-wrap items-center"
              style={{ gap: "var(--site-sp-2)", marginTop: "var(--site-sp-4)" }}
            >
              {/* hard navigation into the product on purpose: /app is the
                  product runtime, not a marketing route */}
              <a
                href={primary.href}
                className="uppercase no-underline"
                style={{
                  fontFamily: "var(--site-font-mono)",
                  fontSize: "var(--site-t-label)",
                  letterSpacing: "var(--site-ls-label)",
                  color: "var(--site-accent)",
                  border: "1px solid var(--site-accent)",
                  borderRadius: 2,
                  padding: "0.75rem 1.25rem",
                }}
              >
                {primary.label}
              </a>
              <a
                href={secondary.href}
                className="uppercase no-underline"
                style={{
                  fontFamily: "var(--site-font-mono)",
                  fontSize: "var(--site-t-label)",
                  letterSpacing: "var(--site-ls-label)",
                  color: "var(--site-fg)",
                  border: "1px solid var(--site-rule-strong)",
                  borderRadius: 2,
                  padding: "0.75rem 1.25rem",
                }}
              >
                {secondary.label}
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
