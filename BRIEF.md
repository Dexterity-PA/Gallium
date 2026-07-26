# BRIEF.md: Gallium Demo Build

## What this is

A clickable prototype of Gallium, a chip supply chain shock platform. It exists to be screen-recorded as a ~2 minute demo video for a YC application.

This is not production software. There is no backend, no auth, no database. Optimize for two things:

1. How it looks on camera
2. How smoothly a fixed click path plays

All data is synthetic or representative and must be labeled as such in the UI at all times.

## Companion documents

- `DESIGN.md`: visual system. Read before writing any UI. Wins any visual conflict.
- `DATA.md`: the mock dataset, schemas, and the truth ledger of what is real vs invented.
- `DEMO.md`: the click path and recording notes. Build so that path plays cleanly.

Also read `/mnt/skills/public/frontend-design/SKILL.md` before starting UI work. Apply its thinking about intentional design, but the density constraints in `DESIGN.md` are load-bearing and override any suggestion to add breathing room or soften the aesthetic.

---

## Stack

Next.js (App Router) + TypeScript + Tailwind. Deploy target Vercel.

```
react-force-graph-2d   graph, canvas-rendered
d3-geo                 map projection, hand-rolled SVG
topojson-client        world atlas parsing
recharts               small inline charts
framer-motion          transitions, drawer, layout animation
```

Note: do **not** use `react-simple-maps`. It has been unmaintained since 2023 and its peer dependencies stop at React 18, which conflicts with React 19. The map is hand-rolled SVG on `d3-geo`; the brief needs custom arc animation anyway, so the library was never buying much.

World atlas TopoJSON goes at `public/geo/world-110m.json`, loaded locally. No tile server, no API key, nothing that can fail to load while recording.

---

## File structure

```
app/
  layout.tsx              fonts, providers, global chrome
  page.tsx                redirect to /radar
  radar/page.tsx
  exposure/page.tsx
  graph/page.tsx
  resolve/page.tsx
  globals.css             design tokens

components/
  chrome/
    StatusBar.tsx
    Ticker.tsx
    NavRail.tsx
    ProvenanceBadge.tsx
    CommandPalette.tsx
  radar/
    EventFeed.tsx
    WorldMap.tsx
    ImpactSummary.tsx
  exposure/
    BomTable.tsx
    PartDrawer.tsx
    FilterChips.tsx
  graph/
    SupplyGraph.tsx
    GraphLegend.tsx
    ContaminationSequence.ts
  resolve/
    ActionCard.tsx
    ResolutionBar.tsx
    DocumentModal.tsx
  ui/
    Panel.tsx
    Metric.tsx
    StatusGlyph.tsx
    Scanline.tsx

lib/
  data/                   see DATA.md
    customer.ts
    event.ts
    bom.ts
    graph.ts
    sites.ts
    ticker.ts
    actions.ts
  hooks/
    useDemoClock.ts
    useCountUp.ts
    useSeededRandom.ts
  types.ts
```

---

## Global chrome

Present on every screen, never scrolls away.

### Top status bar (28px)

```
GALLIUM │ MERIDIAN DRIVE SYSTEMS │ ⬤ LIVE │ 14:32:07 UTC │ OBSERVED 1,847 / MODELED 412 │ ⌘K
```

- `⬤ LIVE` pulses green on a 2s cycle
- Clock ticks every second
- The observed/modeled counter is the moat story. It sits on screen for the entire video and ticks upward during it.
- Separators are 1px vertical `--border` rules, not pipe characters

### Bottom ticker (22px)

Continuous horizontal scroll, ~40s loop, items from `lib/data/ticker.ts`. Red for up-arrows on lead times and costs, green for down. Never pauses.

### Left nav rail (48px)

RADAR / EXPOSURE / GRAPH / RESOLVE, icon only. Active item takes a 2px `--amber` left border. Route changes are instant, no page transition animation.

### Provenance badge

Fixed bottom-right, above the ticker, 9px, `--text-lo`:

```
REPRESENTATIVE DATA · CUSTOMER IDENTIFIERS ANONYMIZED
```

Never removed, never faded, never repositioned for visual balance.

---

## Screen 1: RADAR

**Purpose:** Gallium watches everything, and it just caught something.

**Layout:** three columns. Left 380px event feed, center flexible map, right 320px impact summary. 1px gutters.

### Event feed (left)

Reverse-chronological, newest at top. Row format:

```
14:31:58  ▲ CRITICAL
MARITIME QUARANTINE: KAOHSIUNG
PRC customs inspection regime, outbound container
traffic. Air corridors unaffected.
SRC: 3 outlets · CONF 94%
```

- Timestamp 10px `--text-lo`, severity glyph colored by level
- Headline 11px `--text-hi` uppercase
- Body 11px `--text-mid`, max three lines
- Footer 9px `--text-lo`
- Row separator 1px `--border`

Behavior: six rows exist on load. Three more arrive on the timer defined in `DATA.md` (3.2s, 5.6s, 8.0s). Arriving rows slide in from the top over 180ms, pushing others down, flashing `--bg-elevated` for 400ms before settling. A blinking amber cursor block sits after the newest row.

### Map (center)

Hand-rolled SVG, `geoEquirectangular` from `d3-geo`.

- Land `#12151C`, borders 0.5px `#1E222C`, ocean `--bg-base`
- Sites render as 4px squares, not circles. Squares read more instrument-like.
- Kaohsiung: red square plus a pulsing ring, 2s expand-and-fade, continuous
- Shipping arcs as quadratic bezier curves with animated `stroke-dashoffset` so they flow toward Rockford
- Arcs from exposed origins: `--red`, dash animation stutters and stalls
- Unaffected arcs: `--text-lo`, flowing steadily
- Quarantine zone: translucent red polygon over the strait, 8% fill, 1px dashed border
- Hover a site: 1px cyan crosshair to panel edges, tooltip with site name, function, and count of parts affected

Do not add zoom or pan. Fixed framing, so every take is identical.

### Impact summary (right)

Four metrics, large, tweening on arrival:

```
BOM LINES EXPOSED        14 / 31
Q4 BUILD AT RISK         $2.6M
DAYS TO PRODUCTION HALT  52
TIER-2 CATCHES           3
```

Below them, a segmented bar: 31 segments, 14 turning red in a staggered cascade at 40ms intervals, triggered when the primary event lands.

---

## Screen 2: EXPOSURE

**Purpose:** which parts, how bad, and the catch their own systems missed.

Single dense table, 11px, 31 rows, ~18 visible, internal scroll.

Columns:

```
MPN │ DESCRIPTION │ MFR │ ERP ORIGIN │ ACTUAL EXPOSURE │ TIER │ LEAD TIME │ QTY/UNIT │ STATUS │ CONF
```

- Sortable headers, click to toggle
- Filter chips above: ALL / EXPOSED / TIER 2+ / MODELED
- Modeled rows in `--violet` with dashed left borders
- Row hover: `--bg-elevated` and 1px cyan left border

### The centerpiece row

`ISO5852SDW` gets a 2px `--amber` left border and a slow persistent pulse. Its ERP ORIGIN cell reads `USA` struck through in `--text-lo`; its ACTUAL EXPOSURE cell reads `TW-KAOHSIUNG` in `--red`, bold.

Clicking it opens a right drawer, 420px, 240ms slide:

```
ISO5852SDW · SUPPLY PATH

  WAFER FAB      Dallas, TX, USA           ● OBSERVED
  BACKEND A&T    ASE Kaohsiung, TW         ● OBSERVED
  DISTRIBUTION   Authorized channel        ● OBSERVED

  ⚠ CUSTOMER ERP LISTS ORIGIN AS "USA"

    Country-of-origin reflects wafer fabrication
    only. Assembly and test occur inside the
    quarantine zone. This exposure is invisible
    to ERP-based risk tools.

    SOURCES: supplier quality documentation,
    import records, manufacturer site disclosures
```

The warning block gets a 1px `--red` border at 30% opacity and `--red` at 6% background. It is the single most important text in the build; the entire video exists to land on it. Give it room within the drawer's density constraints and make sure it is fully legible at recording resolution.

---

## Screen 3: GRAPH

**Purpose:** the money shot. Build this one most carefully.

Force-directed, canvas, `react-force-graph-2d`. ~90 nodes, ~140 edges per `DATA.md`.

### Encoding

- Node fill by status: green clear, orange at risk, red exposed, violet modeled
- Node radius by `exposureValue`
- Observed edges: solid 1px `--border-hot`
- Modeled edges: dashed 1px `--violet` at 50%
- Active trace: `--cyan` 2px with flowing dash animation

### Contamination sequence

Scripted, six seconds, choreographed in `ContaminationSequence.ts`. Timing table is in `DATA.md` §5. Summary: Kaohsiung flares, propagation follows real topology node by node at 60ms stagger, 14 BOM nodes go red, center node ring turns amber, then the ISO5852SDW path lights cyan and holds with the label `TIER-2 EXPOSURE: NOT VISIBLE IN ERP`.

Must be replayable without page reload. `↻ REPLAY` control bottom-left, 10px, unobtrusive.

Run the sequence automatically on first mount of the route.

### Interaction

- Click node: isolate its subgraph, dim everything else to 15% opacity
- Drag to reposition, scroll to zoom
- Hover: tooltip card with label, kind, status, provenance, confidence

### Legend

Bottom-left, 9px, always visible. Must include the observed vs modeled distinction, because that is the part a viewer needs to read.

---

## Screen 4: RESOLVE

**Purpose:** Gallium does not just alert, it resolves.

Three action cards stacked vertically, expandable, content from `lib/data/actions.ts`.

Card anatomy:
- Title 11px uppercase `--text-hi`, recovery count right-aligned in `--green`
- Rationale 11px `--text-mid`, two lines max
- Metric grid, two columns, label 10px `--text-lo`, value 11px `--text-hi`
- Warning block where present, `--orange` border at 30%
- CTA button, bordered, 26px

Top of screen: resolution bar reading `14 EXPOSED → 0 UNRESOLVED` with a 14-segment progress indicator that fills as cards are actioned.

CTA buttons open a centered modal with a formatted document preview: freight authorization, qualification packet, purchase requisition. These do not need to generate real files. They need to render convincingly enough to hold for two seconds on camera.

---

## Command palette

`⌘K`. Centered, 560px, max 400px tall. The only element besides modals permitted a shadow. Fuzzy search across parts, suppliers, sites, and actions. Selecting a result navigates and highlights.

Even though the demo uses it once, it makes the application feel like a tool professionals live in.

---

## Tick engine

One hook, `useDemoClock`, drives all live motion:

| Channel | Interval | Behavior |
|---|---|---|
| Clock | 1s | Real time, UTC |
| Ticker values | 4s | Small seeded random walk |
| Lead times | 12s | Occasional +1 week increments |
| Observed counter | 20s | +1, always |
| Event feed | scripted | Arrivals at 3.2s, 5.6s, 8.0s |

Everything seeded from a fixed constant so takes are repeatable. A demo that plays differently each time cannot be cut cleanly.

---

## Build order

Sequential unless noted.

1. **Parallel:** (a) tokens + fonts + global chrome + nav, (b) all `lib/data/` modules fully typed, (c) `useDemoClock` + `useCountUp` + `useSeededRandom`. These three do not touch each other.
2. **EXPOSURE** table and drawer. Highest information density and hardest to fake, so do it first while attention is fresh, and it establishes the visual pattern everything else follows.
3. Review EXPOSURE in browser before continuing. Fix alignment and density issues now, not later.
4. **Parallel:** GRAPH, RADAR, RESOLVE. All three now have an established pattern to match.
5. Command palette.
6. Polish pass: column alignment, tabular numbers, hairline consistency, animation timing, legibility at 1080p.

---

## Acceptance checks

Before recording, verify:

- [ ] Every number uses tabular-nums and decimals align in every column
- [ ] No border radius above 2px anywhere
- [ ] No shadow except modal and command palette
- [ ] `--violet` appears only on modeled data
- [ ] Provenance badge visible on all four screens
- [ ] Contamination sequence replays cleanly five times in a row
- [ ] Observed counter has visibly incremented after two minutes
- [ ] Exposed line counts are consistent: 14 exposed, 6+4+4 recovered
- [ ] Nothing loads from the network at runtime
- [ ] Full click path in `DEMO.md` plays without a stall or layout shift
- [ ] Text is legible at 1080p, not just on a retina display up close

---

## Rules

- Never a border radius above 2px
- Never a shadow except modal and command palette
- Never a non-monospace font
- Never a number without tabular-nums
- Violet means modeled and nothing else, ever
- The provenance badge is never removed
- If the choice is prettier versus denser, choose denser
