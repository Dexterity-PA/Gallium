"use client";

import {
  type ScenarioControlState,
  type ContainmentSeverity,
  SEVERITY_OPTIONS,
  DURATION_OPTIONS_DAYS,
  ORIGIN_OPTIONS,
  DEFAULT_SCENARIO_CONTROL,
  isDefaultScenarioControl,
} from "@/lib/data/scenario";

// Compact chip-button, matching components/exposure/FilterChips.tsx exactly.
// 1px --rule-strong at rest; --focus border and text when active, with no
// fill either way and no radius — a chip is a rule, not a filled pill.
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-row items-center px-2 label transition-colors"
      style={{
        border: "1px solid " + (active ? "var(--focus)" : "var(--rule-strong)"),
        color: active ? "var(--focus)" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

export function ScenarioControl({
  value,
  onChange,
}: {
  value: ScenarioControlState;
  onChange: (next: ScenarioControlState) => void;
}) {
  const isDefault = isDefaultScenarioControl(value);

  return (
    <div className="shrink-0 border-b border-rule-strong pb-1.5">
      <div className="flex items-baseline justify-between">
        {/* the three sub-labels below already name the axes; spelling them out
            here too wrapped the row and collided with RESET */}
        <span className="label truncate">Simulate</span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_SCENARIO_CONTROL)}
          disabled={isDefault}
          className="label transition-colors"
          style={{
            color: isDefault ? "var(--text-dim)" : "var(--focus)",
            cursor: isDefault ? "default" : "pointer",
            opacity: isDefault ? 0.5 : 1,
          }}
        >
          RESET
        </button>
      </div>

      {/* origin */}
      <div className="mt-2">
        <div className="mb-1 label">
          Affected Node
        </div>
        <select
          value={value.originId}
          onChange={(e) => onChange({ ...value, originId: e.target.value })}
          className="h-row w-full appearance-none bg-transparent px-2 text-value uppercase text-primary outline-none"
          style={{ border: "1px solid var(--rule-strong)" }}
        >
          {ORIGIN_OPTIONS.map((o) => (
            <option key={o.id} value={o.id} style={{ background: "var(--bg-elevated)" }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* severity */}
      <div className="mt-2">
        <div className="mb-1 label">
          Severity
        </div>
        <div className="flex flex-wrap gap-1">
          {SEVERITY_OPTIONS.map((s) => (
            <Chip
              key={s.value}
              active={value.severity === s.value}
              onClick={() => onChange({ ...value, severity: s.value as ContainmentSeverity })}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* duration */}
      <div className="mt-2">
        <div className="mb-1 label">
          Duration
        </div>
        <div className="flex flex-wrap gap-1">
          {DURATION_OPTIONS_DAYS.map((d) => (
            <Chip
              key={d}
              active={value.durationDays === d}
              onClick={() => onChange({ ...value, durationDays: d })}
            >
              {d}D
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
