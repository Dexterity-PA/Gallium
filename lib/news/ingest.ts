import type { Article } from "@/lib/types";
import { ARTICLES } from "@/lib/data/articles";

// Ingest stage of the news pipeline (ingest → classify → match → render).
// RawArticle is what a source hands back before classification — today that
// shape is identical to the rendered Article, since the local corpus is
// already "clean." A real feed adapter would return something rougher
// (unparsed dek, no sourceIds) and a normalize() step would live here.
export type RawArticle = Article;

export interface ArticleSource {
  fetch(): Promise<RawArticle[]>;
}

// Reads today's hand-authored corpus. This is the seam: swap this class for
// a GDELT/RSS-backed ArticleSource later and classify.ts/match.ts never change.
export class LocalArticleSource implements ArticleSource {
  async fetch(): Promise<RawArticle[]> {
    return ARTICLES;
  }
}

export async function ingestArticles(
  source: ArticleSource = new LocalArticleSource()
): Promise<RawArticle[]> {
  return source.fetch();
}
