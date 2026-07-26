"use client";

import { ACTIONS, OBSERVED_RESOLVABLE, MODELED_FLAGGED } from "@/lib/data/actions";
import { IMPACT } from "@/lib/data/event";
import { BUFFER_DAYS, recoveredDaysToHalt } from "@/lib/derive/halt";
import { MODELED_NOTE } from "@/lib/data/bom";
import { Metric } from "@/components/ui/Metric";
import { useCountUp } from "@/lib/hooks/useCountUp";
import {
  ACTION_CODE,
  ACTION_ROLLUP,
  MODELED_LINES,
  money,
  rollup,
} from "@/components/resolve/rollup";

// Live rollup for the right rail. Metric treatment is deliberately identical
// to components/radar/ImpactSummary.tsx: 10px label, 32px value, 300ms
// count-up, so RADAR and RESOLVE read as one instrument.

// Inventory cover at the moment of the event. Derived in lib/derive/halt.ts
// and read through IMPACT so RESOLVE, RADAR and PORTFOLIO cannot disagree.
const BASE_DAYS = IMPACT.daysToHalt;

export function ActionImpact({
  actionedIds,
  onHoverAction,
}: {
  actionedIds: ReadonlySet<string>;
  onHoverAction?: (id: string | null) => void;
}) {
  const totals = rollup(actionedIds);
  const complete = totals.lines >= OBSERVED_RESOLVABLE;

  // The ledger now accounts for all four actions. The compliance action
  // (kind LICENSE) recovers 2 lines but contributes no cost/capital/schedule/
  // days. Its detail line is rendered on the compliance axis (below) rather
  // than as "$0 · +0 DAYS".
  const ledgerActions = ACTIONS;
  const ledgerActioned = ledgerActions.filter((a) =>
    actionedIds.has(a.id)
  ).length;

  // Runway is held to the buffer that actually exists. Re-routing a line
  // restores a route; it does not create inventory, so the recovered figure
  // cannot exceed BUFFER_DAYS. Unbounded, the four actions summed to 177 days
  // against a 70-day buffer.
  const projectedDays = recoveredDaysToHalt(BASE_DAYS, totals.daysGained);
  const appliedDays = projectedDays - BASE_DAYS;
  const isCapped = totals.daysGained > appliedDays;

  const lines = useCountUp(totals.lines, { duration: 300 });
  const cost = useCountUp(totals.incrementalCost, { duration: 300 });
  const capital = useCountUp(totals.capital, { duration: 300 });
  const days = useCountUp(projectedDays, { duration: 300 });

  return (
    // Right rail on a full-bleed screen: same 24px safe margin as RADAR's
    // ImpactSummary, which this panel is deliberately identical to.
    <div
      className="flex h-full flex-col gap-3 p-2"
      style={{ paddingRight: "var(--safe-inset)" }}
    >
      <Metric
        label="Lines Recovered"
        value={
          <>
            {Math.round(lines)}
            <span className="text-dim"> / {OBSERVED_RESOLVABLE}</span>
          </>
        }
        tone={totals.lines > 0 ? "var(--focus)" : "var(--text-primary)"}
        sub={
          <>
            <span className="text-modeled">{MODELED_FLAGGED} MODELED</span>{" "}
            FLAGGED, NOT RESOLVED
          </>
        }
      />

      <Metric
        label="Total Incremental Cost"
        value={money(cost)}
        tone="var(--text-primary)"
        sub="AIR FREIGHT + UNIT DELTA"
      />

      <Metric
        label="Capital Required"
        value={money(capital)}
        tone="var(--text-primary)"
        sub={totals.capital > 0 ? "11 WEEKS FORWARD COVERAGE" : "NO POSITION TAKEN"}
      />

      <Metric
        label="Schedule Impact"
        value={totals.scheduleWeeks === 0 ? "NONE" : `+${totals.scheduleWeeks} WEEKS`}
        tone={totals.scheduleWeeks === 0 ? "var(--text-primary)" : "var(--critical)"}
        sub={
          totals.scheduleWeeks === 0
            ? "NO RE-QUALIFICATION IN PATH"
            : "IEC 61800-5-1 RE-QUALIFICATION"
        }
      />

      <Metric
        label="Days to Production Halt"
        value={Math.round(days)}
        tone={complete ? "var(--focus)" : "var(--critical)"}
        sub={
          isCapped
            ? `BASELINE ${BASE_DAYS} · +${appliedDays} RECOVERED · ${BUFFER_DAYS}D CAP`
            : `BASELINE ${BASE_DAYS} · +${appliedDays} RECOVERED`
        }
      />

      {/* per-action ledger: what each action contributed */}
      <div className="border-t border-rule pt-2">
        <div className="mb-2 flex items-center justify-between label">
          <span>Action Ledger</span>
          <span className="tabular-nums">
            {ledgerActioned} / {ledgerActions.length}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {ledgerActions.map((a) => {
            const r = ACTION_ROLLUP[a.id];
            const on = actionedIds.has(a.id);
            return (
              <div
                key={a.id}
                onMouseEnter={() => onHoverAction?.(a.id)}
                onMouseLeave={() => onHoverAction?.(null)}
                className="border-l pl-2"
                style={{
                  borderLeftColor: on ? "var(--focus)" : "var(--rule)",
                  transition: "border-color 200ms ease-out",
                }}
              >
                <div className="flex items-baseline justify-between gap-2 text-body">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="text-label text-dim">
                      {ACTION_CODE[a.id]}
                    </span>
                    <span
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ color: on ? "var(--text-primary)" : "var(--text-secondary)" }}
                    >
                      {a.title}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-label"
                    style={{ color: on ? "var(--focus)" : "var(--text-dim)" }}
                  >
                    {on ? "✓ ACTIONED" : "PENDING"}
                  </span>
                </div>
                <div className="mt-1 text-label tabular-nums text-dim">
                  {a.kind === "LICENSE" ? (
                    <>{a.recovers} LINES · AFFILIATES SCREENING · RED FLAG 29</>
                  ) : (
                    <>
                      {a.recovers} LINES ·{" "}
                      {r.capital > 0
                        ? `${money(r.capital)} CAP`
                        : money(r.incrementalCost)}{" "}
                      · +{r.daysGained} DAYS
                      {r.scheduleWeeks > 0 ? ` · +${r.scheduleWeeks}W SCHED` : ""}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* the residual the product will not claim */}
      <div className="border-t border-rule pt-2">
        <div className="mb-2 flex items-center justify-between label">
          <span>Unresolved · Modeled</span>
          <span className="tabular-nums">{MODELED_LINES.length}</span>
        </div>
        {MODELED_LINES.map((line) => (
          <div
            key={line.id}
            className="flex items-baseline justify-between gap-2 text-body"
            style={{ height: "var(--row-h)" }}
          >
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-modeled">
              {line.mpn}
            </span>
            <span className="shrink-0 tabular-nums text-label text-dim">
              {line.confidence}% CONF
            </span>
          </div>
        ))}
        <p className="mt-2 text-label leading-relaxed text-dim">
          {MODELED_NOTE}
        </p>
      </div>
    </div>
  );
}
