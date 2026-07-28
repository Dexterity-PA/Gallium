#!/usr/bin/env node
// capture-site-shots.mjs
//
// Marketing-site screenshot harness. Captures six tight crops from the real
// product screens under /app against a PRODUCTION server, at the product's
// reference viewport (1512x857) and deviceScaleFactor 2, into
// public/site/shots/ plus a manifest.json describing every shot.
//
// Usage:
//   node scripts/capture-site-shots.mjs [baseUrl]
//   node scripts/capture-site-shots.mjs http://localhost:3121   (default)
//
// The server must be a production build of this repo (next build && next
// start). Do NOT point it at next dev: dev-only chrome (build indicators)
// would leak into the frames.
//
// Determinism notes:
// - Fixed viewport, fixed deviceScaleFactor, reducedMotion: reduce.
// - Crop rects are hard-coded CSS-px rectangles measured at 1512x857.
// - Every crop starts below the top chrome bar (y >= 27), so the live UTC
//   clock never enters a frame.
// - The supply graph's force layout is seeded (no Math.random), and both
//   map and graph animations are finite, so settled frames are stable.
// - Each screen gets a settle wait sized to its authored animations
//   (portfolio resolves at 900ms, the graph contamination sequence runs
//   6000ms end to end).
//
// Playwright: standalone playwright-core from the npx cache (no MCP browser,
// no new npm dependency).

import { execSync, execFileSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLAYWRIGHT_CORE =
  "/Users/main/.npm/_npx/6f4879659183bc49/node_modules/playwright-core/index.mjs";
const { chromium } = await import(PLAYWRIGHT_CORE);

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO_ROOT, "public", "site", "shots");
const BASE_URL = (process.argv[2] ?? "http://localhost:3121").replace(/\/$/, "");

const VIEWPORT = { width: 1512, height: 857 };
const DEVICE_SCALE_FACTOR = 2;
const MAX_BYTES = 300 * 1024; // over this, re-encode (downscale, then JPEG 85)

// The one focused part used everywhere a focus is needed: BOM-07, the
// Tier-2 ERP-blind gate driver (ERP says USA, actual exposure Kaohsiung).
const FOCUS_MPN = "ISO5852SDW";

// Crop rects are CSS px at 1512x857. Output pixels are 2x these values.
// Measured against commit 9bf6ae6 layouts; the assert() checks in each
// prepare() will fail loudly if a layout shift ever moves the content.
const SHOTS = [
  {
    file: "01-portfolio-rollup.png",
    route: "/app/portfolio",
    settleMs: 2200, // screen resolves from quiet to live at 900ms
    crop: { x: 49, y: 27, width: 1463, height: 172 },
    description:
      "Portfolio summary: screen header (7 PRODUCTS / 230 BOM LINES / 45 EXPOSED), " +
      "quarantine alert band, and the five-metric rollup (7 / 230 / 45 / $6.3M / 51 days).",
    prepare: async (page, assert) => {
      await assert(page.locator("text=MARITIME QUARANTINE"), "alert band went live");
      await assert(page.locator("text=$6.3M").first(), "$6.3M value at risk");
    },
  },
  {
    file: "02-exposure-struck-origin.png",
    route: "/app/exposure",
    settleMs: 2200, // ERP-reveal strike animation runs 0.9s
    crop: { x: 49, y: 54, width: 1463, height: 308 },
    description:
      "Exposure table: filter chips, column header, and the first eleven BOM rows. " +
      "Rows 7-9 are the Tier-2 catches with the ERP origin (USA) struck through and " +
      "the actual exposure resolved to TW-KAOHSIUNG; ISO5852SDW is the gate driver row.",
    prepare: async (page, assert) => {
      const row = page.locator("tr", { hasText: FOCUS_MPN }).first();
      await assert(row, "gate driver row present");
      const struck = await row
        .locator("td")
        .nth(4)
        .evaluate((td) => getComputedStyle(td.querySelector("span") ?? td).textDecorationLine);
      if (!String(struck).includes("line-through")) {
        throw new Error("ERP origin cell is not struck through on the gate driver row");
      }
    },
  },
  {
    file: "03-radar-isolated-path.png",
    route: `/app/radar?focus=${FOCUS_MPN}`,
    settleMs: 3500,
    crop: { x: 430, y: 200, width: 761, height: 400 },
    description:
      "Radar map with the shared focus set to the gate driver: the network dims and the " +
      "part's supply path isolates (Kaohsiung A&T / Taipei distribution to Dallas wafer fab " +
      "to Meridian Rockford). Map pane only; side panels are outside the crop.",
    prepare: async (page, assert) => {
      await assert(page.locator(`svg >> text=${FOCUS_MPN}`).first(), "focused part labeled on map");
      await assert(page.locator("svg >> text=KAOHSIUNG A&T").first(), "Kaohsiung node labeled");
      await assert(page.locator("svg >> text=Dallas wafer fab").first(), "Dallas node labeled");
    },
  },
  {
    file: "04-graph-exposed-path.png",
    route: "/app/graph",
    settleMs: 7500, // contamination sequence: origin 0ms, suppliers 1600ms, BOM lines 3600ms, header 5200ms, total 6000ms
    crop: { x: 65, y: 58, width: 1440, height: 790 },
    description:
      "Supply graph, exposed path fully fanned out: Kaohsiung backend A&T to 10 suppliers " +
      "(5 direct, 5 via zone sites) to 14 BOM lines, with the contamination-path banner, " +
      "provenance stats (16 obs / 8 mod) and the column legend.",
    prepare: async (page, assert) => {
      await assert(page.locator("text=CONTAMINATION PATH").first(), "contamination banner resolved");
      await assert(page.locator("text=14 BOM LINES").first(), "BOM-line column resolved");
    },
  },
  {
    file: "05-resolve-action-card.png",
    route: "/app/resolve",
    settleMs: 2200,
    crop: { x: 430, y: 80, width: 761, height: 310 },
    description:
      "Resolve: the AIR FREIGHT REROUTE action card expanded (units, incremental cost, " +
      "transit vs sea, covered MPNs, GENERATE FREIGHT AUTHORIZATION CTA) under the " +
      "0-observed-resolved progress header.",
    prepare: async (page, assert) => {
      await page.locator("text=AIR FREIGHT REROUTE").first().click();
      await page.waitForTimeout(1200);
      await assert(
        page.locator("text=GENERATE FREIGHT AUTHORIZATION").first(),
        "freight authorization CTA visible"
      );
    },
  },
  {
    file: "06-hindsight-ledger.png",
    route: "/app/hindsight",
    settleMs: 2200,
    crop: { x: 65, y: 56, width: 1447, height: 730 },
    description:
      "Hindsight detection ledger: FLAGGED 9D BEFORE ERP headline (3 caught, 1 missed, " +
      "median of 4 verified events) and all four event rows with flagged-vs-benchmark " +
      "timestamps and lead deltas, including the honest -5D miss.",
    prepare: async (page, assert) => {
      await assert(page.locator("text=FLAGGED 9D BEFORE ERP").first(), "ledger headline");
      await assert(page.locator("text=GUANGDONG BT LAMINATE SUBSTRATE SQUEEZE").first(), "last row");
    },
  },
];

function gitCommit() {
  return execSync("git rev-parse HEAD", { cwd: REPO_ROOT }).toString().trim();
}

function fileBytes(path) {
  return statSync(path).size;
}

// Re-encode an oversized PNG in place. First try downscaling the 2x raster
// to 1.5x (keeps PNG, keeps text crisp). If still over budget, fall back to
// JPEG quality 85 under a .jpg name. Returns { file, encoding, pixelScale }.
function shrink(outDir, file, cropWidth) {
  const path = join(outDir, file);
  let encoding = "png@2x";
  let pixelScale = 2;
  if (fileBytes(path) <= MAX_BYTES) return { file, encoding, pixelScale };

  const w15 = Math.round(cropWidth * 1.5);
  execFileSync("sips", ["--resampleWidth", String(w15), path], { stdio: "ignore" });
  encoding = "png@1.5x";
  pixelScale = 1.5;
  if (fileBytes(path) <= MAX_BYTES) return { file, encoding, pixelScale };

  const jpgFile = file.replace(/\.png$/, ".jpg");
  const jpgPath = join(outDir, jpgFile);
  execFileSync(
    "sips",
    ["-s", "format", "jpeg", "-s", "formatOptions", "85", path, "--out", jpgPath],
    { stdio: "ignore" }
  );
  unlinkSync(path);
  return { file: jpgFile, encoding: "jpeg-q85@1.5x", pixelScale: 1.5 };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const commit = gitCommit();
  console.log(`capture-site-shots: base=${BASE_URL} commit=${commit.slice(0, 7)}`);
  console.log(`output: ${OUT_DIR}`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    reducedMotion: "reduce",
  });
  // Route gate: /app screens bounce to the entry screen unless a BOM is
  // loaded. Same key AppShell reads (lib/hooks/useDemoState.tsx).
  await ctx.addInitScript(() => {
    window.localStorage.setItem(
      "gallium.demoState.v1",
      JSON.stringify({ loaded: true, summary: null })
    );
  });

  const page = await ctx.newPage();
  const results = [];
  let failed = 0;

  for (const shot of SHOTS) {
    const record = {
      file: shot.file,
      sourceRoute: shot.route,
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      crop: shot.crop,
      description: shot.description,
    };
    try {
      await page.goto(BASE_URL + shot.route, { waitUntil: "networkidle" });
      // Verify the route gate held: an unloaded state bounces to /app.
      const path = new URL(page.url()).pathname;
      if (path !== shot.route.split("?")[0]) {
        throw new Error(`route gate bounced to ${path}; expected ${shot.route}`);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(shot.settleMs);

      const assert = async (locator, what) => {
        if (!(await locator.count()) || !(await locator.first().isVisible())) {
          throw new Error(`content check failed: ${what}`);
        }
      };
      await shot.prepare(page, assert);

      // Pin the frame: the radar map runs infinite CSS animations (packet
      // dashes, ring pulses) whose phase would differ run to run. Every
      // finite animation has already settled, and every base style is the
      // resolved end state, so cancelling animations here yields the same
      // pixels every run. rAF-driven canvas work (the graph) is untouched
      // and already finished.
      await page.addStyleTag({
        content:
          "*, *::before, *::after { animation: none !important; transition: none !important; }",
      });
      await page.waitForTimeout(150);

      const outPath = join(OUT_DIR, shot.file);
      if (existsSync(outPath)) unlinkSync(outPath);
      await page.screenshot({ path: outPath, clip: shot.crop });

      const { file, encoding, pixelScale } = shrink(OUT_DIR, shot.file, shot.crop.width);
      record.file = file;
      record.encoding = encoding;
      record.pixelScale = pixelScale;
      record.bytes = fileBytes(join(OUT_DIR, file));
      record.status = "ok";
      console.log(
        `  ok  ${file}  ${record.bytes} bytes  crop ${JSON.stringify(shot.crop)}  ${encoding}`
      );
    } catch (err) {
      failed += 1;
      record.status = "failed";
      record.error = String(err && err.message ? err.message : err);
      console.error(`  FAIL ${shot.file}: ${record.error}`);
    }
    results.push(record);
  }

  await browser.close();

  const manifest = {
    generatedAt: new Date().toISOString(),
    commit,
    baseUrl: BASE_URL,
    server: "production (next build + next start) of this repo",
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    focusMpn: FOCUS_MPN,
    note:
      "All frames show the fictional sample dataset (Meridian Drive Systems / MD-7200). " +
      "No in-app sample badge exists on product screens; the marketing Figure frame " +
      "adds its own SAMPLE DATA label. Crops are CSS-px rects at 1512x857; pixel " +
      "dimensions are crop x pixelScale.",
    shots: results,
  };
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest: ${join(OUT_DIR, "manifest.json")}`);

  if (failed > 0) {
    console.error(`${failed} shot(s) FAILED`);
    process.exit(1);
  }
  console.log("all shots captured");
}

await main();
