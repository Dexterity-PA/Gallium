import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { POSITIONING } from "@/lib/site/content";

// Social share card for the marketing page. Dark field, mono wordmark, one
// gold hairline, the positioning line. No photography, no gradients.
//
// Font strategy: satori (the renderer behind ImageResponse) supports
// TTF/OTF/WOFF but historically not WOFF2, and the committed brand fonts
// are all WOFF2 with no decoder in the dependency tree. So this route
// attempts a ladder and takes the first tier that actually renders:
//   1. Ioskeley Mono (wordmark) + Newsreader (positioning line)
//   2. Ioskeley Mono for everything
//   3. no custom fonts (next/og's bundled default face)
// Each tier is fully buffered before being returned, so a font parse
// failure falls through instead of streaming a 500.

export const alt =
  "Gallium. " + POSITIONING;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#e6e3dc";
const INK_MUTED = "#a8a49b";
const ACCENT = "#c2a05a";
const FIELD = "#101216";

type FontSpec = {
  name: string;
  data: ArrayBuffer;
  style: "normal";
  weight: 400 | 500;
};

function card(monoLoaded: boolean, serifLoaded: boolean) {
  // Satori crashes on style keys whose value is undefined, so the font
  // family keys are only added when the face actually loaded.
  const wordmarkFont: { fontFamily?: string } = {};
  if (monoLoaded) wordmarkFont.fontFamily = "Ioskeley Mono";
  const bodyFont: { fontFamily?: string } = {};
  if (serifLoaded) bodyFont.fontFamily = "Newsreader";
  else if (monoLoaded) bodyFont.fontFamily = "Ioskeley Mono";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: FIELD,
        padding: "80px 96px",
      }}
    >
      <div
        style={{
          display: "flex",
          ...wordmarkFont,
          fontSize: 92,
          fontWeight: 500,
          letterSpacing: "0.22em",
          color: INK,
        }}
      >
        GALLIUM
      </div>
      <div
        style={{
          display: "flex",
          width: 220,
          height: 2,
          backgroundColor: ACCENT,
          marginTop: 44,
          marginBottom: 44,
        }}
      />
      <div
        style={{
          display: "flex",
          ...bodyFont,
          fontSize: 34,
          lineHeight: 1.45,
          color: INK_MUTED,
          maxWidth: 940,
        }}
      >
        {POSITIONING}
      </div>
    </div>
  );
}

async function tryRender(
  fonts: FontSpec[],
  monoLoaded: boolean,
  serifLoaded: boolean,
): Promise<Response> {
  // `fonts: undefined` also crashes satori; omit the key when empty.
  const options: ConstructorParameters<typeof ImageResponse>[1] =
    fonts.length > 0 ? { ...size, fonts } : { ...size };
  const image = new ImageResponse(card(monoLoaded, serifLoaded), options);
  // Buffer the whole render so a satori font failure rejects here and the
  // caller can fall through to the next tier.
  const bytes = await image.arrayBuffer();
  return new Response(bytes, {
    headers: { "Content-Type": contentType },
  });
}

async function loadFont(
  relPath: string,
  name: string,
  weight: 400 | 500,
): Promise<FontSpec | null> {
  try {
    const buf = await readFile(join(process.cwd(), relPath));
    const data = Uint8Array.from(buf).buffer;
    return { name, data, style: "normal", weight };
  } catch {
    return null;
  }
}

export default async function Image() {
  const mono = await loadFont(
    "public/fonts/IoskeleyMono-Medium.woff2",
    "Ioskeley Mono",
    500,
  );
  const serif = await loadFont(
    "app/fonts/Newsreader-Variable.woff2",
    "Newsreader",
    400,
  );

  const tiers: Array<{ fonts: FontSpec[]; mono: boolean; serif: boolean }> = [];
  if (mono && serif) tiers.push({ fonts: [mono, serif], mono: true, serif: true });
  if (mono) tiers.push({ fonts: [mono], mono: true, serif: false });
  tiers.push({ fonts: [], mono: false, serif: false });

  let lastError: unknown = null;
  for (const tier of tiers) {
    try {
      return await tryRender(tier.fonts, tier.mono, tier.serif);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
