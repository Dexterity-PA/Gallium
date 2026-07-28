import localFont from "next/font/local";

// Newsreader (Production Type for Google Fonts, SIL Open Font License 1.1),
// self-hosted, latin subset, variable weight 200 to 800 with an optical size
// axis. Declared here rather than in app/layout.tsx so the preload and the
// @font-face land only on routes that render it: the marketing page applies
// `siteSerif.variable` on its root, and the product under /app never pays for
// bytes it does not use.
//
// The site's monospace is NOT declared here on purpose. Ioskeley Mono is
// already self-hosted and preloaded by app/globals.css for the product;
// styles/site-tokens.css reuses that family via --site-font-mono instead of
// shipping the same woff2 files a second time through next/font.
export const siteSerif = localFont({
  src: [
    {
      path: "../../app/fonts/Newsreader-Variable.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "../../app/fonts/Newsreader-VariableItalic.woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
  variable: "--font-site-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});
