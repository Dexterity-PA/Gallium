"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Article, BomLine } from "@/lib/types";
import { BOM } from "@/lib/data/bom";
import { GRAPH } from "@/lib/data/graph";
import { SITES } from "@/lib/data/sites";
import { getSources } from "@/lib/data/sources";
import { ARTICLE_CLASSIFICATIONS, ARTICLE_MATCH_RECONCILIATIONS } from "@/lib/news/pipeline";
import { severityColor, severityGlyph, statusColor, statusGlyph } from "@/components/ui/StatusGlyph";

const BOM_BY_ID = new Map(BOM.map((b) => [b.id, b]));
const NODE_LABELS = new Map<string, string>([
  ...GRAPH.nodes.map((n): [string, string] => [n.id, n.label]),
  ...SITES.map((s): [string, string] => [s.id, s.label]),
]);

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} · ${d.toISOString().slice(11, 16)} UTC`;
}

/** Per-article dismiss state. Each open article gets a fresh Set (see `key` in ArticleModal). */
function MatchedLines({ lines }: { lines: BomLine[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = lines.filter((l) => !dismissed.has(l.id));
  const dismissedCount = lines.length - visible.length;

  if (lines.length === 0) {
    return (
      <div className="text-[9px] tracking-[0.06em] text-[var(--text-dim)]">
        NO BOM LINES MATCHED
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {visible.map((b) => (
          <span
            key={b.id}
            className="inline-flex items-center gap-1.5 border border-[var(--rule)] bg-[var(--bg-panel)] px-1.5 py-0.5 text-[10px] leading-none tabular-nums"
          >
            <span style={{ color: b.provenance === "MODELED" ? "var(--modeled)" : statusColor(b.status) }}>
              {statusGlyph(b.status)}
            </span>
            <span className="text-[var(--text-secondary)]">{b.mpn}</span>
            <button
              type="button"
              onClick={() => setDismissed((d) => new Set(d).add(b.id))}
              className="ml-0.5 text-[var(--text-dim)] transition-colors hover:text-[var(--critical)]"
              aria-label={`Dismiss match ${b.mpn}`}
              title="Dismiss this match"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      {dismissedCount > 0 ? (
        <div className="mt-1.5 flex items-center gap-2 text-[9px] tracking-[0.06em] text-[var(--text-dim)]">
          <span>{dismissedCount} MATCH{dismissedCount === 1 ? "" : "ES"} DISMISSED</span>
          <button
            type="button"
            onClick={() => setDismissed(new Set())}
            className="text-[var(--interactive)] transition-colors hover:text-[var(--focus)]"
          >
            RESTORE
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ArticleBody({ article }: { article: Article }) {
  const cls = ARTICLE_CLASSIFICATIONS[article.id];
  const recon = ARTICLE_MATCH_RECONCILIATIONS[article.id];
  const sources = getSources(article.sourceIds);
  const matchedLines = (cls?.matchedBomIds ?? [])
    .map((id) => BOM_BY_ID.get(id))
    .filter((b): b is BomLine => !!b);
  const isModeled = (cls?.confidence ?? 0) < 90;

  return (
    <>
      {/* unmissable fictional marker, separate from any app-wide scenario disclaimer */}
      <div className="flex items-center gap-2 border border-[var(--critical)] bg-[color-mix(in_srgb,var(--critical)_12%,var(--bg-elevated))] px-2 py-1">
        <span className="text-[10px] font-medium tracking-[0.10em] text-[var(--critical)]">
          ⚠ FICTIONAL ARTICLE
        </span>
        <span className="text-[9px] tracking-[0.06em] text-[var(--text-secondary)]">
          Generated for a YC application demo. No real outlet, event, or company statement.
        </span>
      </div>

      {/* header */}
      <div className="mt-3 border-b border-[var(--rule)] pb-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[13px] font-medium leading-snug text-[var(--text-primary)]">
            {article.headline}
          </h2>
          {cls ? (
            <span
              className="shrink-0 text-[9px] font-medium tracking-[0.08em]"
              style={{ color: severityColor(cls.severity) }}
            >
              {severityGlyph(cls.severity)} {cls.severity}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] tracking-[0.06em] text-[var(--text-dim)]">
          <span>{article.outlet}</span>
          <span className="tabular-nums">{fmtTime(article.publishedAt)}</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{article.dek}</p>
      </div>

      {/* body */}
      <div className="mt-3 max-w-[70ch] text-[11px] leading-relaxed text-[var(--text-secondary)]">
        {(article.body ?? "").split("\n\n").map((para, i) => (
          <p key={i} className={i > 0 ? "mt-3" : undefined}>
            {para}
          </p>
        ))}
      </div>

      {/* classification */}
      {cls ? (
        <div className="mt-4 border-t border-[var(--rule-strong)] pt-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
              Classification
            </span>
            <span
              className="text-[9px] tabular-nums tracking-[0.08em]"
              style={{ color: isModeled ? "var(--modeled)" : "var(--text-secondary)" }}
            >
              {isModeled ? "■ MODELED" : "● OBSERVED"} · CONF {cls.confidence}%
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[var(--text-secondary)]">
            <span>
              <span className="text-[var(--text-dim)]">AFFECTED NODE </span>
              {cls.affectedNodeId ? (
                <span className="text-[var(--text-primary)]">
                  {NODE_LABELS.get(cls.affectedNodeId) ?? cls.affectedNodeId}
                </span>
              ) : (
                <span className="text-[var(--text-dim)]">none (macro signal)</span>
              )}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cls.componentCategories.map((c) => (
              <span
                key={c}
                className="border border-[var(--rule)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.06em] text-[var(--text-secondary)]"
              >
                {c}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
              Matched BOM Lines
            </span>
            <span className="text-[9px] tabular-nums text-[var(--text-dim)]">
              {matchedLines.length} COMPUTED
            </span>
          </div>
          <div className="mt-1.5">
            <MatchedLines lines={matchedLines} />
          </div>

          {recon && !recon.agree ? (
            <div className="mt-2 text-[9px] leading-relaxed tracking-[0.04em] text-[var(--warn)]">
              ⚠ Computed match ({recon.computed.length} lines) differs from the article&rsquo;s
              hand-authored relatedBomIds ({recon.authored.length} lines). Shown above is the
              computed match, not the curator&rsquo;s note.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* sources */}
      <div className="mt-4 border-t border-[var(--rule)] pt-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
          Sources · {sources.length}
        </span>
        <div className="mt-1.5 flex flex-col gap-1">
          {sources.map((s) => (
            <div key={s.id} className="flex items-baseline justify-between gap-3 text-[10px]">
              <span
                className="overflow-hidden text-ellipsis whitespace-nowrap"
                style={{ color: s.provenance === "MODELED" ? "var(--modeled)" : "var(--text-secondary)" }}
                title={s.title}
              >
                {s.title}
              </span>
              <span className="shrink-0 text-[9px] tracking-[0.06em] text-[var(--text-dim)]">
                {s.publisher}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function ArticleModal({ article, onClose }: { article: Article | null; onClose: () => void }) {
  useEffect(() => {
    if (!article) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [article, onClose]);

  return (
    <AnimatePresence>
      {article ? (
        <motion.div
          // Keyed for AnimatePresence, same reason as DocumentModal: an
          // unkeyed child is tracked as "" and collides with its own exiting
          // copy. article.id also swaps cleanly between two articles.
          key={article.id}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55"
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
            className="flex max-h-[88vh] w-[620px] max-w-[94vw] flex-col border border-[var(--rule-strong)] bg-[var(--bg-elevated)]"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--rule)] px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.10em] text-[var(--text-dim)]">
                ARTICLE · {article.id}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--text-dim)] transition-colors hover:text-[var(--focus)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
              {/* key resets per-article dismiss state when the open article changes */}
              <ArticleBody key={article.id} article={article} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
