import type { CSSProperties, ReactNode } from "react";
import { CountUp } from "@/components/site/motion/CountUp";
import type { SequenceData } from "./types";

// The three terminal-style panes of the product sequence, rendered on the
// Figure primitive's recessed surface. Everything inside is Ioskeley Mono.
// Semantic product colors are allowed in here because this reads as a
// product view: --critical carries its product meaning (exposure) on the
// quarantine tag and the state-3 figures, and nowhere decoratively.
//
// State 0: the ERP record as the customer's system believes it.
// State 1: the same record with origin struck through and the backend
//          assembly & test site resolved, source cited.
// State 2: the exposure figures. The 14-of-31 and $2.8M figures render
//          through CountUp; `live` gates mounting so the count runs when
//          the pinned sequence actually reaches state 3, not on page load.

const LABEL: CSSProperties = {
  fontFamily: "var(--site-font-mono)",
  fontSize: "var(--site-t-label)",
  letterSpacing: "var(--site-ls-label)",
  color: "var(--site-fg-dim)",
};

const VALUE: CSSProperties = {
  fontFamily: "var(--site-font-mono)",
  fontSize: "clamp(0.75rem, 0.71rem + 0.18vw, 0.875rem)",
  letterSpacing: "0.01em",
  lineHeight: 1.55,
  color: "var(--site-fg)",
};

function PaneTitle({ children }: { children: ReactNode }) {
  return (
    <div
      className="uppercase"
      style={{
        ...LABEL,
        padding: "0.75rem 1rem",
        // Clears the Figure primitive's SAMPLE DATA badge in the top-right.
        paddingRight: "7.5rem",
        borderBottom: "1px solid var(--site-rule)",
      }}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"
      style={{ padding: "0.6rem 1rem", borderTop: "1px solid var(--site-rule)" }}
    >
      <span className="uppercase shrink-0" style={LABEL}>
        {label}
      </span>
      <span className="min-w-0 text-right" style={VALUE}>
        {children}
      </span>
    </div>
  );
}

function Tag({
  critical = false,
  children,
}: {
  critical?: boolean;
  children: ReactNode;
}) {
  const ink = critical ? "var(--critical)" : "var(--site-fg-dim)";
  return (
    <span
      className="uppercase whitespace-nowrap"
      style={{
        fontFamily: "var(--site-font-mono)",
        fontSize: "0.625rem",
        letterSpacing: "0.08em",
        color: ink,
        border: `1px solid ${critical ? "var(--critical)" : "var(--site-rule-strong)"}`,
        borderRadius: 2,
        padding: "0.05rem 0.35rem",
        marginLeft: "0.5rem",
        verticalAlign: "middle",
      }}
    >
      {children}
    </span>
  );
}

function leadTimeText(weeks: number, delta: number): string {
  if (delta === 0) return `${weeks} wk`;
  const sign = delta > 0 ? "+" : "";
  return `${weeks} wk (${sign}${delta} wk vs prior quote)`;
}

const wholeFormat = (n: number) => `${Math.round(n)}`;
const moneyFormat = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export function StatePane({
  data,
  state,
  live,
}: {
  data: SequenceData;
  /** 0 = ERP record, 1 = resolution, 2 = exposure. */
  state: 0 | 1 | 2;
  /** Mount the CountUp figures (state 2 only). */
  live: boolean;
}) {
  const { part, source, exposure } = data;
  const scope = `${part.productLine} / ${part.bomId}`;

  if (state === 0) {
    return (
      <div>
        <PaneTitle>ERP record / {scope}</PaneTitle>
        <Row label="MPN">{part.mpn}</Row>
        <Row label="Manufacturer">{part.manufacturer}</Row>
        <Row label="Description">{part.description}</Row>
        <Row label="Country of origin">
          <span style={{ fontWeight: 500 }}>{part.erpOriginDisplay}</span>
        </Row>
        <Row label="Qty / unit cost">
          {part.qtyPerUnit} / ${part.unitCost.toFixed(2)}
        </Row>
        <Row label="Lead time">
          {leadTimeText(part.leadTimeWeeks, part.leadTimeDelta)}
        </Row>
      </div>
    );
  }

  if (state === 1) {
    return (
      <div>
        <PaneTitle>Gallium resolution / {scope}</PaneTitle>
        <Row label="MPN">{part.mpn}</Row>
        <Row label="Country of origin">
          <s
            style={{
              color: "var(--site-fg-dim)",
              textDecorationColor: "var(--site-fg-dim)",
            }}
          >
            {part.erpOriginDisplay}
          </s>
          <Tag>wafer fab only</Tag>
        </Row>
        {part.fabSite !== null && (
          <Row label="Wafer fab">
            <span style={{ color: "var(--site-fg-dim)" }}>{part.fabSite}</span>
          </Row>
        )}
        <Row label="Assembly & test">
          <span style={{ fontWeight: 500 }}>{part.backendSite}</span>
          <Tag>{part.backendProvenance}</Tag>
          {part.backendInQuarantineZone && <Tag critical>quarantine zone</Tag>}
        </Row>
        <Row label="Source">
          <span className="block">{source.id}</span>
          <span
            className="block"
            style={{ ...VALUE, color: "var(--site-fg-dim)", maxWidth: "34ch" }}
          >
            {source.title}
          </span>
        </Row>
        <Row label="Confidence">{part.confidence}%</Row>
      </div>
    );
  }

  return (
    <div>
      <PaneTitle>Exposure / {part.productLine}</PaneTitle>
      <div className="grid grid-cols-2">
        <div style={{ padding: "1.6rem 1rem 1.8rem" }}>
          <div className="uppercase" style={LABEL}>
            Lines exposed
          </div>
          <div
            style={{
              fontFamily: "var(--site-font-mono)",
              fontSize: "clamp(1.75rem, 1.35rem + 1.3vw, 2.75rem)",
              lineHeight: 1.15,
              color: "var(--critical)",
              marginTop: "0.4rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {live ? (
              <CountUp value={exposure.exposed} format={wholeFormat} />
            ) : (
              <span>{wholeFormat(0)}</span>
            )}
            <span
              style={{ color: "var(--site-fg)", fontSize: "0.5em" }}
            >
              {" "}
              of {exposure.total}
            </span>
          </div>
        </div>
        <div
          style={{
            padding: "1.6rem 1rem 1.8rem",
            borderLeft: "1px solid var(--site-rule)",
          }}
        >
          <div className="uppercase" style={LABEL}>
            Build at risk
          </div>
          <div
            style={{
              fontFamily: "var(--site-font-mono)",
              fontSize: "clamp(1.75rem, 1.35rem + 1.3vw, 2.75rem)",
              lineHeight: 1.15,
              color: "var(--critical)",
              marginTop: "0.4rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {live ? (
              <CountUp value={exposure.buildAtRisk} format={moneyFormat} />
            ) : (
              <span>{moneyFormat(0)}</span>
            )}
          </div>
        </div>
      </div>
      <Row label="Days to halt">{exposure.daysToHalt} days</Row>
      <Row label="Blind to the ERP">
        {part.bomId} / {part.mpn}
        <Tag critical>{part.backendSite}</Tag>
      </Row>
    </div>
  );
}
