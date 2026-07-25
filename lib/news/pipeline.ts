import { ARTICLES } from "@/lib/data/articles";
import { classifyArticle, type ArticleClassification } from "@/lib/news/classify";
import { reconcile, type MatchReconciliation } from "@/lib/news/match";

export type { ArticleClassification } from "@/lib/news/classify";

// Render stage prep: ingest → classify → match, run once at module load off
// the local corpus (today's ArticleSource is synchronous data wrapped in a
// resolved Promise, so classifying directly off ARTICLES keeps this module
// load synchronous — a route-backed async source would move this into a
// request handler without touching classify.ts/match.ts).
const classified = new Map<string, ArticleClassification>();
const reconciliations = new Map<string, MatchReconciliation>();

for (const a of ARTICLES) {
  const c = classifyArticle(a);
  classified.set(a.id, c);
  reconciliations.set(a.id, reconcile(a.id, c.matchedBomIds, a.relatedBomIds));
}

export const ARTICLE_CLASSIFICATIONS: Record<string, ArticleClassification> =
  Object.fromEntries(classified);

export const ARTICLE_MATCH_RECONCILIATIONS: Record<string, MatchReconciliation> =
  Object.fromEntries(reconciliations);

export function getClassification(id: string): ArticleClassification | undefined {
  return classified.get(id);
}
