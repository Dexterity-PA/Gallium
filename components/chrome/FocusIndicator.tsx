"use client";

import { useFocusedPart } from "@/lib/focus";

// Cross-screen focused-part indicator. Mounted once, inside the StatusBar's
// flexible middle region, so every dashboard screen states which part the
// view is narrowed to without per-screen wiring.
//
// Contract with the unfocused frame: when focusedPart is null this renders
// null. No wrapper, no reserved width; the bar is pixel-identical to the
// clean tree.
//
// Colour: the FOCUS word takes --focus, which is exactly what the token
// means. That brings the bar to two RULE 4 colours (--ok on LIVE plus
// --focus here), the allowed maximum; --modeled on the counter is reserved
// vocabulary and does not count. Everything else in the segment is neutral,
// and the clear affordance matches the RESET / ⌘K buttons (label treatment,
// hover to --text-primary).
//
// The affordance is the ✕ glyph with no word next to it. It used to read
// "✕ CLEAR", which collided twice over: CLEAR is one of the three BOM
// statuses (StatusGlyph), so the label read as a claim about the focused
// part, and this bar already carries a RESET button three segments along
// that resets the whole demo. The glyph carries the meaning; the accessible
// name and the tooltip say which focus it drops.
//
// No Escape handler, deliberately: AppShell's window keydown closes the
// palette on Escape without checking whether it is open, and screen-level
// drawers/modals carry their own Escape handling. A global Escape here
// would clear focus underneath whichever surface the user was actually
// dismissing. The ✕ button is the affordance.

// Same 1px hairline the StatusBar uses between segments (separators are
// rules, not pipe characters).
function Div() {
  return <div className="h-full w-px shrink-0 bg-rule" />;
}

export function FocusIndicator() {
  const { focusedPart, clearFocus } = useFocusedPart();

  if (!focusedPart) return null;

  return (
    <>
      <Div />
      <div className="flex min-w-0 items-center gap-2 px-3">
        <span className="label shrink-0 text-focus">FOCUS</span>
        <span className="shrink-0 text-primary">{focusedPart.mpn}</span>
        <span
          className="min-w-0 truncate text-dim"
          title={focusedPart.description}
        >
          {focusedPart.description}
        </span>
        <button
          type="button"
          onClick={clearFocus}
          className="label flex shrink-0 items-center px-1 transition-colors hover:text-primary"
          title={`Drop focus on ${focusedPart.mpn}`}
          aria-label={`Drop focus on ${focusedPart.mpn}`}
        >
          <span aria-hidden>✕</span>
        </button>
      </div>
      <Div />
    </>
  );
}
