// Representative customer — invented for the demo (DATA.md §0, §1).
export const CUSTOMER = {
  name: "Meridian Drive Systems",
  shortName: "MERIDIAN",
  location: "Rockford, IL, USA",
  segment: "Industrial motion control",
  products: "Variable-frequency drives for HVAC and pump applications",
  revenue: 180_000_000,
  revenueLabel: "$180M",
  employees: 340,
  activeBoms: 12,
  uniqueSkus: 2_400,
  focusProduct: {
    line: "MD-7200",
    description: "3-phase VFD, 400/690 VAC, 22 kW class",
    bomLines: 31,
    quarterlyBuildValue: 6_100_000,
    quarterlyBuildLabel: "$6.1M",
  },
} as const;
