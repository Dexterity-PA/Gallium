// Every region of the screen is a panel (DESIGN.md §4). A panel carries NO
// border of its own: panels are separated from each other by the 1px --rule
// hairline gutters the page grid draws, so nothing reads as a card floating on
// a darker plane. Flat --bg-panel, 0 radius, no shadow, --fs-label corner
// label top-left, count/timestamp top-right.

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
        <div className="flex h-row shrink-0 items-center justify-between border-b border-rule px-2">
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
      >
        {children}
      </div>
    </section>
  );
}
