"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Action, BomLine } from "@/lib/types";
import { OBSERVED_EXPOSED } from "@/lib/data/actions";
import { linesFor, money } from "@/components/resolve/rollup";
import { OWNERSHIP_THRESHOLD_NOTE } from "@/lib/data/bom";
import { CUSTOMER } from "@/lib/data/customer";
import { SourcePanel } from "@/components/shared/SourcePanel";
import { DOC_TITLE, DOC_INTRO, DOC_META, ISSUE_DATE, ISSUER } from "@/lib/documents/content";
import { deriveLineItems, deriveAffiliateRows, affiliateSourceIds, dollars } from "@/lib/documents/derive";
import { downloadDocumentPdf } from "@/lib/documents/download";

// ------------------------------------------------------------------
// The four RESOLVE documents. Each renders as real paperwork off the
// SAME Action object: header + reference, an intro, a line-item table
// sourced from linesFor(action.id), a parameters/terms block built from
// action.metrics plus document-appropriate terms, and a signature /
// authorization block. LICENSE swaps the cost table for the two
// affiliates-flagged suppliers and their ownership chains.
//
// Honesty: every figure derives from real BOM fields (qtyPerUnit,
// unitCost, leadTimeWeeks) or action.metrics, nothing invented. Issue
// date is the fixed 2026-07-22. Signatories are ROLE placeholders only.
// The PREVIEW · REPRESENTATIVE marker stays.
//
// DOC_TITLE / DOC_INTRO / DOC_META / ISSUE_DATE / ISSUER now live in
// lib/documents/content.ts, and the line-item / affiliates arithmetic
// lives in lib/documents/derive.ts, so the on-screen preview below and
// the downloadable PDF (lib/documents/pdf.ts) read the exact same
// derivation instead of each authoring their own copy.
// ------------------------------------------------------------------

const TABLE_COLS = "16ch minmax(0,1fr) 3ch 4ch 6ch 7ch";
const TABLE_GAP = "8px";

function SectionLabel({ children, corner }: { children: string; corner?: string }) {
  return (
    <div className="mb-2 mt-2 flex items-center justify-between border-b border-rule-strong pb-1">
      <span className="label">
        {children}
      </span>
      {corner ? (
        <span className="text-label tabular-nums text-dim">
          {corner}
        </span>
      ) : null}
    </div>
  );
}

function Field({
  k,
  v,
  accent,
  tag,
}: {
  k: string;
  v: string;
  accent?: "modeled" | "critical" | "resolved";
  tag?: string;
}) {
  const color =
    accent === "modeled"
      ? "var(--modeled)"
      : accent === "critical"
      ? "var(--critical)"
      : accent === "resolved"
      ? "var(--focus)"
      : "var(--text-primary)";
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule py-1">
      <span className="shrink-0 label">
        {k}
      </span>
      <span className="flex items-baseline gap-2 text-right">
        {tag ? (
          <span
            className="text-label"
            style={{ color: accent === "modeled" ? "var(--modeled)" : "var(--text-dim)" }}
          >
            {tag}
          </span>
        ) : null}
        <span className="tabular-nums text-body" style={{ color }}>
          {v}
        </span>
      </span>
    </div>
  );
}

/* ---- cost-document line-item table (EXPEDITE / SUBSTITUTE / BUY_AHEAD) ---- */
function LineItemTable({ action, lines }: { action: Action; lines: BomLine[] }) {
  const { rows, subtotal, units, extendedTotal } = deriveLineItems(action, lines);

  return (
    <div>
      {/* header */}
      <div
        className="grid items-center border-b border-rule-strong label"
        style={{ gridTemplateColumns: TABLE_COLS, columnGap: TABLE_GAP, height: "22px" }}
      >
        <span>MPN</span>
        <span>DESCRIPTION</span>
        <span className="text-right">QTY/U</span>
        <span className="text-right">LEAD</span>
        <span className="text-right">UNIT $</span>
        <span className="text-right">EXT $</span>
      </div>

      {rows.map((r) => (
        <div
          key={r.id}
          className="grid items-center border-b border-rule text-body"
          style={{ gridTemplateColumns: TABLE_COLS, columnGap: TABLE_GAP, height: "24px" }}
        >
          <span
            className="overflow-hidden text-ellipsis whitespace-nowrap text-primary"
            title={r.id}
          >
            {r.mpn}
          </span>
          <span
            className="overflow-hidden text-ellipsis whitespace-nowrap text-secondary"
            title={`${r.description} · ${r.manufacturer}`}
          >
            {r.description}
          </span>
          <span className="text-right tabular-nums text-secondary">{r.qtyPerUnit}</span>
          <span className="text-right tabular-nums text-secondary">
            {r.leadTimeWeeks}W
          </span>
          <span className="text-right tabular-nums text-secondary">
            ${r.unitCost.toFixed(2)}
          </span>
          <span className="text-right tabular-nums text-primary">${r.ext.toFixed(2)}</span>
        </div>
      ))}

      {/* subtotal: per finished MD-7200 unit */}
      <div className="flex items-center justify-between border-t border-rule-strong py-1">
        <span className="label">
          PER-UNIT BOM VALUE · {rows.length} LINES
        </span>
        <span className="tabular-nums text-body text-primary">{dollars(subtotal)}</span>
      </div>

      {/* extended shipment value, EXPEDITE only, scaled by its own UNITS metric */}
      {units && extendedTotal ? (
        <div className="flex items-center justify-between border-t border-rule py-1">
          <span className="label">
            EXTENDED · {units.toLocaleString("en-US")} UNITS
          </span>
          <span className="tabular-nums text-body text-focus">
            {money(extendedTotal)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ---- LICENSE: the two affiliates-flagged suppliers and their chains ---- */
function AffiliatesTable({
  lines,
  onOpenSources,
}: {
  lines: BomLine[];
  onOpenSources: (ids: string[]) => void;
}) {
  const rows = deriveAffiliateRows(lines);

  return (
    <div>
      <p className="mb-2 text-label leading-relaxed text-dim">
        RED FLAG 29 DILIGENCE · AFFILIATES SCREENING · OBLIGATION ATTACHES 2026-11-10
      </p>

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="border border-rule">
            {/* supplier line header */}
            <div className="flex items-baseline justify-between gap-3 border-b border-rule-strong bg-panel px-2 py-1">
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-body text-primary">
                {r.mpn} · {r.description}
              </span>
              <span className="shrink-0 text-label tabular-nums text-dim">
                {r.id}
              </span>
            </div>

            <div className="px-2">
              <Field k="SUPPLIER OF RECORD" v={r.supplierOfRecord} tag="OBSERVED" />
              <Field
                k={`INTERMEDIATE PARENT · ${r.parentPct}%`}
                v={r.parentEntity}
                tag="OBSERVED"
              />
              <Field
                k={`ULTIMATE PARENT · CONF ${r.ultimateParentConf}%`}
                v={r.ultimateParent}
                accent="modeled"
                tag="MODELED"
              />
              <Field
                k="AFFILIATES THRESHOLD"
                v={r.thresholdCrossed ? "⚑ 50% CROSSED" : "BELOW 50%"}
                accent={r.thresholdCrossed ? "critical" : undefined}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onOpenSources(affiliateSourceIds(rows))}
        className="mt-2 block text-left text-label leading-relaxed text-dim underline decoration-dotted underline-offset-2 transition-colors hover:text-focus"
      >
        SOURCES · {OWNERSHIP_THRESHOLD_NOTE.sources}. Ultimate-parent attribution is{" "}
        <span className="text-modeled">MODELED</span> inferred from filings, not per-part
        observed. →
      </button>
    </div>
  );
}

export function DocumentModal({
  action,
  onClose,
}: {
  action: Action | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, onClose]);

  // Reset during render (not in an effect) whenever the open action changes,
  // so a stale panel never reopens on a new selection.
  const [sourcesOpen, setSourcesOpen] = useState<string[] | null>(null);
  const [sourcesOpenFor, setSourcesOpenFor] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  if ((action?.id ?? null) !== sourcesOpenFor) {
    setSourcesOpenFor(action?.id ?? null);
    setSourcesOpen(null);
    setGenerating(false);
  }

  // Real vector PDF export (lib/documents/pdf.ts), built off the same
  // derivation this modal renders. Runs client-side, no headless browser.
  const handleDownload = useCallback(async (a: Action) => {
    setGenerating(true);
    try {
      await downloadDocumentPdf(a);
    } finally {
      setGenerating(false);
    }
  }, []);

  return (
    <AnimatePresence>
      {action ? (
        (() => {
          const meta = DOC_META[action.kind];
          const lines = linesFor(action.id);
          const isLicense = action.kind === "LICENSE";

          return (
            <motion.div
              // AnimatePresence tracks its children by key. Unkeyed, this
              // overlay was registered under "" and React logged a duplicate
              // key on every open, because the entering and exiting copies
              // collided on the same empty key mid-transition. action.id also
              // makes switching straight from one document to another animate
              // as a swap instead of a mutation.
              key={action.id}
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onMouseDown={onClose}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex max-h-[88vh] w-[640px] max-w-[94vw] flex-col border border-rule-strong bg-elevated"
                style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
              >
                {/* header: fixed */}
                <div className="flex shrink-0 items-center justify-between border-b border-rule px-2 py-1.5">
                  <div className="flex items-baseline gap-3">
                    <span className="text-value uppercase text-primary">
                      {DOC_TITLE[action.kind]}
                    </span>
                    <span className="text-label text-focus">
                      PREVIEW · REPRESENTATIVE
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-dim transition-colors hover:text-focus"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* body: scrolls internally when tall */}
                <div className="min-h-0 flex-1 overflow-auto px-2 py-1.5">
                  {/* reference block */}
                  <div className="border-b border-rule pb-1.5 text-label text-dim">
                    <div className="flex items-center justify-between">
                      <span className="tabular-nums text-secondary">
                        REF {meta.refPrefix}-{ISSUE_DATE}
                      </span>
                      <span className="tabular-nums">ISSUED {ISSUE_DATE}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>{ISSUER}</span>
                      <span>{meta.issuingDept}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>
                        {CUSTOMER.focusProduct.line} · {CUSTOMER.location}
                      </span>
                      <span className="tabular-nums">{action.id}</span>
                    </div>
                  </div>

                  <p className="mt-2 max-w-[68ch] text-body leading-relaxed text-secondary">
                    {DOC_INTRO[action.kind]}
                  </p>

                  {/* line items */}
                  <SectionLabel corner={`${lines.length}`}>{meta.lineHeading}</SectionLabel>
                  {isLicense ? (
                    <AffiliatesTable lines={lines} onOpenSources={setSourcesOpen} />
                  ) : (
                    <LineItemTable action={action} lines={lines} />
                  )}

                  {/* parameters: the action's real metrics */}
                  <SectionLabel>PARAMETERS</SectionLabel>
                  {action.metrics.map((m) => (
                    <Field
                      key={m.label}
                      k={m.label}
                      v={m.note ? `${m.value}  (${m.note})` : m.value}
                      accent={m.warn ? "critical" : undefined}
                    />
                  ))}
                  {!isLicense ? (
                    <Field
                      k="OBSERVED RESOLVED"
                      v={`${action.recovers} of ${OBSERVED_EXPOSED}`}
                      accent="resolved"
                    />
                  ) : null}

                  {action.warning ? (
                    <div className="mt-2 text-label leading-relaxed text-critical">
                      ⚠ {action.warning}
                    </div>
                  ) : null}

                  {/* terms */}
                  <SectionLabel>TERMS</SectionLabel>
                  {meta.terms.map((t) => (
                    <Field key={t.k} k={t.k} v={t.v} />
                  ))}

                  {/* authorization: role placeholders only */}
                  <SectionLabel>AUTHORIZATION</SectionLabel>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2 pt-1.5">
                    {meta.signatories.map((role) => (
                      <div key={role}>
                        <div className="h-6 border-b border-rule-strong" />
                        <div className="mt-1 label">
                          {role}
                        </div>
                        <div className="text-label text-dim">
                          SIGN / DATE
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* footer: fixed. The PDF export lives here, not the header,
                    since this is the row that used to just claim "READY" --
                    now it is the thing that makes the document real. */}
                <div className="flex shrink-0 items-center justify-between border-t border-rule px-2 py-1.5">
                  <span className="text-label text-dim">
                    GENERATED BY GALLIUM · {meta.reviewLine}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownload(action)}
                    disabled={generating}
                    className="label flex h-row items-center gap-1.5 px-2 text-focus transition-colors disabled:opacity-50"
                    style={{ border: "1px solid var(--focus)" }}
                  >
                    {generating ? "GENERATING PDF..." : "DOWNLOAD PDF"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()
      ) : null}
      <SourcePanel
        sourceIds={sourcesOpen}
        onClose={() => setSourcesOpen(null)}
        context={action ? `${action.id} affiliates screening` : undefined}
      />
    </AnimatePresence>
  );
}
