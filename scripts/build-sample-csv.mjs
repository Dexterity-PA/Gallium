// Writes public/sample/MD-7200-BOM.csv from the data layer.
//
//   node scripts/build-sample-csv.mjs
//
// The file it writes is committed. It is the only way into the product now
// that the "use sample BOM" button is gone, so it has to be a real artifact
// on disk rather than something the app synthesizes at runtime.
//
// Every row is derived from lib/data/bom.ts (see lib/data/sampleUpload.ts).
// The module's own guards run at import, so a BOM edit that would break the
// 36/31/5 split fails this script rather than the recording.
//
// jiti (already present, Next depends on it) is what lets a plain .mjs import
// the TypeScript data layer with its "@/..." path alias intact.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });

const { buildErpExportCsv, ERP_EXPORT_ASSERTIONS, SAMPLE_CSV_PATH } =
  await jiti.import(resolve(root, "lib/data/sampleUpload.ts"));

const out = resolve(root, SAMPLE_CSV_PATH);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buildErpExportCsv(), "utf8");

const { rows, matched, unresolved } = ERP_EXPORT_ASSERTIONS;
console.log(`wrote ${SAMPLE_CSV_PATH}: ${rows} rows, ${matched} matched, ${unresolved} unresolved`);
