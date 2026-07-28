// ============================================================================
// PLACEHOLDER PRICING, NOT APPROVED.
// These figures exist so the pricing section can be designed and verified.
// They have not been signed off by anyone and must not be quoted. A price
// changes here and nowhere else.
// ============================================================================

export type PricingTier = {
  id: string;
  name: string;
  /** Monospace figure, e.g. "$750". null renders as a conversation, no figure. */
  price: string | null;
  cadence: string | null;
  features: readonly string[];
};

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    id: "monitor",
    name: "MONITOR",
    price: "$750",
    cadence: "per month",
    features: [
      "one product line",
      "one BOM",
      "event radar and exposure flagging",
      "cited sources",
    ],
  },
  {
    id: "operate",
    name: "OPERATE",
    price: "$2,400",
    cadence: "per month",
    features: [
      "full portfolio",
      "multi-tier mapping",
      "ownership screening",
      "resolution actions",
      "generated documents",
    ],
  },
  {
    id: "enterprise",
    name: "ENTERPRISE",
    price: null,
    cadence: null,
    features: [
      "multiple sites",
      "custom supplier network depth",
      "API access",
      "per-incident resolution support",
    ],
  },
] as const;
