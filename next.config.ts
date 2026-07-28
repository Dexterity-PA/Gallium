import type { NextConfig } from "next";

// The six screens moved from "/<screen>" to "/app/<screen>" when "/" became
// the marketing page. Old links keep working. Next preserves the incoming
// query string on a redirect whose destination declares none of its own, so
// /exposure?product=MD-7200 and /radar?focus=... arrive intact.
// "/" is deliberately absent here: it is a real page now, not a redirect.
const SCREENS = [
  "portfolio",
  "radar",
  "exposure",
  "graph",
  "resolve",
  "hindsight",
];

const nextConfig: NextConfig = {
  async redirects() {
    return SCREENS.map((screen) => ({
      source: `/${screen}`,
      destination: `/app/${screen}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
