import type { DrizzleDb } from '../../kernel/db';
import type { MediaSource } from '../providers';
import { type QueryResult, evaluateCombination } from './combinationEvaluator';
import { mergeEnrichment } from './enrichmentMerge';
import type { FilterValueEntry } from './filterRegistry';
import { getRule } from './filterRegistry';
import type { MediaItemSet } from './mediaItem';
import type { NormalizedMovie } from './movie';
import type { NormalizedShow } from './show';

/** One source within a query: a set of predicates and the role it plays. */
export interface MediaQuerySource {
  filterValues: FilterValueEntry[];
  role: 'include' | 'exclude';
}

/**
 * The persistable, source-less core of a query: the content type whose predicate
 * registry applies and one-or-more include/exclude sources. Both the evaluatable
 * `MediaQuery` and the persisted `MediaQueryRecord` are a `MediaQuerySpec` plus
 * what each adds (a bound source / a database identity).
 */
export interface MediaQuerySpec {
  contentType: 'movie' | 'show';
  sources: MediaQuerySource[];
}

/**
 * A `MediaQuerySpec` bound to a `MediaSource` — the engine's input. The source is
 * what the engine reads items from; the spec says what to match. A saved query is
 * a single-source include spec; the browse view is the same with URL-derived
 * filterValues.
 */
export interface MediaQuery extends MediaQuerySpec {
  source: MediaSource;
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
      const rule = getRule(key, contentType);
      if (!rule) return true;
      return rule.predicate(item, value);
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
