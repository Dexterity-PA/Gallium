import type { PDFFont } from "pdf-lib";

// ------------------------------------------------------------------
// Text layout helpers for the PDF renderer. The standard 14 PDF fonts
// (Courier, Courier-Bold) only encode WinAnsi/CP1252, not full
// Unicode. A handful of glyphs used elsewhere in the app's on-screen
// UI (warning triangle, the ohm sign) fall outside that set and would
// throw at draw time, so sanitizeForPdf maps the known offenders to
// an ASCII-safe equivalent and strips anything else unencodable as a
// last resort, rather than crashing PDF generation on live BOM text.
// ------------------------------------------------------------------

const GLYPH_MAP: Record<string, string> = {
  "⚠": "[!]", // WARNING SIGN
  "Ω": "OHM", // OHM SIGN
  "Ω": "OHM", // GREEK CAPITAL LETTER OMEGA (used for ohms in BOM text)
  "→": "->", // RIGHTWARDS ARROW
  "✓": "[OK]", // CHECK MARK
  "✕": "[X]", // MULTIPLICATION X
  "●": "*", // BLACK CIRCLE
  "⚑": "[FLAG]", // BLACK FLAG
  "▾": "", // BLACK DOWN-POINTING SMALL TRIANGLE
  "▸": "", // BLACK RIGHT-POINTING SMALL TRIANGLE
};

/** Map known non-WinAnsi glyphs to an ASCII-safe equivalent; strip the rest. */
export function sanitizeForPdf(input: string): string {
  let out = input;
  for (const [glyph, replacement] of Object.entries(GLYPH_MAP)) {
    if (out.includes(glyph)) out = out.split(glyph).join(replacement);
  }
  // Last-resort net: WinAnsi covers 0x20-0x7E and the Latin-1 supplement
  // (0xA0-0xFF); anything else still present at this point gets dropped
  // rather than throwing at draw time.
  return out.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

/** Greedy word-wrap against a font's actual glyph widths. */
export function wrapText(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  const clean = sanitizeForPdf(text);
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Single-line ellipsis truncation to a fixed pixel width. */
export function truncateToWidth(font: PDFFont, size: number, text: string, maxWidth: number): string {
  const clean = sanitizeForPdf(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  const ellipsis = "...";
  let out = clean;
  while (out.length > 0 && font.widthOfTextAtSize(out + ellipsis, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + ellipsis;
}
