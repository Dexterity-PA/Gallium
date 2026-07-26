"use client";

import { useCallback, useMemo, useState } from "react";
import type { Action } from "@/lib/types";
import { CUSTOMER } from "@/lib/data/customer";
import { useDemoClock, formatClock } from "@/lib/hooks/useDemoClock";
import { useScenario } from "@/lib/hooks/useScenario";
import { scenarioPlan, docScopeFor, type ScenarioPlan } from "@/lib/derive/plan";
import { ORIGIN_OPTIONS } from "@/lib/data/scenario";
import { Panel } from "@/components/ui/Panel";
import { ActionCard } from "@/components/resolve/ActionCard";
import { ResolutionBar } from "@/components/resolve/ResolutionBar";
import { DocumentModal } from "@/components/resolve/DocumentModal";
import { ExposedLines } from "@/components/resolve/ExposedLines";
import { ActionImpact } from "@/components/resolve/ActionImpact";
import { ResolutionLog, type LogEntry } from "@/components/resolve/ResolutionLog";
import { ACTION_CODE } from "@/components/resolve/rollup";

// Three-panel instrument, same column rhythm as RADAR (380 / flex / 320) with
// 1px hairline gutters so the screen reads as one continuous panel.
//
// The whole screen derives from the ScenarioPlan (lib/derive/plan.ts), which
// is driven by the same simulate control as RADAR. The workspace below is
// keyed on the control, so changing the scenario starts a fresh resolution
// session: a plan half-actioned against one disruption has no meaning
// against another. At the default control every figure and string is the
// scripted one (guarded in lib/derive/guards.ts).

function seedLog(plan: ScenarioPlan, isDefault: boolean): LogEntry[] {
  const proposedCount = plan.proposed.length;
  const first: LogEntry = isDefault
    ? {
        key: "seed-event",
        t: "14:31:58",
        tag: "EVT-2026-0722-KHH",
        text: `MARITIME QUARANTINE: KAOHSIUNG · ${plan.exposed.length} BOM LINES EXPOSED`,
        tone: "var(--critical)",
      }
    : {
        key: "seed-event",
        t: "14:31:58",
        tag: "SIMULATED",
        text: `${(
          ORIGIN_OPTIONS.find((o) => o.id === plan.control.originId)?.label ??
          plan.control.originId
        ).toUpperCase()} · ${plan.control.severity} · ${plan.control.durationDays}D · ${plan.exposed.length} BOM LINES EXPOSED`,
        tone: "var(--critical)",
      };
  return [
    first,
    {
      key: "seed-resolver",
      t: "14:32:06",
      tag: "RESOLVER",
      text: `${proposedCount} ACTIONS PROPOSED · ${plan.observedResolvable} OBSERVED RECOVERABLE · ${plan.modeledExposed.length} MODELED FLAGGED`,
    },
  ];
}

function ResolveWorkspace({ plan, isDefault }: { plan: ScenarioPlan; isDefault: boolean }) {
  const { clockMs } = useDemoClock();
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [modal, setModal] = useState<Action | null>(null);
  const [log, setLog] = useState<LogEntry[]>(() => seedLog(plan, isDefault));

  const proposed = plan.actions.filter((a) => a.active);
  const resolved = proposed
    .filter((a) => actioned.has(a.action.id))
    .reduce((n, a) => n + a.recovers, 0);

  const onGenerate = useCallback(
    (a: Action) => {
      setModal(a);
      setActioned((prev) => {
        if (prev.has(a.id)) return prev;
        const next = new Set(prev);
        next.add(a.id);
        return next;
      });
      const planned = plan.actions.find((p) => p.action.id === a.id);
      setLog((prev) => {
        if (prev.some((e) => e.key === a.id)) return prev;
        return [
          ...prev,
          {
            key: a.id,
            t: formatClock(clockMs),
            tag: `${a.id} · ${ACTION_CODE[a.id]}`,
            text: `${a.cta} · +${planned?.recovers ?? a.recovers} OBSERVED LINES RESOLVED`,
            tone: "var(--focus)",
          },
        ];
      });
    },
    [clockMs, plan]
  );

  const onHover = useCallback((id: string | null) => setHovered(id), []);

  return (
    <div
      className="grid h-full min-h-0"
      style={{
        gridTemplateColumns: "380px minmax(0, 1fr) 320px",
        gap: "1px",
        background: "var(--rule)",
      }}
    >
      {/* LEFT: every exposed line, live */}
      <Panel
        label="Exposed Lines"
        corner={`${resolved}/${plan.linesRequiringAction} RESOLVED`}
        className="h-full"
        noPad
        bodyClassName="overflow-hidden"
      >
        <ExposedLines plan={plan} actionedIds={actioned} hoveredActionId={hovered} />
      </Panel>

      {/* CENTRE: resolution state, the proposed actions, the log */}
      <Panel
        label={`Resolve · ${CUSTOMER.focusProduct.line} exposure`}
        corner={`${proposed.length} ACTIONS · ${plan.linesRequiringAction} LINES`}
        className="h-full"
        noPad
        bodyClassName="flex min-h-0 flex-col overflow-hidden"
      >
        <ResolutionBar
          resolved={resolved}
          resolvable={plan.observedResolvable}
          modeledFlagged={plan.modeledExposed.length}
        />

        {/* action rows run edge to edge and separate on their own hairlines,
            no gap, no surrounding pad, so nothing reads as a stack of cards */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex flex-col">
            {proposed.map((planned) => (
              <ActionCard
                key={planned.action.id}
                action={planned.action}
                planned={planned}
                actioned={actioned.has(planned.action.id)}
                showSufficiency={!isDefault}
                onGenerate={onGenerate}
                onHover={onHover}
              />
            ))}
          </div>
        </div>

        <ResolutionLog entries={log} />
      </Panel>

      {/* RIGHT: live rollup, same metric treatment as RADAR */}
      <Panel
        label="Action Impact"
        corner="Q4 2026"
        className="h-full"
        noPad
        bodyClassName="overflow-auto"
      >
        <ActionImpact
          plan={plan}
          actionedIds={actioned}
          showScenario={!isDefault}
          onHoverAction={onHover}
        />
      </Panel>

      <DocumentModal
        action={modal}
        scope={modal ? docScopeFor(plan, modal.id) : null}
        onClose={() => setModal(null)}
      />
    </div>
  );
}

export default function ResolvePage() {
  const { control, isDefault } = useScenario();
  const plan = useMemo(() => scenarioPlan(control), [control]);
  const planKey = `${control.originId}|${control.severity}|${control.durationDays}`;
  return <ResolveWorkspace key={planKey} plan={plan} isDefault={isDefault} />;
}
