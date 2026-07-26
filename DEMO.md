# DEMO.md: Click Path & Recording Notes

The build exists to serve this two-minute path. If any implementation choice makes this path stutter, the implementation is wrong.

---

## 1. What the video is

A product demo prototype for a YC application. Roughly 2:00. Screen recording with voiceover.

This is **not** the founder video. That is a separate, required ~1 minute piece with all cofounders on camera. This one is optional and supplementary.

### Framing, non-negotiable

Say the word **prototype** in the first ten seconds. Something like: "This is a prototype of Gallium running on representative data."

Reasons this matters more than it might seem:
- The UI is being built for this video. Presenting it as shipped software is a misrepresentation YC can and does discover.
- The specific part-to-backend-site mapping is not publicly verified at part-number granularity. Describe it as representative.
- Honest framing costs nothing. A partner who discovers an overclaim after the fact costs you the application.

The `REPRESENTATIVE DATA` badge stays visible in every frame you use. Do not crop it out.

---

## 2. Click path (2:00)

| Time | Screen | Action | What the viewer sees |
|---|---|---|---|
| 0:00–0:08 | RADAR | Land on page, do nothing | Feed streaming, ticker scrolling, map arcs flowing, clock ticking. Establishes "this is live." |
| 0:08–0:20 | RADAR | Still nothing; let the timed events land | Congestion warning at 3.2s, carrier advisory at 5.6s, then the quarantine alert at 8.0s. Impact numbers count up. Segmented bar cascades red. |
| 0:20–0:30 | RADAR | Hover Kaohsiung on the map | Crosshair, tooltip, stalled red arcs against flowing grey ones. |
| 0:30–0:38 | EXPOSURE | Click nav, scroll the table slowly | Density. 31 rows, mixed status, violet modeled rows visible in passing. |
| 0:38–0:55 | EXPOSURE | Click the ISO5852SDW row. **Hold.** | Drawer opens. Supply path. Then the ERP warning block. This is the beat the entire video exists for, so hold it for a full six seconds, silent if needed. |
| 0:55–1:20 | GRAPH | Click nav, let the sequence auto-play | Kaohsiung flares, contamination propagates node by node, 14 BOM nodes go red, cyan trace holds on the Tier-2 path with its label. |
| 1:20–1:32 | GRAPH | Hover one modeled (violet) edge | Tooltip explaining modeled vs observed, and that it converts as coverage grows. The moat, stated in-product. |
| 1:32–1:50 | RESOLVE | Click nav, expand all three cards | Expedite, substitute with its re-qualification warning, buy-ahead. |
| 1:50–1:56 | RESOLVE | Click GENERATE FREIGHT AUTHORIZATION | Modal with formatted document. Hold two seconds. |
| 1:56–2:00 | RADAR | Click nav back | Resolution state. And the observed counter in the status bar has visibly incremented since 0:00. |

That final beat closes the loop: the number representing the data moat grew on camera during the demo.

---

## 3. Voiceover outline

Write to the visuals, not over them. Roughly 150–170 words total at a calm pace. Leave the drawer beat and the graph sequence largely silent and let them land.

**0:00** "This is a prototype of Gallium, running on representative data from a mid-market industrial controls manufacturer."

**0:08** "Gallium monitors everything that can break a chip supply chain. Right now it's picking up port congestion in Kaohsiung."

**0:20** "A customs quarantine. Ocean freight stalls. Air corridors stay open."

**0:38** "Fourteen of thirty-one lines on their highest-margin drive are exposed. But this one is the interesting one."

**0:45** *pause, let the drawer open*

**0:48** "Their ERP says this part is made in the USA. The wafer is. Assembly and test happen in Kaohsiung. Their own system told them they were safe."

**0:55** *silence through the graph sequence*

**1:20** "Solid edges are observed. Dashed are modeled. Every customer we add converts modeled edges into observed ones."

**1:32** "And then Gallium resolves it. Air freight what's already built. A qualified alternate, with the re-qualification timeline stated honestly. Buy ahead where lead times are about to move."

**1:56** "Fourteen exposed. Zero unresolved."

Do not oversell. The visuals carry it. Flat, confident delivery beats enthusiasm here.

---

## 4. Recording setup

**Resolution.** Record at 1920×1080 minimum. Set the browser window to exactly 1920×1080 with no browser chrome. Use Chrome in fullscreen (`⌘⌃F`) or a kiosk window. Zero visible tabs, bookmarks, or OS menu bar.

**Frame rate.** 60fps if your capture supports it. The graph animation and ticker scroll both look noticeably worse at 30.

**Display.** Record on the display you will export from. Recording on a retina display and exporting to 1080p softens the 10px labels badly. Test one take and look at the smallest text before committing.

**Cursor.** Enable cursor capture but disable click-highlight effects. A visible cursor helps the viewer follow; a yellow ring around every click looks like a tutorial video.

**Tools.** QuickTime is fine. OBS gives better control over frame rate and region. Either works.

**Audio.** Record voiceover separately and lay it over the screen capture. Live narration while clicking produces mouse noise and pacing errors.

---

## 5. Pre-recording checklist

Run through this immediately before the take.

- [ ] `npm run build && npm start`, recording the production build, not the dev server. Dev has HMR overhead and occasional flashes.
- [ ] Hard reload, confirm nothing loads from the network at runtime
- [ ] Contamination sequence replays cleanly five times in a row
- [ ] Full click path plays with no layout shift or stall
- [ ] Observed counter increments visibly across a two-minute window
- [ ] Provenance badge visible on all four screens
- [ ] Notifications silenced, Do Not Disturb on
- [ ] Browser zoom at exactly 100%
- [ ] All other applications closed, because background CPU load causes animation jitter
- [ ] Text legible at export resolution, checked on the smallest labels

---

## 6. Takes

Expect 5–10 takes. The timed feed arrivals mean the first twenty seconds cannot be rushed or re-cued mid-take; if you miss the window, reload and start over.

Record the four screens as one continuous take if you can. Cutting between screens is acceptable but continuous is more convincing, because it proves the app actually navigates.

Keep the best two takes before you start deleting. The one that felt worst while recording is sometimes the one that watches best.

---

## 7. Questions to expect

If this demo works, these come up in interview. Have answers ready.

**"Is this live?"**
No. It is a prototype built on representative data. Say it plainly and without hedging.

**"Where does Tier 2 data come from?"**
Supplier quality documentation, import records, manufacturer site disclosures. Partial coverage today. This is a real and defensible answer.

**"Where does Tier 3 come from?"**
It is modeled, and the product labels it as modeled. That labeling is deliberate: showing the difference between observed and inferred is a feature, not a hedge.

**"How do you get to full Tier 3 coverage?"**
Every customer added converts some modeled edges to observed. Be honest about the limits: suppliers treat sourcing as competitive information and some withhold it deliberately, coverage grows in clusters rather than evenly, and data a supplier shares generally cannot be resold into a competitor's map without consent. The compounding is real; completeness is not promised.

**"Is that specific part actually packaged at ASE Kaohsiung?"**
That mapping is not public at part-number granularity. It is representative. The pattern it illustrates, US-branded parts with backend assembly in Taiwan that are invisible to ERP country-of-origin fields, is real and common.

The instinct under pressure will be to firm these up. Do not. A founder who says "that part is modeled, here's why" reads as someone who understands their domain. A founder caught overclaiming reads as someone who does not.
