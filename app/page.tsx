import type { Metadata } from "next";

// Placeholder marketing page. Design comes later; this exists so "/" is a real
// page instead of a redirect, and so the product tree under /app can own all
// of the chrome and providers.
//
// Server component, no client boundary anywhere in it: the link is a plain
// anchor rather than next/link, so nothing from the product's client runtime
// is pulled above the marketing/product line. A hard navigation into /app is
// also the honest behaviour here, since that is where the providers mount.
//
// Everything it renders comes off existing tokens: --bg-base, --text-primary,
// --text-secondary, the --fs-hero / --fs-body type steps, and the --interactive
// pair that tokens.css RULE 9 reserves for "you can click this". Nothing new
// was added to tokens.css for it.

const POSITIONING =
  "The platform that watches everything that can break the chip supply chain, " +
  "from export rules to shortages to factories going down, and tells companies " +
  "which parts are hit and how to fix them before production stops.";

export const metadata: Metadata = {
  title: "Gallium",
  description: POSITIONING,
};

export default function MarketingPage() {
  return (
    <main className="flex h-full w-full flex-col items-center justify-center bg-base px-4">
      <div className="flex max-w-[62ch] flex-col items-center gap-6 text-center">
        <h1 className="text-hero font-bold tracking-[0.1em] text-primary">
          GALLIUM
        </h1>

        <p className="text-body leading-body text-secondary">{POSITIONING}</p>

        <a
          href="/app"
          className="label px-3 py-1.5 transition-colors hover:bg-elevated"
          style={{
            color: "var(--interactive)",
            border: "1px solid var(--interactive-dim)",
            borderRadius: "var(--radius-max)",
          }}
        >
          VIEW THE PRODUCT
        </a>
      </div>
    </main>
  );
}
