import { BOM } from "@/lib/data/bom";
import { FEED_EVENTS } from "@/lib/data/event";
import { ARTICLES } from "@/lib/data/articles";
import type { Article } from "@/lib/types";

// Match stage of the news pipeline. Component-category keyword patterns,
// tested against free text to classify AND against BOM.description to find
// real BOM lines — same regex both directions, so a category can't drift
// between "what we called it" and "what it actually matched." This is the
// same keyword-to-BOM-description technique as eventLines() in
// components/radar/EventFeed.tsx, applied to articles instead of feed rows.
export const CATEGORY_PATTERNS: Record<string, RegExp> = {
  "power module": /igbt|ipm|power stage|discretes?|schottky|rectifier|mosfet/i,
  isolation: /optocoupler|isolat|gate.?driv/i,
  passive: /capacitor|electrolytic|film cap|choke|resistor|inductor/i,
  "package material": /substrate|leadframe|mold compound|bond wire|packaging/i,
  compliance: /affiliates|ownership|screening|threshold/i,
  logistics: /berth|port|carrier|freight|container|customs|shipping|congestion/i,
};

export function categoriesFor(text: string): string[] {
  const hit = Object.entries(CATEGORY_PATTERNS)
    .filter(([, re]) => re.test(text))
    .map(([cat]) => cat);
  return hit.length ? hit : ["component"];
}

// Compute the real BOM lines a set of categories touches. "compliance" reads
// the ownership axis (ownership !== CLEAR, the 7-line screening universe);
// everything else tests the category regex against BOM.description, same as
// eventLines(). Deliberately independent of Article.relatedBomIds — see
// reconcile() below, which compares the two instead of trusting either.
export function matchBomIds(categories: string[]): string[] {
  const matched = new Set<string>();
  for (const cat of categories) {
    if (cat === "compliance") {
      BOM.filter((b) => b.ownership && b.ownership !== "CLEAR").forEach((b) => matched.add(b.id));
      continue;
    }
    const re = CATEGORY_PATTERNS[cat];
    if (!re) continue;
    BOM.filter((b) => re.test(b.description)).forEach((b) => matched.add(b.id));
  }
  return [...matched];
}

export interface MatchReconciliation {
  articleId: string;
  computed: string[];
  authored: string[];
  agree: boolean;
}

// Diagnostic, not a guard: hand-authored relatedBomIds is a curator's note,
// not ground truth, so disagreement here is expected and informative (e.g.
// ART-AFFILIATES-RULE authors only the 2 FLAGGED lines; the computed match
// also picks up the 5 REVIEW lines in the same screening universe).
export function reconcile(
  articleId: string,
  computed: string[],
  authored: string[] | undefined
): MatchReconciliation {
  const a = authored ?? [];
  const agree = a.length === computed.length && a.every((id) => computed.includes(id));
  return { articleId, computed, authored: a, agree };
}

// ---- event → article linking (feed integration) -------------------------
// Keyword-matched on the feed headline, mirroring feedSources() in
// lib/data/event.ts. Kept independent of EventFeed's internal eventLines()
// so components/radar/EventFeed.tsx doesn't need to export or restructure
// anything to support this — a second subagent is editing that file at the
// same time (see ArticleChips.tsx for the additive integration point).
const EVENT_ARTICLES: Array<[RegExp, string[]]> = [
  [/MARITIME QUARANTINE/, ["ART-KHH-QUARANTINE"]],
  [/OWNERSHIP RULE/, ["ART-AFFILIATES-RULE"]],
  [/PORT CONGESTION/, ["ART-PORT-CONGESTION"]],
  [/CARRIER ADVISORY/, ["ART-CARRIER-ADVISORY"]],
  [/PRICE MOVEMENT|SUBSTRATE/, ["ART-SUBSTRATE-SQUEEZE", "ART-DEEPTIER-INFERENCE"]],
  [/ALLOCATION NOTICE/, ["ART-ALLOCATION-DISCRETES"]],
  [/LEAD TIME EXTENSION/, ["ART-LEADTIME-OPTOCOUPLERS"]],
  [/EXPORT RULE/, ["ART-EXPORT-COMMENT"]],
  [/TYPHOON/, ["ART-TYPHOON-LUZON"]],
  [/FAB UTILIZATION/, ["ART-FAB-UTILIZATION"]],
];

const ARTICLES_BY_ID = new Map(ARTICLES.map((a) => [a.id, a]));

export function articlesForHeadline(head: string): Article[] {
  for (const [re, ids] of EVENT_ARTICLES) {
    if (re.test(head)) return ids.map((id) => ARTICLES_BY_ID.get(id)).filter((a): a is Article => !!a);
  }
  return [];
}

// Sanity guard (dev-time): every headline pattern above should resolve to at
// least one real article id, and every id must exist in the corpus — catches
// a typo'd id or a renamed feed headline at import instead of a silent
// empty chip at render time.
export const EVENT_ARTICLE_LINKS_OK = (() => {
  const heads = FEED_EVENTS.map((e) => e.head);
  for (const [re, ids] of EVENT_ARTICLES) {
    for (const id of ids) {
      if (!ARTICLES_BY_ID.has(id)) {
        throw new Error(`match.ts: EVENT_ARTICLES references unknown article id "${id}"`);
      }
    }
    if (!heads.some((h) => re.test(h))) {
      throw new Error(`match.ts: EVENT_ARTICLES pattern ${re} matches no FEED_EVENTS headline`);
    }
  }
  return true;
})();
