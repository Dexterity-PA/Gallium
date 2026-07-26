# DESIGN.md: Gallium Visual System

Read this before writing any UI. If any other document conflicts with this one on visual matters, this one wins.

Also read `/mnt/skills/public/frontend-design/SKILL.md` before starting. Apply its thinking about intentional, non-templated design, but note that the density constraints below are load-bearing and override any suggestion to loosen, soften, or add breathing room.

---

## 1. Reference points

The target is Bloomberg Professional, Palantir Foundry, and Linear's dark theme. Dense, monospaced, information-first, near-zero decorative chrome.

Explicitly NOT the target: generic dark SaaS dashboards, glassmorphism, gradient accents, hero sections, marketing polish, anything with a card that has 24px padding and a drop shadow.

The test for any element: would this look at home on a trading desk at 6am? If it looks like a landing page, it's wrong.

---

## 2. Color tokens

Define in `app/globals.css` as CSS custom properties, and mirror into `tailwind.config.ts` so both `var(--x)` and Tailwind utilities work.

```css
:root {
  /* surfaces */
  --bg-base:      #06070A;   /* near-black, slight blue cast */
  --bg-panel:     #0C0E13;
  --bg-elevated:  #12151C;
  --border:       #1E222C;
  --border-hot:   #2A303D;

  /* text */
  --text-hi:      #E8EAF0;
  --text-mid:     #8B93A7;
  --text-lo:      #545C70;

  /* semantic */
  --amber:        #FFB020;   /* primary accent, terminal signature */
  --red:          #FF4757;   /* exposed / critical */
  --orange:       #FF8C42;   /* at risk */
  --green:        #2ED573;   /* clear / nominal */
  --cyan:         #00D9FF;   /* selected / active trace */
  --violet:       #A78BFA;   /* modeled / inferred data ONLY */
}
```

### Violet is reserved

`--violet` means *modeled or inferred data* and nothing else, anywhere in the application, ever. Not decoration, not a secondary accent, not a hover state. This consistency is what makes the confidence layer read as a real product concept rather than a color choice.

### Semantic usage

| Token | Used for |
|---|---|
| `--amber` | Primary accent, active nav border, the focal BOM row, brand mark, scanline |
| `--red` | Exposed status, critical alerts, quarantine zone, rising lead times |
| `--orange` | At-risk status, warnings that are not yet critical |
| `--green` | Clear status, LIVE indicator, falling costs |
| `--cyan` | User selection, active trace path, hover focus |
| `--violet` | Modeled data, inferred edges, confidence values below 100% |

Status colors are never used decoratively. If something is green it is because its status is clear.

---

## 3. Typography

### Family
Monospace everywhere. No exceptions, including headings and numbers.

[Ioskeley Mono](https://github.com/ahatem/IoskeleyMono), self-hosted from `public/fonts` (weights 400/500/600/700) and declared with `@font-face { font-display: block }` in `app/globals.css`. No `next/font`, no webfont CDN.

Fallback stack: `'Ioskeley Mono', 'IBM Plex Mono', ui-monospace, monospace`

### Scale

| Role | Size | Weight | Tracking | Color |
|---|---|---|---|---|
| Headline metric | 32px | 500 | -0.02em | `--text-hi` |
| Secondary metric | 20px | 500 | -0.01em | `--text-hi` |
| Panel label | 10px | 500 | 0.12em | `--text-lo` |
| Table header | 10px | 500 | 0.10em | `--text-lo` |
| Table cell | 11px | 400 | 0 | `--text-mid` |
| Table cell, emphasized | 11px | 500 | 0 | `--text-hi` |
| Body / description | 12px | 400 | 0 | `--text-mid` |
| Micro / provenance | 9px | 400 | 0.06em | `--text-lo` |

Nothing above 32px. Nothing in body copy above 12px. Density is the aesthetic; large text reads as marketing.

All labels are UPPERCASE. All body copy is sentence case.

### Numbers

Every number in the application uses `font-variant-numeric: tabular-nums`. Set it globally:

```css
* { font-variant-numeric: tabular-nums; }
```

Decimals align in columns. Currency uses no cents above $1,000. Percentages always show one decimal place. Large numbers use thin-space or comma separators consistently: pick comma, use it everywhere.

---

## 4. Layout

### Page
- Full bleed. No max-width container, no page margin, no centered content column.
- `100vh`, no page-level scroll. Panels scroll internally.
- Grid gutters are 1px, filled with `--border`, so the whole screen reads as one continuous instrument panel rather than floating cards.

### Panels
Every region of the screen is a panel:
- Background `--bg-panel`
- Border `1px solid var(--border)`
- Radius `0px` (2px maximum, only if something genuinely needs it; default to 0)
- No shadow, no glow, no outline
- Internal padding 12px, never more than 16px
- Top-left: uppercase 10px label
- Top-right: timestamp or a count, 10px, `--text-lo`

### Spacing
8px base grid. Permitted values: 2, 4, 8, 12, 16, 24. Nothing else. No 20px, no 32px gaps.

### Fixed chrome
- Top status bar: 28px, always visible, every screen
- Bottom ticker: 22px, always visible, every screen
- Left nav rail: 48px, icon only, always visible
- Content area fills the remainder

---

## 5. Motion

### Durations
| Event | Duration | Easing |
|---|---|---|
| Data value change | 180ms | ease-out |
| Panel / drawer transition | 240ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Row insertion | 180ms | ease-out |
| Node status change | 200ms | ease-out |
| Modal open | 160ms | ease-out |

Nothing exceeds 300ms except the scripted graph sequence, which is choreographed separately.

### Rules
- Numbers tween, never snap. Use a counting hook or `framer-motion`'s `animate`.
- No spring physics. No bounce. No overshoot. Easing should be invisible.
- No hover animations that move layout. Hover changes color and shows crosshairs, nothing shifts position.
- One thing animates at a time. Simultaneous motion in multiple panels reads as noise.

### The scanline
When a panel recalculates, a single 1px `--amber` horizontal line sweeps top to bottom across it at 12% opacity over 600ms, then disappears. Only one panel at a time. This is the app's signature motion. Used sparingly, it reads as computation happening.

---

## 6. Texture details

These are what separate "dark theme" from "terminal." Each is cheap; together they carry the aesthetic.

1. **Grid overlay.** Panel backgrounds carry a 1px dot or line grid at 2% opacity, 8px pitch. Barely perceptible; adds substrate texture.
2. **Cursor block.** A 6x11px `--amber` block blinks at 530ms intervals after the last value in the live event feed.
3. **Hairlines.** All dividers are exactly 1px `--border`. Never 2px, never a gradient, never a "subtle" 0.5px.
4. **Corner labels.** Every panel labeled top-left, timestamped top-right. Consistency here does enormous work.
5. **Crosshair hover.** Hovering a map node or graph node draws a 1px cyan crosshair extending to the panel edges.
6. **Column alignment.** Monospace only helps if columns actually line up. Verify by eye at the end; misaligned decimals destroy the illusion faster than anything else.
7. **Status glyphs.** Use `▲ ▼ ● ⬤ ⚠ ↻` rather than icon components in data contexts. Terminals use characters.

---

## 7. Components

### Tables
- 11px, row height 24px, no zebra striping
- Header row: 10px uppercase, `--text-lo`, 1px bottom border `--border-hot`, sticky
- Row hover: background `--bg-elevated`, 1px `--cyan` left border
- Row selected: background `--bg-elevated`, 2px `--cyan` left border
- Numeric columns right-aligned, text columns left-aligned, status columns centered
- No cell padding beyond 8px horizontal, 0 vertical (row height handles it)

### Buttons
- Height 26px, 11px uppercase text, 0.08em tracking
- Default: 1px `--border-hot` border, transparent background, `--text-mid`
- Hover: border `--amber`, text `--amber`, no fill
- Primary action: 1px `--amber` border, `--amber` text, `--amber` at 8% background
- No filled buttons, no rounded buttons, no icons inside buttons unless the icon is a character glyph

### Drawer
Slides from right, 420px wide, 240ms. Background `--bg-panel`, 1px left border `--border-hot`. Content is not centered or padded generously; it uses the same 12px panel padding as everything else.

### Modal
The only element in the application permitted a shadow: `0 24px 64px rgba(0,0,0,0.7)`. Centered, 1px `--border-hot` border, `--bg-elevated` background.

### Command palette
`⌘K`. Centered, 560px wide, max 400px tall. Same shadow exception as modal. Monospace input, no placeholder styling flourish, results as a plain list with 11px rows.

---

## 8. Prohibitions

Absolute, no exceptions:

- No border radius above 2px
- No shadows except modal and command palette
- No non-monospace font
- No number without `tabular-nums`
- No use of `--violet` for anything except modeled data
- No gradient anywhere
- No emoji in the UI (character glyphs like `▲ ● ⚠` are fine)
- No element wider than its content needs
- No removal of the data provenance badge
- No text above 32px
- No spacing value outside the 8px grid set

When choosing between prettier and denser: choose denser.

---

## 9. Data provenance badge

Fixed, bottom-right, above the ticker, 9px, `--text-lo`, always present on every screen:

```
REPRESENTATIVE DATA · CUSTOMER IDENTIFIERS ANONYMIZED
```

This is not a design element to be tuned or removed for visual balance. It stays.
