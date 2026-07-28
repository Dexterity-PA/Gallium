import type { Metadata } from "next";
import { siteSerif } from "@/lib/site/fonts";
import { POSITIONING } from "@/lib/site/content";
import { SITE_URL } from "@/lib/site/seo";

import SiteNav from "@/components/site/SiteNav";
import Hero from "@/components/site/hero/Hero";
import EventMarquee from "@/components/site/EventMarquee";
import Problem from "@/components/site/sections/Problem";
import Capabilities from "@/components/site/sections/Capabilities";
import Wedge from "@/components/site/sections/Wedge";
import ProductSequence from "@/components/site/sections/ProductSequence";
import Pricing from "@/components/site/sections/Pricing";
import Faq from "@/components/site/sections/Faq";
import ClosingCta from "@/components/site/sections/ClosingCta";
import SiteFooter from "@/components/site/SiteFooter";
import JsonLd from "@/components/site/JsonLd";

// ---- metadata ------------------------------------------------------------
// Agent J appends to this block (canonical, opengraph, twitter, JSON-LD
// wiring). J extends, never rewrites what is already here.
export const metadata: Metadata = {
  title: "Gallium",
  description: POSITIONING,
  // SITE_URL is a placeholder domain, pending approval; see lib/site/seo.ts.
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Gallium",
    description: POSITIONING,
    url: "/",
    siteName: "Gallium",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gallium",
    description: POSITIONING,
  },
};
// ---- end metadata --------------------------------------------------------

// The marketing page. Server component skeleton: every band is a Wave 1
// section slot. [data-site-root] is load-bearing; styles/site-tokens.css
// keys the scroll unlock and the site's base ink off it, and siteSerif's
// variable class scopes the Newsreader @font-face to this route only.
//
// Section anchor contract (nav links point at these):
//   #product -> ProductSequence, #pricing -> Pricing, #company -> ClosingCta.
export default function MarketingPage() {
  return (
    <div data-site-root className={siteSerif.variable}>
      <JsonLd />
      <SiteNav />
      <main>
        <Hero />
        <EventMarquee />
        <Problem />
        <Capabilities />
        <Wedge />
        <ProductSequence />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
