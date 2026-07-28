import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site/seo";
import "./globals.css";
// Marketing-layer tokens. Scoped: everything in it keys off [data-site-root],
// which only app/page.tsx renders, so the product under /app is untouched.
import "../styles/site-tokens.css";

// Document shell only. Everything product-specific (the demo-state, scenario
// and focus providers, and the AppShell instrument chrome) now lives in
// app/app/layout.tsx, so the marketing page at "/" renders with none of it:
// no NavRail, no status bar, no command-palette keybinding, no client
// providers at all.
export const metadata: Metadata = {
  title: "Gallium",
  // Every route (including /app/*) inherits app/opengraph-image.tsx, and its
  // og:image URL must resolve absolutely. Without this, product routes baked
  // http://localhost:3000 into their static HTML at build time. SITE_URL is
  // the placeholder domain, pending approval; see lib/site/seo.ts.
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Ioskeley Mono is self-hosted and declared font-display: block in
            globals.css, so nothing paints text until it lands. Preload the
            two weights the chrome actually uses (400 body, 500 labels) to
            keep that hold short; 600/700 fetch on demand. */}
        <link
          rel="preload"
          href="/fonts/IoskeleyMono-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/IoskeleyMono-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
