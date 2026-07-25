"use client";

export type FilterKey = "ALL" | "EXPOSED" | "TIER2" | "MODELED" | "OWNERSHIP";

const CHIPS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "ALL" },
  { key: "EXPOSED", label: "EXPOSED" },
  { key: "TIER2", label: "TIER 2+" },
  { key: "MODELED", label: "MODELED" },
  { key: "OWNERSHIP", label: "OWNERSHIP" },
];

export function FilterChips({
  value,
  onChange,
  counts,
}: {
  value: FilterKey;
  onChange: (k: FilterKey) => void;
  counts: Record<FilterKey, number>;
}) {
  return (
    <div className="flex items-center gap-1">
      {CHIPS.map((c) => {
        const active = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className="flex h-row items-center gap-1 border px-2 label transition-colors"
            style={{
              borderColor: active ? "var(--focus)" : "var(--rule-strong)",
              color: active ? "var(--focus)" : "var(--text-secondary)",
            }}
          >
            {c.label}
            <span
              className="tabular-nums"
              style={{ color: active ? "var(--focus)" : "var(--text-dim)" }}
            >
              {counts[c.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
