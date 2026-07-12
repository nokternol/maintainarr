/**
 * Two adapters from the registry-keyed, scoped `FilterState` (`useMediaFilters`)
 * to the two wire contracts that haven't caught up to it yet:
 *
 * - `toBrowseParams`: `GET /api/media/movies|series` (`server/modules/media/media.handler.ts`)
 *   still expects the pre-Stage-2 renamed param names (surface #2 in the
 *   fracture ledger's "Filter/rule vocabulary" entry) — deleting that
 *   translator server-side is separate, unscheduled work, so this mirrors it
 *   client-side until it's removed.
 * - `toSaveValues`: not a legacy shim — it's the permanent shape saved queries
 *   need. Scoping by contentType (merging `shared` with just the one relevant
 *   scope, rather than movie+show together) is what avoids the
 *   tagIds/qualityProfileIds/genres collision the two scopes intentionally
 *   share the same key for.
 */
import type {
  ContentScope,
  FilterState,
  FilterValue,
  QualifierScope,
  RangeValue,
} from '@app/hooks/useMediaFilters';
import type { FilterValueEntry } from '@app/hooks/useMediaQueries';
import type { MediaFilters } from '@app/types/media';

type Bound = 'min' | 'max';

interface Binding {
  scope: ContentScope;
  key: string;
  bound?: Bound;
}

// Browse-path param name -> (scope, registry key, range bound if this name is
// one half of a since-collapsed Gte/Lte pair) — the exact names
// MOVIE_PARAM_TO_KEY / SERIES_PARAM_TO_KEY in media.handler.ts still expect.
const BROWSE_PARAM_BINDINGS = {
  title: { scope: 'shared', key: 'title' },
  yearMin: { scope: 'shared', key: 'year', bound: 'min' },
  yearMax: { scope: 'shared', key: 'year', bound: 'max' },
  tautulliWatched: { scope: 'shared', key: 'watched' },
  lastWatchedDaysAgoGte: { scope: 'shared', key: 'lastWatchedDaysAgo', bound: 'min' },
  lastWatchedDaysAgoLte: { scope: 'shared', key: 'lastWatchedDaysAgo', bound: 'max' },
  overseerrHasIssue: { scope: 'shared', key: 'overseerrHasIssue' },
  overseerrRequestStatus: { scope: 'shared', key: 'overseerrRequestStatus' },
  tmdbStatus: { scope: 'shared', key: 'tmdbStatus' },
  addedDaysAgoGte: { scope: 'shared', key: 'addedDaysAgo', bound: 'min' },
  addedDaysAgoLte: { scope: 'shared', key: 'addedDaysAgo', bound: 'max' },
  sizeOnDiskGbGte: { scope: 'shared', key: 'sizeOnDiskGb', bound: 'min' },
  sizeOnDiskGbLte: { scope: 'shared', key: 'sizeOnDiskGb', bound: 'max' },
  certification: { scope: 'shared', key: 'certification' },
  hasFile: { scope: 'movie', key: 'hasFile' },
  movieTagIds: { scope: 'movie', key: 'tagIds' },
  movieQualityProfileIds: { scope: 'movie', key: 'qualityProfileIds' },
  movieGenres: { scope: 'movie', key: 'genres' },
  radarrImdbRatingGte: { scope: 'movie', key: 'imdbRating', bound: 'min' },
  radarrImdbRatingLte: { scope: 'movie', key: 'imdbRating', bound: 'max' },
  monitored: { scope: 'show', key: 'monitored' },
  seriesStatus: { scope: 'show', key: 'seriesStatus' },
  seriesTagIds: { scope: 'show', key: 'tagIds' },
  seriesQualityProfileIds: { scope: 'show', key: 'qualityProfileIds' },
  seriesGenres: { scope: 'show', key: 'genres' },
  seriesType: { scope: 'show', key: 'seriesType' },
  network: { scope: 'show', key: 'network' },
  sonarrRatingGte: { scope: 'show', key: 'communityRating', bound: 'min' },
  sonarrRatingLte: { scope: 'show', key: 'communityRating', bound: 'max' },
  sonarrEnded: { scope: 'show', key: 'ended' },
  sonarrLastAiredDaysAgoGte: { scope: 'show', key: 'lastAiredDaysAgo', bound: 'min' },
  sonarrLastAiredDaysAgoLte: { scope: 'show', key: 'lastAiredDaysAgo', bound: 'max' },
  sonarrPercentEpisodesGte: { scope: 'show', key: 'episodePercentage', bound: 'min' },
  sonarrPercentEpisodesLte: { scope: 'show', key: 'episodePercentage', bound: 'max' },
} as const;

type ScopedBuckets = Record<
  'shared' | 'movie' | 'show',
  Record<string, FilterValue | undefined>
> & {
  movieQualifiers?: Record<string, number>;
  showQualifiers?: Record<string, number>;
};

function readBinding(buckets: ScopedBuckets, binding: Binding): FilterValue | undefined {
  const value = buckets[binding.scope][binding.key];
  if (binding.bound) return (value as RangeValue | undefined)?.[binding.bound];
  return value;
}

function scopesFor(contentType: 'movie' | 'show'): ContentScope[] {
  return ['shared', contentType];
}

function qualifierFor(
  buckets: ScopedBuckets,
  scope: QualifierScope,
  key: string
): number | undefined {
  const qualifiers = scope === 'movie' ? buckets.movieQualifiers : buckets.showQualifiers;
  return qualifiers?.[key];
}

export function toBrowseParams(
  buckets: ScopedBuckets,
  contentType: 'movie' | 'show'
): MediaFilters {
  const relevantScopes = new Set(scopesFor(contentType));
  const params: MediaFilters = {};
  for (const [name, binding] of Object.entries(BROWSE_PARAM_BINDINGS) as [string, Binding][]) {
    if (!relevantScopes.has(binding.scope)) continue;
    const value = readBinding(buckets, binding);
    if (value === undefined) continue;
    params[name] = value as string | number | boolean;
    if (binding.bound) continue;
    if (binding.scope !== 'movie' && binding.scope !== 'show') continue;
    const providerId = qualifierFor(buckets, binding.scope, binding.key);
    if (providerId !== undefined) params[`${name}ProviderId`] = providerId;
  }
  return params;
}

export function toSaveValues(
  filterState: FilterState,
  contentType: 'movie' | 'show'
): FilterValueEntry[] {
  const scoped = contentType === 'movie' ? filterState.movie : filterState.show;
  const qualifiers =
    contentType === 'movie' ? filterState.movieQualifiers : filterState.showQualifiers;
  const merged: Record<string, FilterValue> = { ...filterState.shared, ...scoped };
  return Object.entries(merged)
    .filter((entry): entry is [string, FilterValue] => entry[1] !== undefined)
    .map(([key, value]) => {
      const providerId = qualifiers[key];
      return providerId === undefined ? { key, value } : { key, value, providerId };
    });
}
