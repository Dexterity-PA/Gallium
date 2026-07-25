"use client";

import { useMemo, useState } from "react";
import { PRIMARY_EVENT } from "@/lib/data/event";
import { CUSTOMER } from "@/lib/data/customer";
import {
  type ScenarioControlState,
  DEFAULT_SCENARIO_CONTROL,
  isDefaultScenarioControl,
} from "@/lib/data/scenario";
import {
  deriveScenarioImpact,
  BASELINE_LEAD_TIME_WEEKS,
  BUFFER_WEEKS,
} from "@/lib/derive/impact";
import { Metric } from "@/components/ui/Metric";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { LeadTimePressure } from "@/components/radar/LeadTimePressure";
import { ScenarioControl } from "@/components/radar/ScenarioControl";

// SCENARIO framing — every field is derived from lib/data (CUSTOMER,
// PRIMARY_EVENT), never a literal. The headline is split into its
// event-type and node halves; the timestamp is sliced (no Date/TZ drift).
// This block describes the fixed, scripted Kaohsiung event and never moves
// with the control below — it's the historical record, not the simulation.
const EVENT_TYPE = PRIMARY_EVENT.headline.split("—")[0].trim(); // "MARITIME QUARANTINE"
const NODE = PRIMARY_EVENT.headline.split("—").pop()!.trim(); // "KAOHSIUNG"
const TRIGGER_DAY = PRIMARY_EVENT.timestamp.slice(0, 10); // "2026-07-22"
const TRIGGER_TIME = PRIMARY_EVENT.timestamp.slice(11, 16); // "14:31"
const SCENARIO_NAME = `${CUSTOMER.focusProduct.line} × ${EVENT_TYPE}`;
const ZONE = PRIMARY_EVENT.zone;

function ScenarioField({
  label,
  value,
  tone = "var(--text-primary)",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className="truncate text-value tabular-nums" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

export function ImpactSummary({ active }: { active: boolean }) {
  // Scenario control state. Default value is a sentinel meaning "no
  // override" — lib/derive/impact.ts short-circuits it back to the scripted
  // baseline (today's Kaohsiung IMPACT). Any other value runs the live BFS
  // over GRAPH_ADJACENCY from the chosen origin. See lib/data/scenario.ts.
  const [control, setControl] = useState<ScenarioControlState>(DEFAULT_SCENARIO_CONTROL);
  const impact = useMemo(() => deriveScenarioImpact(control), [control]);
  const isBaseline = isDefaultScenarioControl(control);

  const exposed = useCountUp(active ? impact.bomLinesExposed : 0, { duration: 300, enabled: true });
  const risk = useCountUp(active ? impact.buildAtRisk / 1_000_000 : 0, { duration: 300, enabled: true });
  const days = useCountUp(active ? impact.daysToHalt : 0, { duration: 300, enabled: true });
  const catches = useCountUp(active ? impact.tier2Catches : 0, { duration: 300, enabled: true });

  const { halt } = impact;

  return (
    <div className="flex min-h-full flex-col gap-3 p-2">
      {/* SCENARIO — framing header for the panel, all fields derived */}
      <div className="shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="label">
            Scenario
          </span>
          <span className="text-label tabular-nums text-dim">
            {PRIMARY_EVENT.id}
          </span>
        </div>
        <div className="mt-1 text-value uppercase leading-snug text-primary">
          {SCENARIO_NAME}
        </div>
        <div className="mt-1 text-label leading-snug text-dim">
          {CUSTOMER.focusProduct.description}
        </div>

        <div className="mt-2 flex flex-col gap-2 border-y border-rule-strong py-1.5">
          <div className="grid grid-cols-2 gap-x-2">
            <ScenarioField label="Trigger" value={`${TRIGGER_DAY} ${TRIGGER_TIME}Z`} />
            <ScenarioField label="Severity" value={PRIMARY_EVENT.severity} tone="var(--critical)" />
          </div>
          <ScenarioField
            label="Affected Node"
            value={`${NODE} · ${ZONE.lat}°N ${ZONE.lng}°E · r${ZONE.radiusKm}KM`}
            tone="var(--critical)"
          />
          <div className="grid grid-cols-3 gap-x-2">
            <ScenarioField
              label={isBaseline ? "Exposed" : "Exposed (SIM)"}
              value={`${impact.bomLinesExposed}/${impact.bomLinesTotal}`}
              tone="var(--critical)"
            />
            <ScenarioField label="At Risk" value={impact.buildAtRiskLabel} />
            <ScenarioField label="Halt" value={`${impact.daysToHalt}D`} tone="var(--critical)" />
          </div>
        </div>
      </div>

      <ScenarioControl value={control} onChange={setControl} />

      <Metric
        label="BOM Lines Exposed"
        value={
          <>
            {Math.round(exposed)}
            <span className="text-dim"> / {impact.bomLinesTotal}</span>
          </>
        }
        tone="var(--critical)"
      />
      <Metric
        label="Q4 Build at Risk"
        value={`$${risk.toFixed(1)}M`}
        tone="var(--text-primary)"
        sub={`$6.1M × ${impact.bomLinesExposed}/${impact.bomLinesTotal} exposed lines`}
      />
      <Metric
        label="Days to Production Halt"
        value={Math.round(days)}
        tone="var(--critical)"
        sub={
          halt.bottleneck
            ? `${BUFFER_WEEKS * 7}D buffer − ${halt.erosionDays}D (${halt.bottleneck.mpn} ${halt.bottleneckLeadTimeWeeks}W, ${halt.overrunWeeks}W over ${BASELINE_LEAD_TIME_WEEKS}W baseline)`
            : "no exposed lines — full buffer"
        }
      />
      <Metric label="Tier-2 Catches" value={Math.round(catches)} tone="var(--focus)" />

      {/* segmented bar: 31 segments, exposed count cascades red at 40ms intervals */}
      <div className="mt-1 shrink-0">
        <div className="mb-1 flex items-center justify-between label">
          <span>EXPOSURE MAP</span>
          <span className="tabular-nums">
            {Math.round(exposed)}/{impact.bomLinesTotal}
          </span>
        </div>
        <div className="flex gap-px">
          {Array.from({ length: impact.bomLinesTotal }).map((_, i) => {
            const isExposed = i < impact.bomLinesExposed;
            const on = active && isExposed;
            return (
              <div
                key={i}
                className="h-4 flex-1"
                style={{
                  background: on ? "var(--critical)" : "var(--bg-elevated)",
                  border: "1px solid " + (on ? "var(--critical)" : "var(--rule)"),
                  transition: "background-color 200ms ease-out, border-color 200ms ease-out",
                  transitionDelay: on ? `${i * 40}ms` : "0ms",
                }}
              />
            );
          })}
        </div>
      </div>

      <LeadTimePressure active={active} />
    </div>
  );
}
