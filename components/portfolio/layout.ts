/* ============================================================
   Shared band geometry for the PORTFOLIO screen.

   The panel is full bleed, so its right edge IS the viewport's right
   edge, and px-4 alone would leave right-aligned figures 16px from it,
   inside the 24px camera-safe margin this screen is recorded against.

   The scale has no 24px step and inventing one is not allowed
   (tokens.css RULE 7), but the same rule's spacing block states that the
   --sp-* vars exist precisely so inline styles and calc() can compose
   them. So the right inset is --sp-5 + --sp-4 = 28px: two real steps,
   no new value, 28px of clearance rather than 16.

   The left inset stays at px-4. It does not need the same treatment:
   content there already starts 48px in, past the nav rail.
   ============================================================ */

/** 28px, composed from two spacing steps. Applied to every band's right. */
export const BAND_PAD_RIGHT = "calc(var(--sp-5) + var(--sp-4))";

/** Inline style every full-bleed band on this screen shares. */
export const BAND_INSET: React.CSSProperties = {
  paddingRight: BAND_PAD_RIGHT,
};
