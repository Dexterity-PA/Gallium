# Gallium

Chip supply chain shocks, caught before your ERP notices them.

Gallium is a **prototype** built to demonstrate a product idea. It runs entirely
on synthetic data, has no backend, no accounts, and no integrations. Nothing in
it is a real customer, a real supplier, or a real event.

## What is fictional

Everything. In particular:

- **Meridian Drive Systems**, the industrial motion control manufacturer whose
  portfolio the app displays, does not exist.
- The **Kaohsiung maritime quarantine** the whole scenario turns on is an
  invented event. It did not happen.
- Every part number, supplier, lead time, cost, and dollar figure is fabricated
  for the demo. Some are shaped to resemble public industry patterns (for
  example a 2026 lead time spike), but no figure is a measurement of anything.

The app labels its own inferences on screen. Lines it treats as directly
observed are marked OBSERVED; lines inferred from network structure rather than
seen per part are marked MODELED and are never presented as resolved.

## The six screens

The demo starts by uploading a bill of materials as CSV (a sample lives in
`public/sample/`). Parsing and matching run in the browser, then the six
screens open:

| Screen | What it does |
|---|---|
| **PORTFOLIO** | The customer's seven products, which BOM lines are exposed, and what share of the quarter's build is at risk. |
| **RADAR** | The event on a world map: affected node, supply lanes, and the headline impact for the worst hit product. A SIMULATE panel re-runs the scenario at other severities and durations. |
| **EXPOSURE** | The full 31 line bill of materials for that product, with a per line drawer showing the supply path and where an ERP's country of origin disagrees with where the part is actually finished. |
| **GRAPH** | The supply network as a contamination model, showing how one site reaches the exposed BOM lines. Toggles between the exposed path and the full network. |
| **RESOLVE** | Four proposed mitigations, their cost, schedule, and how many days of production they buy back. Each generates a PDF document in the browser. |
| **HINDSIGHT** | A backtest record: four earlier events, whether the approach would have flagged them, and how far ahead of the ERP. |

A shared focus mechanism (⌘K) picks one part and carries it across all six
screens without leaving the screen you are on.

## Running it

```bash
npm install
npm run build && npm start
```

Data invariants are enforced as guards that run at module load, so a build fails
rather than rendering a screen whose numbers disagree with each other.

## Stack

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4. Maps are hand
rolled SVG over `d3-geo` with a local world atlas. The graph layout uses
`d3-force-3d` with a fixed seed so takes are repeatable. PDFs are generated
client side. Type is [Ioskeley Mono](https://github.com/ahatem/IoskeleyMono),
self hosted from `public/fonts`.
