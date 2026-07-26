"use client";

import { useState } from "react";
import type { FeedEvent, BomLine, Article } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { FEED_EVENTS } from "@/lib/data/event";
import {
  severityColor,
  severityGlyph,
  statusColor,
  statusGlyph,
} from "@/components/ui/StatusGlyph";
import { SourcePanel } from "@/components/shared/SourcePanel";
import { getSources } from "@/lib/data/sources";
import { articlesForHeadline } from "@/lib/news/match";
import { ArticleModal } from "@/components/news/ArticleModal";

export interface FeedRow extends FeedEvent {
  key: string;
}

// Source count + confidence come straight from the data layer (never hashed).
// `conf` is the event's ConfidenceBand value; this is the ONLY confidence the
// feed renders, so it is always a band value (enforced by FEED_CONFIDENCE_OK
// in lib/data/event.ts).
//
// `src` is labelled OUTLETS, so it must count outlets. It used to count
// ev.sourceIds.length alone, which is the number of provenance DOCUMENTS, and
// three rows carry no document at all (ALLOCATION NOTICE, TYPHOON ADVISORY,
// PORT CONGESTION: channel chatter and an unattributed berth report). Those
// rows still match a news article in lib/news/match.ts, so the row rendered
// "SRC: 0 outlets" with a named outlet on the line directly beneath it.
//
// The count is the defect, not the rendering: both citation sets are real, and
// an outlet is an outlet whether it reaches us as a filed document or as
// published copy. So this counts DISTINCT outlets across both: the publisher
// behind each provenance document, plus each linked article's outlet. Deduped,
// because a document and an article can come from the same publisher and
// citing it twice would overstate corroboration.
function footerMeta(ev: FeedEvent, articles: Article[]): { src: number; conf: number } {
  const outlets = new Set<string>();
  for (const doc of getSources(ev.sourceIds)) outlets.add(doc.publisher);
  for (const a of articles) outlets.add(a.outlet);
  return { src: outlets.size, conf: ev.confidence };
}

// ---------------------------------------------------------------------------
// Event → BOM-line mapping. Derived in-component from lib/data/bom (never a
// literal list): each rule filters the real BOM, so the counts can't drift
// from EXPOSURE / RESOLVE. The two CRITICAL rows are pinned to the canonical
// sets (14 quarantine-EXPOSED, 2 ownership-FLAGGED); the rest match on the
// headline against real part descriptions / regions, and anything with no
// honest match falls through to "monitoring, no lines mapped".
// ---------------------------------------------------------------------------

type LineKind = "exposed" | "compliance" | "category" | "modeled" | "none";

interface EventLines {
  kind: LineKind;
  label: string; // plural noun for the lead count, e.g. "BOM LINES"
  lines: BomLine[];
}

const EXPOSED = BOM.filter((b) => b.status === "EXPOSED"); // the canonical 14
const tokenIn = (s: string | null | undefined, tok: string) =>
  !!s && s.toUpperCase().includes(tok);

function eventLines(ev: FeedEvent): EventLines {
  switch (ev.head) {
    // ---- the two CRITICAL rows: canonical sets ----
    case "MARITIME QUARANTINE: KAOHSIUNG":
      // every quarantine-exposed line (status === "EXPOSED") → 14
      return { kind: "exposed", label: "BOM LINES", lines: EXPOSED };
    case "OWNERSHIP RULE: AFFILIATES SCREENING RETURNS":
      // the affiliates-screening threshold crossers (ownership === "FLAGGED") → 2
      return {
        kind: "compliance",
        label: "COMPLIANCE LINES",
        lines: BOM.filter((b) => b.ownership === "FLAGGED"),
      };

    // ---- logistics precursors: geographic subsets of the 14 ----
    case "PORT CONGESTION: KAOHSIUNG":
      // exposed lines whose real exposure sits at the Kaohsiung node → 8
      return {
        kind: "exposed",
        label: "KAOHSIUNG LINES",
        lines: EXPOSED.filter((b) => tokenIn(b.actualExposure, "KAOHSIUNG")),
      };
    case "CARRIER ADVISORY: TW ROUTES":
      // exposed lines routed through Taipei distribution → 4
      return {
        kind: "exposed",
        label: "TAIPEI-ROUTED LINES",
        lines: EXPOSED.filter((b) => tokenIn(b.actualExposure, "TPE")),
      };

    // ---- category signals: keyword match on real descriptions ----
    case "LEAD TIME EXTENSION: OPTOCOUPLERS":
      // body scopes it to the isolation component category → 5
      return {
        kind: "category",
        label: "ISOLATION LINES",
        lines: EXPOSED.filter((b) =>
          /optocoupler|isolat|gate/i.test(b.description),
        ),
      };
    case "ALLOCATION NOTICE: POWER DISCRETES":
      // exposed power-stage discretes → 2. Isolation parts are excluded first
      // (mirrors LeadTimePressure's ordered rules) so the "Isolated IGBT gate
      // driver" stays gate-drive, not a power discrete.
      return {
        kind: "category",
        label: "POWER-STAGE LINES",
        lines: EXPOSED.filter(
          (b) =>
            /igbt|schottky|diode|rectifier|mosfet/i.test(b.description) &&
            !/optocoupler|isolat|gate|transformer driver/i.test(b.description),
        ),
      };
    case "PRICE MOVEMENT: SUBSTRATE":
      // the modeled tier-3 substrate line the spot move touches → 1 (MODELED)
      return {
        kind: "modeled",
        label: "PACKAGE LINES",
        lines: EXPOSED.filter((b) => /substrate|laminate/i.test(b.description)),
      };

    // ---- compliance precursor: the whole screening universe ----
    case "EXPORT RULE: COMMENT PERIOD OPENS":
      // proposed rule → every line under screening (ownership !== "CLEAR") → 7
      return {
        kind: "compliance",
        label: "SCREENING LINES",
        lines: BOM.filter((b) => b.ownership && b.ownership !== "CLEAR"),
      };

    // ---- macro signals with no honest per-part mapping ----
    default:
      return { kind: "none", label: "", lines: [] };
  }
}

// GUARD. The case labels above are literal string joins against the `head`
// values in lib/data/event.ts. Renaming a headline there without renaming it
// here does not fail the build and does not throw: every row simply falls
// through to `default` and reports "monitoring, no lines mapped", which looks
// like a design decision rather than a break. That is exactly what happened
// when the headline separator moved from an em dash to a colon.
//
// So assert the outcome rather than re-listing the labels (a second list would
// be its own drift): the two canonical rows must still resolve to the full
// EXPOSED set and to the ownership-FLAGGED set.
export const EVENT_LINE_MAP_OK = (() => {
  const problems: string[] = [];
  const primary = FEED_EVENTS.find((e) => e.isPrimary);
  if (!primary) {
    problems.push("no FEED_EVENTS row is marked isPrimary");
  } else if (eventLines(primary).lines.length !== EXPOSED.length) {
    problems.push(
      `primary row "${primary.head}" maps to ${eventLines(primary).lines.length} lines, expected ${EXPOSED.length}`
    );
  }
  const flagged = BOM.filter((b) => b.ownership === "FLAGGED").length;
  const compliance = FEED_EVENTS.find((e) => e.head.startsWith("OWNERSHIP RULE"));
  if (compliance && eventLines(compliance).lines.length !== flagged) {
    problems.push(
      `compliance row maps to ${eventLines(compliance).lines.length} lines, expected ${flagged}`
    );
  }
  if (problems.length) {
    const msg = `EventFeed: headline-to-BOM join is broken (${problems.join("; ")})`;
    if (process.env.NODE_ENV !== "production") throw new Error(msg);
    console.error(msg);
    return false;
  }
  return true;
})();

// The lead-count tone: red for logistics/compliance exposure, violet only when
// the touched line is MODELED data, muted when nothing is mapped.
function countTone(el: EventLines): string {
  if (el.kind === "modeled") return "var(--modeled)";
  if (el.kind === "none") return "var(--text-dim)";
  return "var(--critical)";
}

// Per-line glyph/tone. Compliance rows read on the ownership axis (red/amber),
// logistics rows on the status axis. MODELED provenance overrides to
// violet so the confidence layer stays reserved (DESIGN §2).
function lineTone(line: BomLine, kind: LineKind): string {
  if (kind === "compliance") {
    return line.ownership === "FLAGGED"
      ? "var(--critical)"
      : line.ownership === "REVIEW"
        ? "var(--text-primary)"
        : "var(--text-dim)";
  }
  if (line.provenance === "MODELED") return "var(--modeled)";
  return statusColor(line.status);
}

function lineGlyph(line: BomLine, kind: LineKind): string {
  if (kind === "compliance") {
    return line.ownership === "FLAGGED"
      ? "⚠"
      : line.ownership === "REVIEW"
        ? "◆"
        : "●";
  }
  return statusGlyph(line.status);
}

function Row({
  ev,
  flashing,
  expanded,
  onToggle,
}: {
  ev: FeedRow;
  flashing: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  // onToggle is fired by the row click; the parent both expands the row AND
  // flies the map to this event's affected node (see EventFeed.onEventClick).
  const el = eventLines(ev);
  // Provenance drill-in: additive, local to this row; does not affect the
  // row's own expand/collapse state.
  const [srcOpen, setSrcOpen] = useState(false);
  // Article drill-in (news pipeline), additive and local to this row. Which
  // articles back this row is computed independently in lib/news/match.ts
  // (keyword-matched on ev.head), not derived from eventLines/el above.
  // Resolved before footerMeta because the outlet count spans both sets.
  const articles = articlesForHeadline(ev.head);
  const { src, conf } = footerMeta(ev, articles);
  // SourcePanel renders nothing when a row has no provenance documents, so on
  // those rows the drill-in is the article chip below, not this control. Left
  // enabled it would be a click that silently does nothing.
  const hasDocs = ev.sourceIds.length > 0;
  const [openArticle, setOpenArticle] = useState<Article | null>(null);

  const rowCls = [
    "border-b border-rule border-l-2 px-2 py-1.5 cursor-pointer transition-colors duration-150",
    expanded
      ? "border-l-focus bg-elevated"
      : "border-l-transparent hover:border-l-focus hover:bg-elevated",
  ].join(" ");

  return (
    <div
      className={rowCls}
      style={
        flashing
          ? {
              animation:
                "row-flash 400ms ease-out, row-slide-in 180ms ease-out",
            }
          : undefined
      }
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-label tabular-nums text-dim">{ev.t}</span>
        <span
          className="text-label font-medium"
          style={{ color: severityColor(ev.sev) }}
        >
          {severityGlyph(ev.sev)} {ev.sev}
        </span>
        <span className="ml-auto text-label leading-none text-dim" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </div>

      <div className="mt-1 text-value uppercase leading-snug text-primary">
        {ev.head}
      </div>

      <div
        className="mt-1 overflow-hidden text-body leading-snug text-secondary"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }
        }
      >
        {ev.body}
      </div>

      {expanded ? (
        <div
          className="mt-2 border-t border-rule pt-1.5"
          style={{ animation: "row-slide-in 180ms ease-out" }}
        >
          {/* provenance: reuses footerMeta so the numbers match the collapsed
              footer exactly (ownership stays 2/97, quarantine 3/94) */}
          <button
            type="button"
            disabled={!hasDocs}
            onClick={(e) => {
              e.stopPropagation();
              setSrcOpen(true);
            }}
            className={`label flex w-full items-center justify-between ${
              hasDocs ? "transition-opacity hover:opacity-70" : "cursor-default"
            }`}
          >
            <span>PROVENANCE</span>
            <span className="tabular-nums text-secondary">
              SRC {src} OUTLET{src === 1 ? "" : "S"} · CONF {conf}%
            </span>
          </button>

          {el.kind === "none" ? (
            <div className="label mt-2">MONITORING · NO BOM LINES MAPPED</div>
          ) : (
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-body font-medium leading-none tabular-nums"
                  style={{ color: countTone(el) }}
                >
                  {el.lines.length}
                </span>
                <span className="label">{el.label}</span>
                {el.kind === "modeled" ? (
                  <span
                    className="ml-auto text-label"
                    style={{ color: "var(--modeled)" }}
                  >
                    ■ MODELED
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {el.lines.map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1 text-label leading-none tabular-nums"
                  >
                    <span style={{ color: lineTone(b, el.kind) }}>
                      {lineGlyph(b, el.kind)}
                    </span>
                    <span className="text-secondary">{b.mpn}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={!hasDocs}
          onClick={(e) => {
            e.stopPropagation();
            setSrcOpen(true);
          }}
          className={`label mt-1 block text-left ${
            hasDocs ? "transition-opacity hover:opacity-70" : "cursor-default"
          }`}
        >
          SRC: {src} outlet{src === 1 ? "" : "s"} · CONF {conf}%
          {el.kind === "none" ? " · MONITORING" : ` · ${el.lines.length} LN`}
        </button>
      )}
      <SourcePanel
        sourceIds={srcOpen ? ev.sourceIds : null}
        onClose={() => setSrcOpen(false)}
        context={ev.head}
      />

      {/* article drill-in: additive, new element; does not touch the
          PROVENANCE / SRC lines above (those are owned elsewhere). */}
      {articles.length > 0 ? (
        <div
          className="mt-1 flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-label text-dim" aria-hidden>
            ▤
          </span>
          {articles.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpenArticle(a)}
              className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap text-label text-focus underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-70"
              title={a.headline}
            >
              {a.outlet}
            </button>
          ))}
          <span className="label">
            · {articles.length} ARTICLE{articles.length === 1 ? "" : "S"}
          </span>
        </div>
      ) : null}
      <ArticleModal
        article={openArticle}
        onClose={() => setOpenArticle(null)}
      />
    </div>
  );
}

export function EventFeed({
  events,
  flashKey,
  onEventClick,
}: {
  events: FeedRow[];
  flashKey: string | null;
  onEventClick?: (ev: FeedRow) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="h-full overflow-auto">
      {/* blinking cursor sits after the newest row (top) */}
      <div className="flex items-center gap-2 px-2 pt-1.5">
        <span
          className="anim-cursor inline-block bg-focus"
          style={{ width: 6, height: 11 }}
          aria-hidden
        />
        <span className="label">
          MONITORING · {events.length} EVENTS · CLICK TO DRILL IN
        </span>
      </div>
      {events.map((ev) => (
        <Row
          key={ev.key}
          ev={ev}
          flashing={ev.key === flashKey}
          expanded={openKey === ev.key}
          onToggle={() => {
            setOpenKey((k) => (k === ev.key ? null : ev.key));
            onEventClick?.(ev);
          }}
        />
      ))}
    </div>
  );
}
