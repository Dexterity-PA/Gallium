# DATA.md: Gallium Mock Dataset

All data in this application is synthetic or representative. No real customer is depicted. Manufacturer and part families are real and publicly documented; the mapping of specific parts to specific customers, quantities, exposures, and dollar figures is invented for demonstration.

Build these as typed TypeScript modules under `lib/data/`. No backend, no fetch, no database.

---

## 0. Truth ledger, read this first

Keep the demo defensible. Three categories:

**Real and publicly verifiable**
- Manufacturer names: Texas Instruments, ROHM, ASE Technology Holding, TSMC
- Part families: TI ISO5852S isolated gate driver, TI C2000 Piccolo MCU (TMS320F28027), ROHM IGBT IPM 600V modules, ROHM SiC Schottky diodes
- ASE is headquartered in Kaohsiung and is the world's largest OSAT
- Backend assembly and test is concentrated in Asia
- Lead times across top components spiked to roughly 40 weeks in early 2026, versus 20–25 weeks typical through 2025
- The Taiwan Strait is a major maritime chokepoint carrying about half the global container fleet
- Substituting a chip generally requires re-design or re-qualification, so it is not a fast fix

**Invented for the demo, plausible but not sourced**
- Meridian Drive Systems and every attribute of it
- The Kaohsiung quarantine event
- All quantities, dollar figures, day counts, confidence percentages
- The specific claim that a given TI part number is packaged at ASE Kaohsiung

**Never claim as verified**
The part-number-to-backend-site mapping is not public at this granularity. In the UI it is representative. In voiceover, say "representative." If asked in interview, the honest answer is that Gallium's Tier 2 sourcing comes from supplier quality documentation, import records, and manufacturer disclosures, and that coverage is partial today.

---

## 1. Customer

```ts
// lib/data/customer.ts
export const CUSTOMER = {
  name: 'Meridian Drive Systems',
  shortName: 'MERIDIAN',
  location: 'Rockford, IL, USA',
  segment: 'Industrial motion control',
  products: 'Variable-frequency drives for HVAC and pump applications',
  revenue: 180_000_000,
  revenueLabel: '$180M',
  employees: 340,
  activeBoms: 12,
  uniqueSkus: 2_400,
  focusProduct: {
    line: 'MD-7200',
    description: '3-phase VFD, 400/690 VAC, 22 kW class',
    bomLines: 31,
    quarterlyBuildValue: 6_100_000,
  },
} as const
```

Profile rationale: smaller EMS and industrial-controls firms draw roughly half their revenue from industrial, medical, and aerospace segments, versus about 12% for large providers. A $180M industrial-controls maker with 340 people sits squarely in that band.

---

## 2. Event

```ts
// lib/data/event.ts
export const PRIMARY_EVENT = {
  id: 'EVT-2026-0722-KHH',
  severity: 'CRITICAL',
  timestamp: '2026-07-22T14:31:58Z',
  headline: 'MARITIME QUARANTINE: KAOHSIUNG',
  body: 'PRC customs inspection regime declared for outbound container traffic, Kaohsiung and adjacent anchorages. Air corridors unaffected. Ocean freight holding at berth.',
  sourceCount: 3,
  confidence: 94,
  zone: { lat: 22.6, lng: 120.3, radiusKm: 180 },
} as const
```

Why a quarantine and not a blockade: a customs inspection regime is the more plausible near-term scenario, it stalls ocean freight while leaving air freight open, and that asymmetry is exactly what makes the resolution actions in Screen 4 sensible.

### Secondary feed events

Six pre-existing, three arriving on a timer. Mixed severity so the feed reads as a real monitor rather than a single-issue alert box.

```ts
export const FEED_EVENTS = [
  // pre-existing, oldest first when reversed
  { t: '13:58:12', sev: 'INFO',     head: 'ALLOCATION NOTICE: POWER DISCRETES',
    body: 'Distributor allocation tightening on 600V IGBT modules. Two authorized channels reporting.' },
  { t: '14:02:44', sev: 'INFO',     head: 'FAB UTILIZATION: MATURE NODES',
    body: 'Mature-node utilization up 0.4pt week-over-week across tracked foundries.' },
  { t: '14:09:31', sev: 'WARN',     head: 'LEAD TIME EXTENSION: OPTOCOUPLERS',
    body: 'Quoted lead times extending 3-5 weeks across isolation component category.' },
  { t: '14:15:07', sev: 'INFO',     head: 'EXPORT RULE: COMMENT PERIOD OPENS',
    body: 'Proposed rule affecting ownership screening thresholds enters public comment.' },
  { t: '14:21:53', sev: 'WARN',     head: 'TYPHOON ADVISORY: LUZON STRAIT',
    body: 'Tropical system tracking north. Shipping advisories issued, no closures yet.' },
  { t: '14:27:19', sev: 'INFO',     head: 'PRICE MOVEMENT: SUBSTRATE',
    body: 'BT substrate spot pricing up 2.1% month-over-month.' },
  // arriving on timer during the demo
  { t: '14:30:02', sev: 'WARN',     head: 'PORT CONGESTION: KAOHSIUNG',
    body: 'Berth wait times extending. Cause not yet attributed.', arrivesAtMs: 3200 },
  { t: '14:31:11', sev: 'WARN',     head: 'CARRIER ADVISORY: TW ROUTES',
    body: 'Two carriers issue schedule reliability warnings for Taiwan-origin lanes.', arrivesAtMs: 5600 },
  { t: '14:31:58', sev: 'CRITICAL', head: 'MARITIME QUARANTINE: KAOHSIUNG',
    body: 'PRC customs inspection regime, outbound container traffic. Air corridors unaffected.',
    arrivesAtMs: 8000, isPrimary: true },
]
```

The three timed arrivals build tension: congestion, then carrier advisories, then the cause. It reads as Gallium watching a situation develop.

---

## 3. Impact summary

```ts
export const IMPACT = {
  bomLinesExposed: 14,
  bomLinesTotal: 31,
  buildAtRisk: 2_600_000,
  buildAtRiskLabel: '$2.6M',
  daysToHalt: 52,
  tier2Catches: 3,
} as const
```

These are deliberately moderate. $2.6M against $6.1M quarterly build value on the focus line, and 52 days of inventory cover, are both defensible. Do not inflate them.

---

## 4. BOM: 31 lines

Schema:

```ts
export type Tier = 1 | 2 | 3
export type Status = 'CLEAR' | 'AT_RISK' | 'EXPOSED'
export type Provenance = 'OBSERVED' | 'MODELED'

export interface BomLine {
  id: string
  mpn: string
  description: string
  manufacturer: string
  erpOrigin: string          // what the customer's ERP believes
  actualExposure: string | null  // where the real exposure sits
  tier: Tier
  status: Status
  provenance: Provenance
  confidence: number         // 100 for observed, 55-75 for modeled
  leadTimeWeeks: number
  leadTimeDelta: number      // change vs prior quote
  qtyPerUnit: number
  unitCost: number
  erpBlind: boolean          // true when erpOrigin misleads
  supplyPath?: SupplyPathNode[]
}

export interface SupplyPathNode {
  stage: 'WAFER FAB' | 'BACKEND A&T' | 'DISTRIBUTION' | 'SUBSTRATE' | 'TEST'
  site: string
  provenance: Provenance
  inQuarantineZone: boolean
}
```

### The centerpiece line

```ts
{
  id: 'BOM-07',
  mpn: 'ISO5852SDW',
  description: 'Isolated IGBT gate driver, reinforced, 5.7kVrms',
  manufacturer: 'Texas Instruments',
  erpOrigin: 'USA',
  actualExposure: 'TW-KAOHSIUNG',
  tier: 2,
  status: 'EXPOSED',
  provenance: 'OBSERVED',
  confidence: 100,
  leadTimeWeeks: 38,
  leadTimeDelta: 12,
  qtyPerUnit: 6,
  unitCost: 4.85,
  erpBlind: true,
  supplyPath: [
    { stage: 'WAFER FAB',    site: 'Dallas, TX, USA',   provenance: 'OBSERVED', inQuarantineZone: false },
    { stage: 'BACKEND A&T',  site: 'Kaohsiung, TW',     provenance: 'OBSERVED', inQuarantineZone: true  },
    { stage: 'DISTRIBUTION', site: 'Authorized channel', provenance: 'OBSERVED', inQuarantineZone: false },
  ],
}
```

Six per unit is correct for a 3-phase inverter: one gate driver per IGBT, six IGBTs in a three-arm bridge. Details like this matter; a procurement person watching the video will check.

The ERP-blind warning text, rendered in the drawer:

```
⚠ CUSTOMER ERP LISTS ORIGIN AS "USA"

  Country-of-origin reflects wafer fabrication only.
  Assembly and test occur inside the quarantine zone.
  This exposure is invisible to ERP-based risk tools.

  SOURCES: supplier quality documentation, import
  records, manufacturer site disclosures
```

This is the most important text in the demo. It states the insight in plain language: their own systems told them the wrong thing.

### Remaining 30 lines

Compose as follows:

| Count | Character | Status | Tier | Provenance |
|---|---|---|---|---|
| 1 | The ISO5852SDW centerpiece | EXPOSED | 2 | OBSERVED |
| 2 | Other Tier-2 ERP-blind catches (a magnetics part, a passive array) | EXPOSED | 2 | OBSERVED |
| 4 | Direct Taiwan-sourced, procurement already knows | EXPOSED | 1 | OBSERVED |
| 4 | Exposed via distribution routing through the zone | EXPOSED | 2 | OBSERVED |
| 3 | Modeled Tier-3, substrate and leadframe inference | EXPOSED | 3 | MODELED |
| 5 | At risk, lead time extending but not zone-exposed | AT_RISK | 1–2 | OBSERVED |
| 12 | Clear | CLEAR | 1 | OBSERVED |

Real part families to distribute across the exposed and at-risk rows:

- `TMS320F28027PTT`: C2000 Piccolo MCU, Texas Instruments, control card
- `BM63577S-VC`: IGBT IPM 600V 30A, ROHM, power stage
- `SCS310AMC`: SiC Schottky 650V 10A, ROHM, freewheel path
- Isolation transformers, gate drive supply magnetics
- Electrolytic and film DC-link capacitors
- Current sense resistors, shunts
- Connectors, terminal blocks, PCB fabrication

The 12 clear lines can be mundane: passives, hardware, enclosure components. They exist to make 14/31 read as a real proportion rather than a designed one.

### Modeled rows

Three rows with `provenance: 'MODELED'`, `tier: 3`, confidence between 55 and 75. Rendered in `--violet`, dashed left border. Tooltip text:

```
MODELED: inferred from industry structure, not
per-part observed. Converts to OBSERVED as network
coverage grows.
```

That last sentence is the moat story, stated inside the product.

---

## 5. Graph

~90 nodes, ~140 edges. Enough to look complex, not so many it turns to mush.

```ts
export interface GraphNode {
  id: string
  label: string
  kind: 'CUSTOMER' | 'BOM' | 'SUPPLIER' | 'FAB' | 'BACKEND' | 'LOGISTICS'
  ring: 0 | 1 | 2 | 3
  status: Status
  provenance: Provenance
  exposureValue: number   // drives node radius
  lat?: number
  lng?: number
}

export interface GraphEdge {
  source: string
  target: string
  provenance: Provenance
  confidence: number
}
```

Structure:
- Ring 0: Meridian, single node, amber, larger
- Ring 1: 31 BOM line nodes
- Ring 2: ~28 suppliers and manufacturers
- Ring 3: ~30 fabs, backend assembly sites, logistics chokepoints

The Kaohsiung backend node (`NODE-KHH-ASE`) is the propagation origin. Its edges reach the ISO5852SDW BOM node plus 13 others along real topology paths.

Edge provenance: roughly 1,847 observed to 412 modeled in the global counter. In the visible graph, keep the ratio similar: about 115 observed edges, 25 modeled.

### Contamination sequence

Scripted, 6 seconds, replayable:

| t | Event |
|---|---|
| 0.0s | All nodes green. Graph settles into gentle drift. |
| 1.2s | `NODE-KHH-ASE` flares red. Three concentric rings pulse outward. |
| 1.8s | Propagation begins. Each affected node transitions green→red over 200ms, staggered 60ms, following actual edge topology. |
| 4.0s | 14 BOM nodes red. Meridian center node ring turns amber. |
| 5.0s | ISO5852SDW path highlights `--cyan` and holds. Label appears: `TIER-2 EXPOSURE: NOT VISIBLE IN ERP` |
| 6.0s | Settle. Resume drift. |

Must be replayable via a `↻ REPLAY` control, bottom-left, so takes can be re-shot without a page reload.

---

## 6. Map

Sites with coordinates, for the equirectangular projection:

```ts
export const SITES = [
  { id: 'NODE-KHH-ASE',  label: 'Kaohsiung backend A&T', lat: 22.63, lng: 120.30, exposed: true  },
  { id: 'NODE-HSC',      label: 'Hsinchu fab cluster',    lat: 24.81, lng: 120.97, exposed: true  },
  { id: 'NODE-TPE',      label: 'Taipei distribution',    lat: 25.03, lng: 121.57, exposed: true  },
  { id: 'NODE-DAL',      label: 'Dallas wafer fab',       lat: 32.78, lng: -96.80, exposed: false },
  { id: 'NODE-PEN',      label: 'Penang backend A&T',     lat:  5.41, lng: 100.33, exposed: false },
  { id: 'NODE-SGP',      label: 'Singapore distribution', lat:  1.35, lng: 103.82, exposed: false },
  { id: 'NODE-KUM',      label: 'Kumamoto fab',           lat: 32.80, lng: 130.71, exposed: false },
  { id: 'NODE-DRE',      label: 'Dresden fab',            lat: 51.05, lng: 13.74,  exposed: false },
  { id: 'NODE-ROC',      label: 'Rockford assembly',      lat: 42.27, lng: -89.09, exposed: false, isCustomer: true },
  { id: 'NODE-CHI',      label: 'Chicago inbound',        lat: 41.88, lng: -87.63, exposed: false },
]
```

Arcs run from origin sites to `NODE-ROC`. Arcs whose origin is `exposed: true` render red with a stalling dash animation. All others flow normally in `--text-lo`.

Quarantine zone polygon: translucent red over the strait around 22.6N 120.3E, 8% fill, 1px dashed border.

Map rendering is hand-rolled SVG using `d3-geo` `geoEquirectangular`, with world atlas TopoJSON stored locally at `public/geo/world-110m.json`. Do not use `react-simple-maps`; it has been unmaintained since 2023 and its peer dependencies stop at React 18.

---

## 7. Ticker (removed)

The bottom ticker described here has been removed from the app. There is no
`lib/data/ticker.ts` and no `components/chrome/Ticker.tsx`; no screen renders a
scrolling strip, and the space it occupied is now bottom safe-inset. This
section is kept only so the numbering of the sections below does not shift.

The 38-week gate driver lead time it used to carry survives in the lead-time
pressure panel, and is still anchored to the real March 2026 spike, where top
components reached roughly 40 weeks against a 20–25 week norm.

---

## 8. Resolution actions

```ts
export const ACTIONS = [
  {
    id: 'ACT-EXPEDITE',
    kind: 'EXPEDITE',
    title: 'AIR FREIGHT REROUTE',
    recovers: 6,
    covers: ['BOM-01', 'BOM-02', 'BOM-03', 'BOM-04', 'BOM-10', 'BOM-11'],
    rationale: 'Units already fabbed and in finished goods at Kaohsiung. Air corridors unaffected by quarantine.',
    metrics: [
      { label: 'UNITS',             value: '4,200' },
      { label: 'INCREMENTAL COST',  value: '$18,400' },
      { label: 'TRANSIT',           value: '4 DAYS', note: 'vs 31 sea' },
      { label: 'SCHEDULE IMPACT',   value: 'NONE' },
    ],
    cta: 'GENERATE FREIGHT AUTHORIZATION',
  },
  {
    id: 'ACT-SUBSTITUTE',
    kind: 'SUBSTITUTE',
    title: 'QUALIFIED ALTERNATE',
    recovers: 3,
    covers: ['BOM-07', 'BOM-08', 'BOM-09'],
    rationale: 'Alternate isolated gate driver, form-fit-function compatible. Different backend assembly footprint, no quarantine exposure.',
    metrics: [
      { label: 'PIN COMPATIBLE',    value: 'YES' },
      { label: 'ISOLATION RATING',  value: 'MEETS SPEC' },
      { label: 'RE-QUALIFICATION',  value: '3 WEEKS', warn: true },
      { label: 'UNIT DELTA',        value: '+$0.42' },
    ],
    warning: 'IEC 61800-5-1 re-qualification required. Timeline assumes existing test capacity.',
    cta: 'OPEN QUALIFICATION PACKET',
  },
  {
    id: 'ACT-BUYAHEAD',
    kind: 'BUY_AHEAD',
    title: 'INVENTORY POSITION',
    recovers: 2,
    covers: ['BOM-05', 'BOM-06'],
    rationale: 'Lead times on affected categories forecast to extend. Historical precedent: March 2026 spike, 20-25W to 40W across top components.',
    metrics: [
      { label: 'RECOMMENDED BUY',   value: '11 WEEKS COVERAGE' },
      { label: 'CAPITAL REQUIRED',  value: '$310,000' },
      { label: 'IF DELAYED 14D',    value: 'EST. +$95,000' },
    ],
    cta: 'EXPORT PURCHASE REQUISITION',
  },
]
```

6 + 3 + 2 = 11 OBSERVED lines recovered. This is the honest split, and it does **not** equal the exposed line count. The 14 exposed lines are 11 OBSERVED + 3 MODELED tier-3 lines (BOM-12/13/14); actions only ever recover the 11 OBSERVED lines. The 3 MODELED lines are FLAGGED, never resolved, because the product does not claim to resolve exposure it merely inferred (see §4 "Modeled rows", and `components/resolve/ResolutionBar.tsx` / `ActionImpact.tsx`, which render the 11-resolvable / 3-flagged split explicitly).

Do not "fix" this back to `6 + 4 + 4 = 14` to make the recovery total match the exposed count. That reintroduces the dishonest claim that modeled inference gets resolved. The counts are load-bearing: `covers` array lengths must be 6 / 3 / 2 (= each action's `recovers`), summing to 11 with no BOM line double-covered, and every covered line must be OBSERVED. `components/resolve/rollup.ts` asserts exactly this at import time and throws on drift.

The `covers` array on each action is the canonical action → BOM-line mapping (typed as `Action.covers` in `lib/types.ts`). The RESOLVE left-rail state transitions and card cross-highlighting derive from it.

The re-qualification warning is deliberate. Swapping an isolation component in an industrial drive triggers safety re-certification, and showing that Gallium knows this is what separates the demo from a mockup built by someone who has never touched a BOM.

---

## 9. Counters

```ts
export const COUNTERS = {
  observed: 1_847,
  modeled: 412,
}
```

The observed count increments by 1 every 20 seconds during the demo. Over a two-minute recording it visibly rises. That is the data moat rendered as a number on screen, and it is the detail most worth getting right.

---

## 10. Determinism

Every random-feeling behavior (feed arrival jitter, graph drift) must be seeded so takes are repeatable. Wrap in a `DemoClock` context with a fixed seed constant. A demo that plays differently every time is a demo you cannot cut.
