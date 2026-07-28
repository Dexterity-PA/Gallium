"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFocusedPart } from "@/lib/focus";
import { BOM } from "@/lib/data/bom";
import { SITES } from "@/lib/data/sites";
import { ACTIONS } from "@/lib/data/actions";
import { GRAPH } from "@/lib/data/graph";

type EntryKind = "PART" | "SUPPLIER" | "SITE" | "ACTION";

interface Entry {
  kind: EntryKind;
  id: string;
  label: string;
  sub: string;
  // Where selecting this row takes you. PART rows deliberately have none:
  // focusing a part is a change of view state, not a change of screen (see
  // commit below).
  href?: string;
}

// Kind badges are wayfinding, not a RULE 4 severity signal: PART/SUPPLIER/SITE
// stay --text-secondary and let the 3-letter code do the differentiating.
// ACTION alone gets --focus, because it is literally "you can act on this" (RULE 9).
const KIND_COLOR: Record<EntryKind, string> = {
  PART: "var(--text-secondary)",
  SUPPLIER: "var(--text-secondary)",
  SITE: "var(--text-secondary)",
  ACTION: "var(--focus)",
};

function buildCorpus(): Entry[] {
  // PART rows carry the MPN, the public ?focus= currency (lib/focus). No
  // href: see commit().
  const parts: Entry[] = BOM.map((b) => ({
    kind: "PART",
    id: b.id,
    label: b.mpn,
    sub: b.description,
  }));
  const suppliers: Entry[] = GRAPH.nodes
    .filter((n) => n.kind === "SUPPLIER")
    .map((n) => ({ kind: "SUPPLIER", id: n.id, label: n.label, sub: "Supplier / manufacturer", href: "/app/graph" }));
  const sites: Entry[] = SITES.map((s) => ({
    kind: "SITE",
    id: s.id,
    label: s.label,
    sub: s.function ?? "Site",
    href: "/app/radar",
  }));
  const actions: Entry[] = ACTIONS.map((a) => ({
    kind: "ACTION",
    id: a.id,
    label: a.title,
    sub: a.cta,
    href: "/app/resolve",
  }));
  return [...parts, ...suppliers, ...sites, ...actions];
}

// Subsequence fuzzy score: lower is better; null = no match.
function score(query: string, text: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let ti = 0;
  let penalty = 0;
  let last = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    const found = t.indexOf(c, ti);
    if (found === -1) return null;
    if (last !== -1) penalty += found - last - 1; // gaps cost
    last = found;
    ti = found + 1;
  }
  return penalty + last * 0.01;
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { setFocusedPart } = useFocusedPart();
  const corpus = useMemo(buildCorpus, []);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const scored = corpus
      .map((e) => ({ e, s: score(query, `${e.label} ${e.sub} ${e.kind}`) }))
      .filter((r): r is { e: Entry; s: number } => r.s !== null)
      .sort((a, b) => a.s - b.s)
      .slice(0, 8)
      .map((r) => r.e);
    return scored;
  }, [corpus, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      // focus after paint
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    if (index >= results.length) setIndex(0);
  }, [results, index]);

  if (!open) return null;

  const commit = (entry: Entry | undefined) => {
    if (!entry) return;
    onClose();
    // PART rows set the shared focused-part state and STOP. Focus is view
    // state, not a destination: the palette is opened over whichever screen
    // the user is reading, and narrowing that screen to a part must not also
    // move them off it. setFocusedPart writes ?focus=MPN onto the current
    // URL, so the deep link is still there to copy; every screen, including
    // whichever one this was invoked over, reacts to the shared state.
    //
    // EXPOSURE keeps the two behaviours that belong to it: when it is the
    // current screen, the focused row scrolls into view and its drawer opens
    // (app/app/exposure/page.tsx), off the same shared state, no navigation
    // involved.
    if (entry.kind === "PART") {
      const line = BOM.find((b) => b.id === entry.id);
      if (line) setFocusedPart(line);
      return;
    }
    // SUPPLIER / SITE / ACTION have no shared-state equivalent to set, so
    // they stay navigational: the row is a way to reach the screen that
    // holds the thing.
    if (entry.href) router.push(entry.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(results[index]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 pt-[14vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-[560px] max-w-[92vw] overflow-hidden border border-[var(--rule-strong)] bg-[var(--bg-elevated)]"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.7)", maxHeight: 400 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--rule)] px-3 py-2">
          <span className="text-[var(--text-dim)]" aria-hidden>
            ⌘
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search parts, suppliers, sites, actions…"
            className="w-full bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div ref={listRef} className="max-h-[336px] overflow-auto">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-[var(--text-dim)]">
              No matches.
            </div>
          ) : (
            results.map((e, i) => (
              <button
                type="button"
                key={`${e.kind}-${e.id}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => commit(e)}
                className="flex w-full items-center gap-3 border-l-2 px-3 py-1 text-left"
                style={{
                  background: i === index ? "var(--bg-panel)" : "transparent",
                  borderLeftColor: i === index ? "var(--interactive)" : "transparent",
                }}
              >
                <span
                  className="w-[68px] shrink-0 text-[9px] uppercase tracking-[0.10em]"
                  style={{ color: KIND_COLOR[e.kind] }}
                >
                  {e.kind}
                </span>
                <span className="w-[150px] shrink-0 truncate text-[11px] text-[var(--text-primary)]">
                  {e.label}
                </span>
                <span className="flex-1 truncate text-[11px] text-[var(--text-dim)]">
                  {e.sub}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
