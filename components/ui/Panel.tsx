// Every region of the screen is a panel (DESIGN.md §4). A panel carries NO
// border of its own: panels are separated from each other by the 1px --rule
// hairline gutters the page grid draws, so nothing reads as a card floating on
// a darker plane. Flat --bg-panel, 0 radius, no shadow, --fs-label corner
// label top-left, count/timestamp top-right.
//
// HEADER SAFE MARGIN. AppShell's <main> runs flush to the right edge of the
// window, so the right-most panel on every screen has its own right edge ON
// the viewport edge. At the header's original px-2 that put the corner label
// 8px from the glass: on HINDSIGHT, "4 EVENTS · MEDIAN 9D" read as clipped at
// laptop widths, and it was the same 8px on RADAR, EXPOSURE, GRAPH, RESOLVE
// and PORTFOLIO wherever a corner was passed.
//
// Only padding-RIGHT is widened, to --safe-inset (24px, defined in
// app/globals.css as --sp-5 + --sp-3). padding-left stays --sp-3 so the label
// on the left does not move at all, and the body block below is untouched, so
// this shifts exactly one glyph run per panel and no layout anywhere. The left
// side needs no inset: <main> begins after the 48px nav rail, so no panel's
// left edge is ever within 24px of the window.
//
// This is deliberately unconditional rather than an at-the-edge-only prop.
// An interior panel's corner label sitting 24px inside its own right edge is
// invisible against the same treatment on every other panel, whereas a prop
// would have to be threaded through every call site and would be wrong the
// moment a panel moved columns.

interface PanelProps {
  label?: string;
  corner?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPad?: boolean;
}

export function Panel({
  label,
  corner,
  children,
  className = "",
  bodyClassName = "",
  noPad = false,
}: PanelProps) {
  return (
    <section className={`flex min-h-0 min-w-0 flex-col bg-panel ${className}`}>
      {(label || corner) && (
        <div
          className="flex h-row shrink-0 items-center justify-between gap-2 border-b border-rule"
          style={{
            paddingLeft: "var(--sp-3)",
            paddingRight: "var(--safe-inset)",
          }}
        >
          {label ? <span className="label truncate">{label}</span> : <span />}
          {corner ? (
            <span className="label shrink-0 tabular-nums">{corner}</span>
          ) : null}
        </div>
      )}
      <div
        className={`min-h-0 min-w-0 flex-1 ${noPad ? "" : "p-2"} ${
          bodyClassName || "overflow-auto"
        }`}
        // Same safe margin as the header, for the same reason: the right-most
        // panel's body is flush to the window, so at p-2 its right-aligned
        // figures (CONF %, lead-time weeks, the action ledger) sat 8px off the
        // glass. Only the right is widened, and only when the panel owns its
        // padding: a noPad panel has handed layout to its child (HINDSIGHT
        // does this) and inflating it here would double-inset that child.
        style={noPad ? undefined : { paddingRight: "var(--safe-inset)" }}
      >
        {children}
      </div>
    </section>
  );
}
