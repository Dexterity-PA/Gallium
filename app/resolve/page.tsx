"use client";

import { useCallback, useState } from "react";
import type { Action } from "@/lib/types";
import {
  ACTIONS,
  OBSERVED_RESOLVABLE,
  MODELED_FLAGGED,
  LINES_REQUIRING_ACTION,
} from "@/lib/data/actions";
import { CUSTOMER } from "@/lib/data/customer";
import { useDemoClock, formatClock } from "@/lib/hooks/useDemoClock";
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

const SEED_LOG: LogEntry[] = [
  {
    key: "seed-event",
    t: "14:31:58",
    tag: "EVT-2026-0722-KHH",
    text: "MARITIME QUARANTINE — KAOHSIUNG · 14 BOM LINES EXPOSED",
    tone: "var(--critical)",
  },
  {
    key: "seed-resolver",
    t: "14:32:06",
    tag: "RESOLVER",
    text: `${ACTIONS.length} ACTIONS PROPOSED · ${OBSERVED_RESOLVABLE} OBSERVED RECOVERABLE · ${MODELED_FLAGGED} MODELED FLAGGED`,
  },
];

export default function ResolvePage() {
  const { clockMs } = useDemoClock();
  const [actioned, setActioned] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [modal, setModal] = useState<Action | null>(null);
  const [log, setLog] = useState<LogEntry[]>(SEED_LOG);

  const resolved = ACTIONS.filter((a) => actioned.has(a.id)).reduce(
    (n, a) => n + a.recovers,
    0
  );

  const onGenerate = useCallback(
    (a: Action) => {
      setModal(a);
      setActioned((prev) => {
        if (prev.has(a.id)) return prev;
        const next = new Set(prev);
        next.add(a.id);
        return next;
      });
      setLog((prev) => {
        if (prev.some((e) => e.key === a.id)) return prev;
        return [
          ...prev,
          {
            key: a.id,
            t: formatClock(clockMs),
            tag: `${a.id} · ${ACTION_CODE[a.id]}`,
            text: `${a.cta} · +${a.recovers} OBSERVED LINES RESOLVED`,
            tone: "var(--focus)",
          },
        ];
      });
    },
    [clockMs]
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
      {/* LEFT — every exposed line, live */}
      <Panel
        label="Exposed Lines"
        corner={`${resolved}/${LINES_REQUIRING_ACTION} RESOLVED`}
        className="h-full"
        noPad
        bodyClassName="overflow-hidden"
      >
        <ExposedLines actionedIds={actioned} hoveredActionId={hovered} />
      </Panel>

      {/* CENTRE — resolution state, the three actions, the log */}
      <Panel
        label={`Resolve — ${CUSTOMER.focusProduct.line} exposure`}
        corner={`${ACTIONS.length} ACTIONS · ${LINES_REQUIRING_ACTION} LINES`}
        className="h-full"
        noPad
        bodyClassName="flex min-h-0 flex-col overflow-hidden"
      >
        <ResolutionBar resolved={resolved} />

        {/* action rows run edge to edge and separate on their own hairlines —
            no gap, no surrounding pad, so nothing reads as a stack of cards */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex flex-col">
            {ACTIONS.map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                actioned={actioned.has(a.id)}
                onGenerate={onGenerate}
                onHover={onHover}
              />
            ))}
          </div>
        </div>

        <ResolutionLog entries={log} />
      </Panel>

      {/* RIGHT — live rollup, same metric treatment as RADAR */}
      <Panel
        label="Action Impact"
        corner="Q4 2026"
        className="h-full"
        noPad
        bodyClassName="overflow-auto"
      >
        <ActionImpact actionedIds={actioned} onHoverAction={onHover} />
      </Panel>

      <DocumentModal action={modal} onClose={() => setModal(null)} />
    </div>
  );
}
