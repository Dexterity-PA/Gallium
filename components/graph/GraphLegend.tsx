// Graph legend (DESIGN/BRIEF Screen 3). Bottom-left, always visible. Each status
// is EXPLAINED, not just named — that meaning is the part a viewer needs — and
// the observed-vs-modeled edge distinction is spelled out.

function Row({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="shrink-0 text-[9px] leading-none" style={{ color }} aria-hidden>
        ●
      </span>
      <span className="w-[52px] shrink-0 tracking-[0.06em] text-[var(--text-mid)]">
        {label}
      </span>
      <span className="text-[var(--text-lo)]">{desc}</span>
    </div>
  );
}

export function GraphLegend() {
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[340px] select-none border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-base)_85%,transparent)] px-2 py-1.5 text-[9px] leading-[1.6] tracking-[0.02em]">
      <div className="flex flex-col gap-0.5">
        <Row color="var(--green)" label="CLEAR" desc="no exposure to the active scenario" />
        <Row color="var(--orange)" label="AT RISK" desc="indirect or partial exposure" />
        <Row color="var(--red)" label="EXPOSED" desc="routes through the affected node" />
        <Row
          color="var(--violet)"
          label="MODELED"
          desc="inferred from industry structure, not observed per part"
        />
      </div>
      <div className="mt-1 flex flex-col gap-0.5 border-t border-[var(--border)] pt-1">
        <div className="flex items-center gap-1.5 text-[var(--text-lo)]">
          <span className="inline-block h-0 w-5 border-t border-[var(--border-hot)]" />
          solid edge = observed relationship
        </div>
        <div className="flex items-center gap-1.5 text-[var(--text-lo)]">
          <span className="inline-block h-0 w-5 border-t border-dashed border-[var(--violet)]" />
          dotted edge = modeled
        </div>
      </div>
    </div>
  );
}
