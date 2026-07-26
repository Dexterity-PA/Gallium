"use client";

import { BUFFER_DAYS, recoveredDaysToHalt } from "@/lib/derive/halt";
import { MODELED_NOTE } from "@/lib/data/bom";
import { Metric } from "@/components/ui/Metric";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { ACTION_CODE, money } from "@/components/resolve/rollup";
import type { ScenarioPlan } from "@/lib/derive/plan";

// Live rollup for the right rail. Metric treatment is deliberately identical
// to components/radar/ImpactSummary.tsx: 10px label, 32px value, 300ms
// count-up, so RADAR and RESOLVE read as one instrument.
//
// Every figure derives from the ScenarioPlan (lib/derive/plan.ts), which is
// the same model RADAR's simulate control drives, so the two rails cannot
// disagree about one scenario. At the default control the plan reproduces
// the authored figures exactly (guarded).

export function ActionImpact({
  plan,
  actionedIds,
  showScenario,
  onHoverAction,
}: {
  plan: ScenarioPlan;
  actionedIds: ReadonlySet<string>;
  /** True for a simulated (non-default) scenario: renders the gap line and
   *  the honest no-plan state, same (SIM) convention as RADAR. */
  showScenario?: boolean;
  onHoverAction?: (id: string | null) => void;
}) {
  const BASE_DAYS = plan.halt.daysToHalt;

  // The ledger accounts for every action the resolver proposes under this
  // scenario. The compliance action (kind LICENSE) recovers 2 lines but
  // contributes no cost/capital/schedule/days; its detail line renders on
  // the compliance axis rather than as "$0 · +0 DAYS".
  const ledgerActions = plan.actions.filter((a) => a.active);
  const actioned = ledgerActions.filter((a) => actionedIds.has(a.action.id));
  const ledgerActioned = actioned.length;

  const totals = {
    lines: actioned.reduce((n, a) => n + a.recovers, 0),
    incrementalCost: actioned.reduce((n, a) => n + a.incrementalCost, 0),
    capital: actioned.reduce((n, a) => n + a.capital, 0),
    scheduleWeeks: actioned.reduce((n, a) => Math.max(n, a.scheduleWeeks), 0),
    daysGained: actioned
      .filter((a) => a.action.kind !== "LICENSE")
      .reduce((n, a) => n + a.daysGained, 0),
  };
  const complete = totals.lines >= plan.observedResolvable;
  const buyPlanned = plan.actions.find((a) => a.action.kind === "BUY_AHEAD");

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
            <span className="text-dim"> / {plan.observedResolvable}</span>
          </>
        }
        tone={totals.lines > 0 ? "var(--focus)" : "var(--text-primary)"}
        sub={
          <>
            <span className="text-modeled">{plan.modeledExposed.length} MODELED</span>{" "}
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
        sub={
          totals.capital > 0 && buyPlanned?.coverageWeeks
            ? `${buyPlanned.coverageWeeks} WEEKS FORWARD COVERAGE`
            : "NO POSITION TAKEN"
        }
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

      {/* The honest failure state. Only reachable in a simulated scenario
          severe enough that even the full action set cannot cover what the
          disruption consumed; the product says so instead of manufacturing
          a plan that works. */}
      {showScenario && !plan.planCloses ? (
        <div
          className="pl-2 text-label leading-body text-critical"
          style={{ borderLeft: "2px solid var(--critical)" }}
        >
          ⚠ NO COMBINATION CLOSES THE GAP: {plan.gapDays}D CONSUMED,{" "}
          {plan.totalDaysGained}D RECOVERABLE ACROSS ALL PROPOSED ACTIONS.
        </div>
      ) : null}

      {/* per-action ledger: what each action contributed */}
      <div className="border-t border-rule pt-2">
        <div className="mb-2 flex items-center justify-between label">
          <span>Action Ledger</span>
          <span className="tabular-nums">
            {ledgerActioned} / {ledgerActions.length}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {ledgerActions.map((planned) => {
            const a = planned.action;
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
                    <>{planned.recovers} LINES · AFFILIATES SCREENING · RED FLAG 29</>
                  ) : (
                    <>
                      {planned.recovers} LINES ·{" "}
                      {planned.capital > 0
                        ? `${money(planned.capital)} CAP`
                        : money(planned.incrementalCost)}{" "}
                      · +{planned.daysGained} DAYS
                      {planned.scheduleWeeks > 0 ? ` · +${planned.scheduleWeeks}W SCHED` : ""}
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
          <span className="tabular-nums">{plan.modeledExposed.length}</span>
        </div>
        {plan.modeledExposed.map((line) => (
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
