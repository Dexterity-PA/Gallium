"use client";

// The provenance surface: proves every "OBSERVED"/"MODELED" claim in the app
// rather than just labeling it. Two distinct views, chosen per-document:
//
//   OBSERVED  → the real SourceDoc(s) behind the claim (title, publisher,
//               kind, retrievedAt, url, excerpt).
//   MODELED   → an inference-explanation view. A MODELED record's sourceIds
//               still resolve to a SourceDoc (kind "NETWORK_INFERENCE"), but
//               that doc is never rendered as a document, because Gallium's modeling
//               basis is not a citation, and showing it as one would be
//               dishonest about what backs the number.
//
// One overlay, reused from every trigger (NodeDetailPanel, EventFeed,
// PartDrawer, OwnershipDrawer, DocumentModal). Centered modal + backdrop
// (DocumentModal's pattern), z-[75], above the exposure drawers (z-40), the
// shared node-detail panel (z-20), and the always-on ProvenanceBadge (z-[60]),
// so it sits above whatever triggered it in every case.

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { SourceDoc } from "@/lib/types";
import { getSources } from "@/lib/data/sources";

function formatRetrieved(iso: string): string {
  return iso.replace("T", " ").replace("Z", " UTC").slice(0, 20);
}

function formatKind(kind: SourceDoc["kind"]): string {
  return kind.replace(/_/g, " ");
}

// A MODELED record's sourceIds can legitimately include OBSERVED corroborating
// docs alongside the NETWORK_INFERENCE doc (e.g. a substrate-market quote plus
// the network inference itself): split on the doc's own provenance/kind, not
// on the triggering record's provenance, so that mix renders correctly.
function isInference(doc: SourceDoc): boolean {
  return doc.provenance === "MODELED" || doc.kind === "NETWORK_INFERENCE";
}

function ObservedRow({ doc }: { doc: SourceDoc }) {
  return (
    <div className="border-b border-rule py-1.5 first:pt-0 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label shrink-0 leading-body text-dim" aria-hidden>
          ●
        </span>
        <span className="min-w-0 flex-1 text-body leading-snug text-primary">
          {doc.title}
        </span>
      </div>
      <div className="mt-1 pl-3 label">
        {doc.publisher} · {formatKind(doc.kind)} · {formatRetrieved(doc.retrievedAt)}
      </div>
      {doc.excerpt ? (
        <p className="mt-1 pl-3 border-l-2 border-rule text-label italic leading-relaxed text-secondary">
          &ldquo;{doc.excerpt}&rdquo;
        </p>
      ) : null}
      {doc.url ? (
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 ml-3 inline-block text-label text-focus underline decoration-dotted underline-offset-2 hover:text-focus"
        >
          {doc.url}
        </a>
      ) : (
        <div className="mt-1 pl-3 text-label text-dim">
          first-party record, no public URL
        </div>
      )}
    </div>
  );
}

function InferenceRow({ doc }: { doc: SourceDoc }) {
  return (
    <div className="pl-2" style={{ borderLeft: "2px dashed var(--modeled)" }}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-label leading-body" style={{ color: "var(--modeled)" }} aria-hidden>
          ◆
        </span>
        <span className="text-body leading-snug" style={{ color: "var(--modeled)" }}>
          {doc.title}
        </span>
      </div>
      <div className="mt-1 pl-3 label">
        {doc.publisher} · not a document · {formatRetrieved(doc.retrievedAt)}
      </div>
      {doc.excerpt ? (
        <p className="mt-1.5 pl-3 text-label leading-relaxed text-secondary">
          {doc.excerpt}
        </p>
      ) : null}
    </div>
  );
}

export function SourcePanel({
  sourceIds,
  onClose,
  context,
}: {
  sourceIds: string[] | null;
  onClose: () => void;
  /** Short label for what this provenance backs, e.g. "BOM-07 · ISO5852SDW". */
  context?: string;
}) {
  useEffect(() => {
    if (!sourceIds) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sourceIds, onClose]);

  const docs = sourceIds ? getSources(sourceIds) : [];
  const observed = docs.filter((d) => !isInference(d));
  const modeled = docs.filter(isInference);

  return (
    <AnimatePresence>
      {sourceIds && docs.length ? (
        <motion.div
          // Keyed for AnimatePresence (see DocumentModal). A constant is right
          // here: only one provenance overlay is ever mounted, and re-pointing
          // it at a different record should cross-fade the contents rather
          // than tear the whole panel down and rebuild it.
          key="source-panel"
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55"
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
            className="flex max-h-[80vh] w-[440px] max-w-[92vw] flex-col border border-rule-strong bg-elevated"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
          >
            {/* header */}
            <div className="flex h-row shrink-0 items-center justify-between border-b border-rule px-2">
              <span className="text-value uppercase text-primary">
                Provenance{context ? ` · ${context}` : ""}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-dim transition-colors hover:text-focus"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* body */}
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <div className="mb-2 text-label leading-relaxed text-dim">
                Fictional, representative documents for this demo. The schema
                and click path are what a live integration would carry through
                unchanged.
              </div>

              {observed.length ? (
                <div className="mb-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="label">
                      Observed · sourced
                    </span>
                    <span className="text-label tabular-nums text-dim">
                      {observed.length}
                    </span>
                  </div>
                  {observed.map((d) => (
                    <ObservedRow key={d.id} doc={d} />
                  ))}
                </div>
              ) : null}

              {modeled.length ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="label"
                      style={{ color: "var(--modeled)" }}
                    >
                      Modeled · not sourced
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {modeled.map((d) => (
                      <InferenceRow key={d.id} doc={d} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
