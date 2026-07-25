"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BomLine } from "@/lib/types";
import {
  OWNERSHIP_THRESHOLD_NOTE,
  OWNERSHIP_REVIEW_NOTE,
} from "@/lib/data/bom";
import { SourcePanel } from "@/components/shared/SourcePanel";

// A row in the ownership chain. `modeled` renders label + value + marker in
// --modeled, the reserved inferred colour (DESIGN.md §2). OBSERVED rows carry
// no accent at all: being sourced is the norm, so it needs no signal.
function ChainRow({
  label,
  value,
  marker,
  modeled = false,
  onMarkerClick,
}: {
  label: string;
  value: React.ReactNode;
  marker: React.ReactNode;
  modeled?: boolean;
  onMarkerClick?: () => void;
}) {
  const tone = modeled ? "var(--modeled)" : "var(--text-primary)";
  // OBSERVED is the norm and carries no colour; --modeled marks the exception.
  const markerColor = modeled ? "var(--modeled)" : "var(--text-dim)";
  return (
    <div className="grid grid-cols-[128px_1fr_auto] items-baseline gap-2 border-b border-rule py-1">
      <span
        className="label"
        style={{ color: modeled ? "var(--modeled)" : "var(--text-dim)" }}
      >
        {label}
      </span>
      <span className="tabular-nums text-body" style={{ color: tone }}>
        {value}
      </span>
      {onMarkerClick ? (
        <button
          type="button"
          onClick={onMarkerClick}
          className="text-label transition-opacity hover:opacity-70"
          style={{ color: markerColor }}
          title="View provenance"
        >
          {marker}
        </button>
      ) : (
        <span className="text-label" style={{ color: markerColor }}>
          {marker}
        </span>
      )}
    </div>
  );
}

export function OwnershipDrawer({
  line,
  onClose,
}: {
  line: BomLine | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!line) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [line, onClose]);

  const chain = line?.ownershipChain ?? null;

  // Reset during render (not in an effect) whenever the drawer's line
  // changes, so a stale panel never reopens on a new selection.
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesOpenFor, setSourcesOpenFor] = useState<string | null>(null);
  if ((line?.id ?? null) !== sourcesOpenFor) {
    setSourcesOpenFor(line?.id ?? null);
    setSourcesOpen(false);
  }

  return (
    <AnimatePresence>
      {line ? (
        <motion.aside
          key={line.id}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-y-0 right-0 z-40 flex w-[420px] max-w-[92%] flex-col border-l border-rule-strong bg-panel"
        >
          {/* header */}
          <div className="flex h-row shrink-0 items-center justify-between border-b border-rule px-2">
            <span className="text-value uppercase text-primary">
              {line.mpn} — Ownership Chain
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

          <div className="min-h-0 flex-1 overflow-auto p-2">
            <div className="mb-2 text-body text-secondary">
              {line.description}
            </div>

            {chain ? (
              <>
                {/* the chain: two OBSERVED rows, then the MODELED ultimate parent */}
                <div className="mb-2">
                  <ChainRow
                    label="Supplier of record"
                    value={chain.supplierOfRecord}
                    marker="● OBSERVED"
                  />
                  <ChainRow
                    label="Parent entity"
                    value={
                      <>
                        {chain.parentEntity},{" "}
                        <span className="tabular-nums">{chain.parentPct}%</span>
                      </>
                    }
                    marker="● OBSERVED"
                  />
                  <ChainRow
                    label="Ultimate parent"
                    value={chain.ultimateParent}
                    marker={
                      <span className="tabular-nums">
                        ◆ MODELED conf {chain.ultimateParentConf}%
                      </span>
                    }
                    modeled
                    onMarkerClick={() => setSourcesOpen(true)}
                  />
                </div>

                {/* threshold-crossed alarm — FLAGGED only */}
                {chain.thresholdCrossed ? (
                  <div
                    className="mb-2 pl-2"
                    style={{ borderLeft: "2px solid var(--critical)" }}
                  >
                    <div className="mb-2 text-body font-medium text-critical">
                      ⚠ {OWNERSHIP_THRESHOLD_NOTE.heading}
                    </div>
                    <div className="space-y-1 text-body leading-relaxed text-secondary">
                      {OWNERSHIP_THRESHOLD_NOTE.bodyLines.map((l) => (
                        <p key={l}>{l}</p>
                      ))}
                    </div>
                    <div className="mt-2 space-y-1 label">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-dim">
                          Red Flag 29 diligence
                        </span>
                        <span className="text-critical">
                          {OWNERSHIP_THRESHOLD_NOTE.redFlag29}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-dim">
                          License determination
                        </span>
                        <span className="text-primary">
                          {OWNERSHIP_THRESHOLD_NOTE.licenseDetermination}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSourcesOpen(true)}
                      className="mt-2 block text-left text-label leading-relaxed text-dim underline decoration-dotted underline-offset-2 transition-colors hover:text-critical"
                    >
                      SOURCES: {OWNERSHIP_THRESHOLD_NOTE.sources} →
                    </button>
                  </div>
                ) : (
                  /* REVIEW — chain present, threshold not crossed */
                  <div
                    className="mb-2 pl-2"
                    style={{ borderLeft: "2px solid var(--rule-strong)" }}
                  >
                    <div className="mb-2 text-body font-medium text-primary">
                      ◆ {OWNERSHIP_REVIEW_NOTE.heading}
                    </div>
                    <div className="space-y-1 text-body leading-relaxed text-secondary">
                      {OWNERSHIP_REVIEW_NOTE.bodyLines.map((l) => (
                        <p key={l}>{l}</p>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSourcesOpen(true)}
                      className="mt-2 block text-left text-label leading-relaxed text-dim underline decoration-dotted underline-offset-2 transition-colors hover:text-focus"
                    >
                      SOURCES: {OWNERSHIP_REVIEW_NOTE.sources} →
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* CLEAR — no chain to show */
              <div className="border-t border-rule pt-2 text-body leading-relaxed text-secondary">
                <div className="label mb-2">
                  ● OWNERSHIP CLEAR
                </div>
                No affiliates-screening exposure. Supplier ownership does not
                cross the 50% threshold.
              </div>
            )}
          </div>
        </motion.aside>
      ) : null}
      <SourcePanel
        sourceIds={chain && sourcesOpen ? chain.sourceIds : null}
        onClose={() => setSourcesOpen(false)}
        context={line ? `${line.mpn} ownership chain` : undefined}
      />
    </AnimatePresence>
  );
}
