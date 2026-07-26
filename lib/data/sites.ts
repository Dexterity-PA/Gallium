import type { Site } from "@/lib/types";

// Provenance documents per site: exposed zone sites cite the customs/port
// notices; the customer site is our own ERP; other logistics nodes cite the
// logistics network. Every id resolves in lib/data/sources.ts.
function siteSources(s: Omit<Site, "sourceIds">): string[] {
  if (s.exposed) return ["SRC-KHH-CUSTOMS", "SRC-PORT-KHH"];
  if (s.isCustomer) return ["SRC-ERP-MERIDIAN"];
  return ["SRC-LOGI-NET"];
}

// Map sites for the equirectangular projection (DATA.md §6).
// Arcs run from each origin to NODE-ROC (Rockford). Exposed origins render
// red with a stalling dash; all others flow steadily in --text-lo.
const SITES_SEED: Omit<Site, "sourceIds">[] = [
  {
    id: "NODE-KHH-ASE",
    label: "Kaohsiung backend A&T",
    function: "Backend assembly & test",
    // Held a few hundredths east of the true position (22.63, 120.30): the
    // 110m land polygon cuts Taiwan's west coast inland of the real shoreline,
    // and the map must not draw this plant in the strait. graph.ts carries the
    // same value; SITES_AGREE_OK fails the build if the two ever split.
    lat: 22.63,
    lng: 120.42,
    exposed: true,
  },
  {
    id: "NODE-HSC",
    label: "Hsinchu fab cluster",
    function: "Wafer fabrication",
    // Same coastline nudge as Kaohsiung: true position is (24.81, 120.97).
    lat: 24.81,
    lng: 121.02,
    exposed: true,
  },
  {
    id: "NODE-TPE",
    label: "Taipei distribution",
    function: "Distribution hub",
    lat: 25.03,
    lng: 121.57,
    exposed: true,
  },
  {
    id: "NODE-DAL",
    label: "Dallas wafer fab",
    function: "Wafer fabrication",
    lat: 32.78,
    lng: -96.8,
    exposed: false,
  },
  {
    id: "NODE-PEN",
    label: "Penang backend A&T",
    function: "Backend assembly & test",
    lat: 5.41,
    lng: 100.33,
    exposed: false,
  },
  {
    id: "NODE-SGP",
    label: "Singapore distribution",
    function: "Distribution hub",
    lat: 1.35,
    lng: 103.82,
    exposed: false,
  },
  {
    id: "NODE-KUM",
    label: "Kumamoto fab",
    function: "Wafer fabrication",
    lat: 32.8,
    lng: 130.71,
    exposed: false,
  },
  {
    id: "NODE-DRE",
    label: "Dresden fab",
    function: "Wafer fabrication",
    lat: 51.05,
    lng: 13.74,
    exposed: false,
  },
  {
    id: "NODE-ROC",
    label: "Rockford assembly",
    function: "Customer assembly",
    lat: 42.27,
    lng: -89.09,
    exposed: false,
    isCustomer: true,
  },
  {
    id: "NODE-CHI",
    label: "Chicago inbound",
    function: "Inbound logistics",
    lat: 41.88,
    lng: -87.63,
    exposed: false,
  },
];

// Attach provenance documents; every exported site carries sourceIds.
export const SITES: Site[] = SITES_SEED.map((s) => ({
  ...s,
  sourceIds: siteSources(s),
}));

// Quarantine polygon over the Taiwan Strait (~22.6N 120.3E). Rough box around
// the strait; rendered at 8% red fill with a 1px dashed border.
export const QUARANTINE_ZONE: Array<[number, number]> = [
  // [lng, lat]
  [119.2, 21.6],
  [121.4, 21.9],
  [121.6, 23.6],
  [119.6, 23.3],
];

export const CUSTOMER_SITE_ID = "NODE-ROC";
