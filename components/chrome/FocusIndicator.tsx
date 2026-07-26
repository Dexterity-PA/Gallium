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
// No Escape handler, deliberately: AppShell's window keydown closes the
// palette on Escape without checking whether it is open, and screen-level
// drawers/modals carry their own Escape handling. A global Escape here
// would clear focus underneath whichever surface the user was actually
// dismissing. The ✕ CLEAR button is the affordance.

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
          className="label flex shrink-0 items-center gap-1 transition-colors hover:text-primary"
          aria-label={`Clear focus on ${focusedPart.mpn}`}
        >
          <span aria-hidden>✕</span>
          <span>CLEAR</span>
        </button>
      </div>
      <Div />
    </>
  );
}
