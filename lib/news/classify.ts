import type { Severity } from "@/lib/types";
import { CORROBORATED, MODELED_HIGH, MODELED_MED } from "@/lib/data/confidence";
import { getSources } from "@/lib/data/sources";
import { GRAPH, CUSTOMER_NODE_ID } from "@/lib/data/graph";
import { SITES } from "@/lib/data/sites";
import type { RawArticle } from "@/lib/news/ingest";
import { categoriesFor, matchBomIds } from "@/lib/news/match";

// Classify stage of the news pipeline. lib/types.ts is read-only, so this
// result lives out-of-band in a Record<articleId, ArticleClassification>
// (see pipeline.ts) rather than as a field on Article.
export interface ArticleClassification {
  severity: Severity;
  affectedNodeId: string | null;
  componentCategories: string[];
  confidence: number; // a ConfidenceBand value — see lib/data/confidence.ts
  matchedBomIds: string[];
}

const VALID_NODE_IDS = new Set([...GRAPH.nodes.map((n) => n.id), ...SITES.map((s) => s.id)]);

// Ordered most-specific first; first match wins.
const NODE_KEYWORDS: Array<[RegExp, string]> = [
  [/kaohsiung port|berth/i, "NODE-PORT-KHH"],
  [/kaohsiung/i, "NODE-KHH-ASE"],
  [/taipei|tw-origin|taiwan-origin lanes/i, "NODE-TPE"],
  [/hsinchu/i, "NODE-HSC"],
  [/substrate|leadframe/i, "NODE-SUBS"],
  [/affiliates|ownership|screening threshold/i, CUSTOMER_NODE_ID],
];

function severityOf(text: string): Severity {
  if (/quarantine|inspection regime|screening returns|threshold crossed/i.test(text)) return "CRITICAL";
  if (/advisory|extend|congestion|tighten|climb|squeeze/i.test(text)) return "WARN";
  return "INFO";
}

function affectedNodeOf(text: string): string | null {
  for (const [re, id] of NODE_KEYWORDS) {
    if (re.test(text) && VALID_NODE_IDS.has(id)) return id;
  }
  return null;
}

function confidenceOf(a: RawArticle): number {
  const sources = getSources(a.sourceIds);
  const modeledCount = sources.filter((s) => s.provenance === "MODELED").length;
  if (modeledCount === 0) return CORROBORATED; // every article source today is OBSERVED-or-better
  return modeledCount > 1 || sources.length > 2 ? MODELED_HIGH : MODELED_MED;
}

export function classifyArticle(a: RawArticle): ArticleClassification {
  const text = `${a.headline} ${a.dek} ${a.body ?? ""}`;
  const componentCategories = categoriesFor(text);
  return {
    severity: severityOf(text),
    affectedNodeId: affectedNodeOf(text),
    componentCategories,
    confidence: confidenceOf(a),
    matchedBomIds: matchBomIds(componentCategories),
  };
}
