import type { DrizzleDb } from '../database';
import type { NormalizedMovie } from '../domain/movie';
import type { NormalizedShow } from '../domain/show';
import type { MediaItemSet, MediaSource } from '../providers/mediaSource';
import { getFilterDef } from '../utils/filterRegistry';
import { type QueryResult, evaluateCombination } from './combinationEvaluator';
import { mergeEnrichment } from './enrichmentMerge';
import type { FilterValueEntry } from './savedQueryService';

/** One source within a query: a set of predicates and the role it plays. */
export interface MediaQuerySource {
  filterValues: FilterValueEntry[];
  role: 'include' | 'exclude';
}

/**
 * A query bound to a `MediaSource`: the source the engine reads items from, the
 * content type whose predicate registry applies, and one-or-more include/exclude
 * sources. A saved query is a single-source include `MediaQuery`; the browse view
 * is the same with URL-derived filterValues.
 */
export interface MediaQuery {
  source: MediaSource;
  contentType: 'movie' | 'show';
  sources: MediaQuerySource[];
}

export type { MediaItemSet };

/**
 * The engine's match primitive: the subset of `items` satisfying every predicate
 * in `filterValues` under the registry for `contentType`. Unknown keys pass through.
 */
export function matchItems<T extends NormalizedMovie | NormalizedShow>(
  items: T[],
  filterValues: FilterValueEntry[],
  contentType: 'movie' | 'show'
): T[] {
  return items.filter((item) =>
    filterValues.every(({ key, value }) => {
      const def = getFilterDef(key, contentType);
      if (!def) return true;
      return def.apply(item, value);
    })
  );
}

/**
 * The single owner of "what does this query match". Fetches the bound provider's
 * items, applies the predicate registry per source, and combines include/exclude
 * across sources into the matched `MediaItemSet`.
 */
export class MediaQueryEngine {
  private readonly db?: DrizzleDb;

  constructor(deps: { db?: DrizzleDb } = {}) {
    this.db = deps.db;
  }

  async evaluate(query: MediaQuery): Promise<MediaItemSet> {
    const { source } = query;
    const items = await source.getMediaItems();
    if (this.db) {
      await mergeEnrichment(this.db, items, source.enrichmentSourceType, (i) => source.idOf(i));
    }
    return this.combine(items, query.sources, query.contentType, (i) => source.idOf(i));
  }

  /** Match every source, project ids, combine include/exclude, return survivors. */
  private combine<T extends NormalizedMovie | NormalizedShow>(
    normalized: T[],
    sources: MediaQuerySource[],
    contentType: 'movie' | 'show',
    idOf: (item: T) => number | undefined
  ): T[] {
    const queryResults: QueryResult[] = sources.map((s) => ({
      role: s.role,
      items: matchItems(normalized, s.filterValues, contentType).map((i) => idOf(i)!),
    }));
    const finalIds = new Set(evaluateCombination(queryResults));
    return normalized.filter((i) => finalIds.has(idOf(i)!));
  }
}
