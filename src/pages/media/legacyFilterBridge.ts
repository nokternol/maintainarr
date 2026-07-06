/**
 * Temporary bridge between the registry-derived `useMediaFilters` (Stage 2c)
 * and `MediaFilterBar`/`MediaContent`'s still-flat, individually-named prop
 * contract (Stage 2d — the generic, descriptor-driven render pass tracked in
 * `docs/in_progress/phase-4-client-query-alignment.md`). Deleted whole when
 * 2d lands and `MediaFilterBar` collapses to `onRuleChange(key, value)`.
 *
 * Also bridges the browse-path wire contract: `GET /api/media/movies|series`
 * (`server/modules/media/media.handler.ts`) still expects the pre-Stage-2
 * renamed param names (surface #2 in the fracture ledger) — deleting that
 * translator is separate, unscheduled work, so `toBrowseParams` mirrors it
 * client-side until it's removed.
 */
import type {
  ContentScope,
  FilterState,
  FilterValue,
  RangeValue,
} from '@app/hooks/useMediaFilters';
import type { MediaFilters } from '@app/types/media';

type Bound = 'min' | 'max';

interface Binding {
  scope: ContentScope;
  key: string;
  bound?: Bound;
}

// Legacy prop name -> (scope, registry key, range bound if this name is one
// half of a since-collapsed Gte/Lte pair). No type annotation here — it must
// stay a literal so `keyof typeof LEGACY_BINDINGS` yields the actual field
// names, not `string` (which is what drove LegacyFilterState/legacySetters
// generic before, breaking JSX spread's ability to see named properties).
const LEGACY_BINDINGS = {
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

// Widened to `| undefined` values (not just possibly-absent keys) so
// `debouncedFilters` — typed as `MediaFilters`, whose index signature already
// allows `undefined` — is directly assignable without a cast.
type ScopedBuckets = Record<'shared' | 'movie' | 'show', Record<string, FilterValue | undefined>>;

function readBinding(buckets: ScopedBuckets, binding: Binding): FilterValue | undefined {
  const value = buckets[binding.scope][binding.key];
  if (binding.bound) return (value as RangeValue | undefined)?.[binding.bound];
  return value;
}

function writeBinding(
  setValue: (scope: ContentScope, key: string, value: FilterValue | undefined) => void,
  filterState: FilterState,
  binding: Binding,
  value: FilterValue | undefined
): void {
  if (!binding.bound) {
    setValue(binding.scope, binding.key, value);
    return;
  }
  const existing = filterState[binding.scope][binding.key] as RangeValue | undefined;
  setValue(binding.scope, binding.key, {
    ...existing,
    [binding.bound]: value as number | undefined,
  });
}

type Bool3 = 'true' | 'false' | undefined;

/**
 * Every legacy field, precisely typed exactly as the pre-Stage-2 static
 * `FILTER_FIELDS` catalogue declared it — `MediaFilterBar`'s internals (and
 * the components it hands values to, e.g. `OptionFilter`) still expect these
 * exact per-field shapes, not the generic `FilterValue` union.
 */
export interface LegacyFilterState {
  title: string;
  hasFile: Bool3;
  monitored: Bool3;
  seriesStatus: string | undefined;
  yearMin: number | undefined;
  yearMax: number | undefined;
  movieTagIds: string | undefined;
  seriesTagIds: string | undefined;
  movieQualityProfileIds: string | undefined;
  seriesQualityProfileIds: string | undefined;
  movieGenres: string | undefined;
  seriesGenres: string | undefined;
  seriesType: string | undefined;
  network: string | undefined;
  tautulliWatched: Bool3;
  addedDaysAgoGte: number | undefined;
  addedDaysAgoLte: number | undefined;
  sizeOnDiskGbGte: number | undefined;
  sizeOnDiskGbLte: number | undefined;
  certification: string | undefined;
  radarrImdbRatingGte: number | undefined;
  radarrImdbRatingLte: number | undefined;
  sonarrRatingGte: number | undefined;
  sonarrRatingLte: number | undefined;
  sonarrEnded: Bool3;
  sonarrLastAiredDaysAgoGte: number | undefined;
  sonarrLastAiredDaysAgoLte: number | undefined;
  sonarrPercentEpisodesGte: number | undefined;
  sonarrPercentEpisodesLte: number | undefined;
  lastWatchedDaysAgoGte: number | undefined;
  lastWatchedDaysAgoLte: number | undefined;
  overseerrHasIssue: Bool3;
  overseerrRequestStatus: string | undefined;
  tmdbStatus: string | undefined;
  movieSort: string;
  seriesSort: string;
}

type LegacySetterName = keyof typeof LEGACY_BINDINGS;
type LegacySetterPropName = `set${Capitalize<LegacySetterName>}`;

function capitalize<S extends string>(s: S): Capitalize<S> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<S>;
}

export function toLegacyFilterState(filterState: FilterState): LegacyFilterState {
  // `Partial<LegacyFilterState>` is the real target type with every field
  // optional — a single, narrow assertion once every field is filled below,
  // not a blanket unknown-typed escape hatch. Each individual write is typed
  // per-key via the generic below, so the only thing asserted here is "the
  // loop covered every key" — true by construction (LEGACY_BINDINGS and
  // LegacyFilterState declare the same field set).
  const legacy: Partial<LegacyFilterState> = {};
  for (const name of Object.keys(LEGACY_BINDINGS) as LegacySetterName[]) {
    setLegacyField(legacy, name, readBinding(filterState, LEGACY_BINDINGS[name]));
  }
  legacy.movieSort = filterState.movieSort;
  legacy.seriesSort = filterState.seriesSort;
  return legacy as LegacyFilterState;
}

/** Narrows the generically-read `FilterValue` to field `K`'s declared type — the one place this bridge asserts a value's shape, scoped to a single field rather than the whole object. */
function setLegacyField<K extends LegacySetterName>(
  legacy: Partial<LegacyFilterState>,
  name: K,
  value: FilterValue | undefined
): void {
  legacy[name] = value as LegacyFilterState[K];
}

/** One `setX` closure per legacy field name, writing back through `setValue`. */
export function legacySetters(
  filterState: FilterState,
  setValue: (scope: ContentScope, key: string, value: FilterValue | undefined) => void
): Record<LegacySetterPropName, (value: FilterValue | undefined) => void> {
  const setters = {} as Record<LegacySetterPropName, (value: FilterValue | undefined) => void>;
  for (const name of Object.keys(LEGACY_BINDINGS) as LegacySetterName[]) {
    const propName: LegacySetterPropName = `set${capitalize(name)}`;
    setters[propName] = (value) =>
      writeBinding(setValue, filterState, LEGACY_BINDINGS[name], value);
  }
  return setters;
}

/**
 * The values for one contentType's saved query — `shared` merged with that
 * type's own scope, plain registry keys. Scoping by contentType (rather than
 * merging movie+show together) is what avoids the tagIds/qualityProfileIds/
 * genres collision the two scopes intentionally share the same key for.
 */
export function toSaveValues(
  filterState: FilterState,
  contentType: 'movie' | 'show'
): Record<string, FilterValue> {
  const scoped = contentType === 'movie' ? filterState.movie : filterState.show;
  const merged: Record<string, FilterValue> = { ...filterState.shared, ...scoped };
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));
}

// Legacy browse-path param name for a (scope, key, bound) triple — the exact
// names `server/modules/media/media.handler.ts`'s MOVIE_PARAM_TO_KEY /
// SERIES_PARAM_TO_KEY still expect. Kept separate from LEGACY_BINDINGS above
// because sonarrRatingGte/Lte map to `communityRating` there but the browse
// path itself has no naming quirks beyond what's already in LEGACY_BINDINGS —
// this reuses the same table, just serialized instead of read as UI props.
function scopesFor(contentType: 'movie' | 'show'): ContentScope[] {
  return ['shared', contentType];
}

export function toBrowseParams(
  buckets: ScopedBuckets,
  contentType: 'movie' | 'show'
): MediaFilters {
  const relevantScopes = new Set(scopesFor(contentType));
  const params: MediaFilters = {};
  for (const [name, binding] of Object.entries(LEGACY_BINDINGS)) {
    if (!relevantScopes.has(binding.scope)) continue;
    const value = readBinding(buckets, binding);
    if (value === undefined) continue;
    params[name] = value as string | number | boolean;
  }
  return params;
}
