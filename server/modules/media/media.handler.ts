import { MetadataProviderType } from '@server/database/schema';
import { MediaCache } from '@server/kernel/cache';
import type { DrizzleDb } from '@server/kernel/db';
import { defineRoute } from '@server/kernel/defineRoute';
import { getChildLogger } from '@server/kernel/logger';
import {
  type IProviderFactory,
  type JellyfinItem,
  type JellyfinProvider,
  type PlexMediaItem,
  type PlexProvider,
  ProviderFactory,
  type ProviderSettingsService,
  type RadarrMovie,
  type RadarrProfile,
  type RadarrProvider,
  type RadarrTag,
  type SonarrProfile,
  type SonarrProvider,
  type SonarrSeries,
  type SonarrTag,
} from '@server/modules/providers';
import { z } from 'zod';
import type {
  FilterValue,
  FilterValueEntry,
  MovieRangeRuleKey,
  NormalizedMovie,
  NormalizedShow,
  RangeValue,
  ShowRangeRuleKey,
} from './filterRegistry';
import { paginateItems } from './media.pagination';
import { sortMedia } from './media.sort';
import { resolutionTier } from './mediaFieldProvider';
import { itemKey, rawItemKey } from './mediaItem';
import type { MediaQueryEngine } from './mediaQueryEngine';
import { resetMediaData } from './mediaReset';
import type { MediaSource } from './mediaSource';
import { sourceOwnership } from './mediaSourceFactory';
import { normalizeRadarrMovie, normalizeSonarrSeries } from './normalizeMedia';

const log = getChildLogger('MediaHandler');

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().optional().default(48),
});

// Query-param coercion helpers (browse params arrive as strings).
const num = () => z.coerce.number().optional();
const intNum = () => z.coerce.number().int().optional();
const bool3 = () =>
  z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional();
const sortField = z
  .enum(['title_asc', 'title_desc', 'year_asc', 'year_desc', 'status_asc', 'status_desc'])
  .optional()
  .default('title_asc');

// Fields valid for both content types — including the enriched predicates.
const sharedFilterFields = {
  title: z.string().optional(),
  yearMin: intNum(),
  yearMax: intNum(),
  certification: z.string().optional(),
  addedDaysAgoGte: intNum(),
  addedDaysAgoLte: intNum(),
  sizeOnDiskGbGte: num(),
  sizeOnDiskGbLte: num(),
  overseerrRequestStatus: intNum(),
  overseerrHasIssue: bool3(),
  tmdbStatus: z.string().optional(),
  lastWatchedDaysAgoGte: intNum(),
  lastWatchedDaysAgoLte: intNum(),
  plexAddedDaysAgoGte: intNum(),
  plexAddedDaysAgoLte: intNum(),
  jellyfinAddedDaysAgoGte: intNum(),
  jellyfinAddedDaysAgoLte: intNum(),
  fileSizeBytesGte: num(),
  fileSizeBytesLte: num(),
  releaseDaysAgoGte: intNum(),
  releaseDaysAgoLte: intNum(),
  fileContainer: z.string().optional(),
  videoCodec: z.string().optional(),
  audioCodec: z.string().optional(),
  fileResolution: z.string().optional(),
  labels: z.string().optional(),
  jellyfinIsFavorite: bool3(),
  sort: sortField,
  tautulliWatched: z.enum(['true', 'false']).optional(),
};

// Positive-int qualifier for an instance-scoped rule's sibling `*ProviderId` param —
// which instance's namespace the paired id list belongs to (§10). Absent means unqualified.
const providerIdParam = () => z.coerce.number().int().positive().optional();

const moviesQuerySchema = paginationQuerySchema.extend({
  ...sharedFilterFields,
  hasFile: bool3(),
  movieTagIds: z.string().optional(),
  movieTagIdsProviderId: providerIdParam(),
  movieQualityProfileIds: z.string().optional(),
  movieQualityProfileIdsProviderId: providerIdParam(),
  movieGenres: z.string().optional(),
  radarrImdbRatingGte: num(),
  radarrImdbRatingLte: num(),
  runtimeMinutesGte: intNum(),
  runtimeMinutesLte: intNum(),
  movieFileCountGte: intNum(),
  movieFileCountLte: intNum(),
  inCinemasDaysAgoGte: intNum(),
  inCinemasDaysAgoLte: intNum(),
  physicalReleaseDaysAgoGte: intNum(),
  physicalReleaseDaysAgoLte: intNum(),
  digitalReleaseDaysAgoGte: intNum(),
  digitalReleaseDaysAgoLte: intNum(),
  releaseGroups: z.string().optional(),
  collectionName: z.string().optional(),
  isAvailable: bool3(),
  radarrStatus: z.string().optional(),
});

const seriesQuerySchema = paginationQuerySchema.extend({
  ...sharedFilterFields,
  monitored: bool3(),
  seriesStatus: z.string().optional(),
  seriesTagIds: z.string().optional(),
  seriesTagIdsProviderId: providerIdParam(),
  seriesQualityProfileIds: z.string().optional(),
  seriesQualityProfileIdsProviderId: providerIdParam(),
  seriesGenres: z.string().optional(),
  seriesType: z.string().optional(),
  network: z.string().optional(),
  sonarrRatingGte: num(),
  sonarrRatingLte: num(),
  sonarrEnded: bool3(),
  sonarrLastAiredDaysAgoGte: intNum(),
  sonarrLastAiredDaysAgoLte: intNum(),
  sonarrPercentEpisodesGte: num(),
  sonarrPercentEpisodesLte: num(),
});

// ─── Registry delegation ───────────────────────────────────────────────────────
// The browse contract uses content-prefixed param names; the registry uses bare
// keys. These maps bridge URL param → registry key so a single engine
// (filterRegistry) backs both the browse path and the automation executor.

// A URL param maps onto a registry key directly, or (for a range rule) contributes
// one bound (`min`/`max`) of that key's `{ min?, max? }` value.
interface ParamMapping {
  key: string;
  bound?: 'min' | 'max';
  /** Name of this param's sibling instance-qualifier param (§10), for `instanceScoped`
   *  rules only — `movieTagIds` pairs with `movieTagIdsProviderId`, for example. */
  providerIdParam?: string;
}

const MOVIE_PARAM_TO_KEY = {
  title: { key: 'title' },
  yearMin: { key: 'year', bound: 'min' },
  yearMax: { key: 'year', bound: 'max' },
  hasFile: { key: 'hasFile' },
  movieTagIds: { key: 'tagIds', providerIdParam: 'movieTagIdsProviderId' },
  movieQualityProfileIds: {
    key: 'qualityProfileIds',
    providerIdParam: 'movieQualityProfileIdsProviderId',
  },
  movieGenres: { key: 'genres' },
  tautulliWatched: { key: 'watched' },
  certification: { key: 'certification' },
  addedDaysAgoGte: { key: 'addedDaysAgo', bound: 'min' },
  addedDaysAgoLte: { key: 'addedDaysAgo', bound: 'max' },
  sizeOnDiskGbGte: { key: 'sizeOnDiskGb', bound: 'min' },
  sizeOnDiskGbLte: { key: 'sizeOnDiskGb', bound: 'max' },
  radarrImdbRatingGte: { key: 'imdbRating', bound: 'min' },
  radarrImdbRatingLte: { key: 'imdbRating', bound: 'max' },
  runtimeMinutesGte: { key: 'runtimeMinutes', bound: 'min' },
  runtimeMinutesLte: { key: 'runtimeMinutes', bound: 'max' },
  overseerrRequestStatus: { key: 'overseerrRequestStatus' },
  overseerrHasIssue: { key: 'overseerrHasIssue' },
  tmdbStatus: { key: 'tmdbStatus' },
  lastWatchedDaysAgoGte: { key: 'lastWatchedDaysAgo', bound: 'min' },
  lastWatchedDaysAgoLte: { key: 'lastWatchedDaysAgo', bound: 'max' },
  plexAddedDaysAgoGte: { key: 'plexAddedDaysAgo', bound: 'min' },
  plexAddedDaysAgoLte: { key: 'plexAddedDaysAgo', bound: 'max' },
  jellyfinAddedDaysAgoGte: { key: 'jellyfinAddedDaysAgo', bound: 'min' },
  jellyfinAddedDaysAgoLte: { key: 'jellyfinAddedDaysAgo', bound: 'max' },
  fileSizeBytesGte: { key: 'fileSizeBytes', bound: 'min' },
  fileSizeBytesLte: { key: 'fileSizeBytes', bound: 'max' },
  releaseDaysAgoGte: { key: 'releaseDaysAgo', bound: 'min' },
  releaseDaysAgoLte: { key: 'releaseDaysAgo', bound: 'max' },
  fileContainer: { key: 'fileContainer' },
  videoCodec: { key: 'videoCodec' },
  audioCodec: { key: 'audioCodec' },
  fileResolution: { key: 'fileResolution' },
  labels: { key: 'labels' },
  movieFileCountGte: { key: 'movieFileCount', bound: 'min' },
  movieFileCountLte: { key: 'movieFileCount', bound: 'max' },
  releaseGroups: { key: 'releaseGroups' },
  inCinemasDaysAgoGte: { key: 'inCinemasDaysAgo', bound: 'min' },
  inCinemasDaysAgoLte: { key: 'inCinemasDaysAgo', bound: 'max' },
  physicalReleaseDaysAgoGte: { key: 'physicalReleaseDaysAgo', bound: 'min' },
  physicalReleaseDaysAgoLte: { key: 'physicalReleaseDaysAgo', bound: 'max' },
  digitalReleaseDaysAgoGte: { key: 'digitalReleaseDaysAgo', bound: 'min' },
  digitalReleaseDaysAgoLte: { key: 'digitalReleaseDaysAgo', bound: 'max' },
  collectionName: { key: 'collectionName' },
  isAvailable: { key: 'isAvailable' },
  radarrStatus: { key: 'radarrStatus' },
  jellyfinIsFavorite: { key: 'jellyfinIsFavorite' },
} as const satisfies Record<string, ParamMapping>;

const SERIES_PARAM_TO_KEY = {
  title: { key: 'title' },
  yearMin: { key: 'year', bound: 'min' },
  yearMax: { key: 'year', bound: 'max' },
  monitored: { key: 'monitored' },
  seriesStatus: { key: 'seriesStatus' },
  seriesTagIds: { key: 'tagIds', providerIdParam: 'seriesTagIdsProviderId' },
  seriesQualityProfileIds: {
    key: 'qualityProfileIds',
    providerIdParam: 'seriesQualityProfileIdsProviderId',
  },
  seriesGenres: { key: 'genres' },
  seriesType: { key: 'seriesType' },
  network: { key: 'network' },
  tautulliWatched: { key: 'watched' },
  certification: { key: 'certification' },
  addedDaysAgoGte: { key: 'addedDaysAgo', bound: 'min' },
  addedDaysAgoLte: { key: 'addedDaysAgo', bound: 'max' },
  sizeOnDiskGbGte: { key: 'sizeOnDiskGb', bound: 'min' },
  sizeOnDiskGbLte: { key: 'sizeOnDiskGb', bound: 'max' },
  sonarrRatingGte: { key: 'communityRating', bound: 'min' },
  sonarrRatingLte: { key: 'communityRating', bound: 'max' },
  sonarrEnded: { key: 'ended' },
  sonarrLastAiredDaysAgoGte: { key: 'lastAiredDaysAgo', bound: 'min' },
  sonarrLastAiredDaysAgoLte: { key: 'lastAiredDaysAgo', bound: 'max' },
  sonarrPercentEpisodesGte: { key: 'episodePercentage', bound: 'min' },
  sonarrPercentEpisodesLte: { key: 'episodePercentage', bound: 'max' },
  overseerrRequestStatus: { key: 'overseerrRequestStatus' },
  overseerrHasIssue: { key: 'overseerrHasIssue' },
  tmdbStatus: { key: 'tmdbStatus' },
  lastWatchedDaysAgoGte: { key: 'lastWatchedDaysAgo', bound: 'min' },
  lastWatchedDaysAgoLte: { key: 'lastWatchedDaysAgo', bound: 'max' },
  plexAddedDaysAgoGte: { key: 'plexAddedDaysAgo', bound: 'min' },
  plexAddedDaysAgoLte: { key: 'plexAddedDaysAgo', bound: 'max' },
  jellyfinAddedDaysAgoGte: { key: 'jellyfinAddedDaysAgo', bound: 'min' },
  jellyfinAddedDaysAgoLte: { key: 'jellyfinAddedDaysAgo', bound: 'max' },
  fileSizeBytesGte: { key: 'fileSizeBytes', bound: 'min' },
  fileSizeBytesLte: { key: 'fileSizeBytes', bound: 'max' },
  releaseDaysAgoGte: { key: 'releaseDaysAgo', bound: 'min' },
  releaseDaysAgoLte: { key: 'releaseDaysAgo', bound: 'max' },
  fileContainer: { key: 'fileContainer' },
  videoCodec: { key: 'videoCodec' },
  audioCodec: { key: 'audioCodec' },
  fileResolution: { key: 'fileResolution' },
  labels: { key: 'labels' },
  jellyfinIsFavorite: { key: 'jellyfinIsFavorite' },
} as const satisfies Record<string, ParamMapping>;

/**
 * Range-rule coverage witness, per content type: a plain `as const`-style lookup —
 * registry rule key → the (possibly legacy-renamed) `*_PARAM_TO_KEY` entry names that
 * cover it — typed as `Record<RuleKey, ...>` so it's exhaustive over the
 * registry-derived `MovieRangeRuleKey`/`ShowRangeRuleKey` union, and each `gte`/`lte`
 * value is typed `keyof typeof *_PARAM_TO_KEY` so a typo or a dangling reference to a
 * removed param also fails to compile. A new range rule, or a rule's content-type
 * scope changing, breaks this map until it's updated — not a silently-dropped filter
 * (caught the hard way once already: `plexAddedDaysAgo` shipped in the registry with
 * no entry in any of the five browse-path translators, and nothing failed to
 * compile). Deliberately a satellite map, not a restructuring of `*_PARAM_TO_KEY`
 * itself: the browse URL contract (`radarrImdbRatingGte`, `sonarrRatingGte`,
 * `yearMin`/`yearMax`, …) is a deliberately-renamed legacy vocabulary (see the
 * fracture ledger's "Filter/rule vocabulary" entry) with no derivable relationship to
 * registry keys, so `*_PARAM_TO_KEY`'s own keys can never be checked directly against
 * `MEDIA_RULES` without breaking that vocabulary.
 */
const _MOVIE_RANGE_PARAM_WITNESS: Record<
  MovieRangeRuleKey,
  { gte: keyof typeof MOVIE_PARAM_TO_KEY; lte: keyof typeof MOVIE_PARAM_TO_KEY }
> = {
  year: { gte: 'yearMin', lte: 'yearMax' },
  addedDaysAgo: { gte: 'addedDaysAgoGte', lte: 'addedDaysAgoLte' },
  plexAddedDaysAgo: { gte: 'plexAddedDaysAgoGte', lte: 'plexAddedDaysAgoLte' },
  jellyfinAddedDaysAgo: { gte: 'jellyfinAddedDaysAgoGte', lte: 'jellyfinAddedDaysAgoLte' },
  sizeOnDiskGb: { gte: 'sizeOnDiskGbGte', lte: 'sizeOnDiskGbLte' },
  imdbRating: { gte: 'radarrImdbRatingGte', lte: 'radarrImdbRatingLte' },
  runtimeMinutes: { gte: 'runtimeMinutesGte', lte: 'runtimeMinutesLte' },
  fileSizeBytes: { gte: 'fileSizeBytesGte', lte: 'fileSizeBytesLte' },
  releaseDaysAgo: { gte: 'releaseDaysAgoGte', lte: 'releaseDaysAgoLte' },
  lastWatchedDaysAgo: { gte: 'lastWatchedDaysAgoGte', lte: 'lastWatchedDaysAgoLte' },
  movieFileCount: { gte: 'movieFileCountGte', lte: 'movieFileCountLte' },
  inCinemasDaysAgo: { gte: 'inCinemasDaysAgoGte', lte: 'inCinemasDaysAgoLte' },
  physicalReleaseDaysAgo: { gte: 'physicalReleaseDaysAgoGte', lte: 'physicalReleaseDaysAgoLte' },
  digitalReleaseDaysAgo: { gte: 'digitalReleaseDaysAgoGte', lte: 'digitalReleaseDaysAgoLte' },
};

const _SERIES_RANGE_PARAM_WITNESS: Record<
  ShowRangeRuleKey,
  { gte: keyof typeof SERIES_PARAM_TO_KEY; lte: keyof typeof SERIES_PARAM_TO_KEY }
> = {
  year: { gte: 'yearMin', lte: 'yearMax' },
  addedDaysAgo: { gte: 'addedDaysAgoGte', lte: 'addedDaysAgoLte' },
  plexAddedDaysAgo: { gte: 'plexAddedDaysAgoGte', lte: 'plexAddedDaysAgoLte' },
  jellyfinAddedDaysAgo: { gte: 'jellyfinAddedDaysAgoGte', lte: 'jellyfinAddedDaysAgoLte' },
  sizeOnDiskGb: { gte: 'sizeOnDiskGbGte', lte: 'sizeOnDiskGbLte' },
  fileSizeBytes: { gte: 'fileSizeBytesGte', lte: 'fileSizeBytesLte' },
  releaseDaysAgo: { gte: 'releaseDaysAgoGte', lte: 'releaseDaysAgoLte' },
  communityRating: { gte: 'sonarrRatingGte', lte: 'sonarrRatingLte' },
  lastAiredDaysAgo: { gte: 'sonarrLastAiredDaysAgoGte', lte: 'sonarrLastAiredDaysAgoLte' },
  episodePercentage: { gte: 'sonarrPercentEpisodesGte', lte: 'sonarrPercentEpisodesLte' },
  lastWatchedDaysAgo: { gte: 'lastWatchedDaysAgoGte', lte: 'lastWatchedDaysAgoLte' },
};

/**
 * Zod-schema coverage check: every param name `*_PARAM_TO_KEY` references must be a
 * field the query schema actually accepts — otherwise it's stripped by validation
 * before `toFilterValues` ever sees it, the same silent-drop failure mode as a missing
 * `*_PARAM_TO_KEY` entry, just one layer earlier. `Missing` is the param-name set
 * `*_PARAM_TO_KEY` references that the schema's inferred shape doesn't have; requiring
 * those as `never`-typed properties makes the assignment fail naming them by name if
 * the schema falls out of sync.
 */
type MovieSchemaShape = z.infer<typeof moviesQuerySchema>;
type MovieSchemaMissing = Exclude<keyof typeof MOVIE_PARAM_TO_KEY, keyof MovieSchemaShape>;
const _movieSchemaCoversParams: MovieSchemaShape & Record<MovieSchemaMissing, never> =
  {} as MovieSchemaShape;

type SeriesSchemaShape = z.infer<typeof seriesQuerySchema>;
type SeriesSchemaMissing = Exclude<keyof typeof SERIES_PARAM_TO_KEY, keyof SeriesSchemaShape>;
const _seriesSchemaCoversParams: SeriesSchemaShape & Record<SeriesSchemaMissing, never> =
  {} as SeriesSchemaShape;

// Project a browse query's content-prefixed params onto registry-keyed filter
// values — the include source the MediaQueryEngine evaluates for the browse view.
// Gte/Lte param pairs targeting the same range rule merge into one `{ min?, max? }` entry.
function toFilterValues(
  query: Record<string, unknown>,
  paramMap: Record<string, ParamMapping>
): FilterValueEntry[] {
  const entries: FilterValueEntry[] = [];
  const ranges = new Map<string, RangeValue>();

  for (const [param, { key, bound, providerIdParam }] of Object.entries(paramMap)) {
    const raw = query[param];
    if (raw === undefined) continue;
    if (bound) {
      const range = ranges.get(key) ?? {};
      range[bound] = Number(raw);
      ranges.set(key, range);
    } else {
      const entry: FilterValueEntry = { key, value: raw as FilterValue };
      const rawProviderId = providerIdParam ? query[providerIdParam] : undefined;
      if (rawProviderId !== undefined) entry.providerId = Number(rawProviderId);
      entries.push(entry);
    }
  }
  for (const [key, value] of ranges) {
    entries.push({ key, value });
  }
  return entries;
}

// ─── Handler-local helpers ────────────────────────────────────────────────────

function computeYearRange(items: Array<{ year?: number }>): {
  min: number | null;
  max: number | null;
} {
  const years = items
    .map((m) => m.year)
    .filter((y): y is number => y !== undefined && y !== null && y >= 1888);
  if (years.length === 0) return { min: null, max: null };
  return { min: Math.min(...years), max: Math.max(...years) };
}

// ─── Handler cradle ────────────────────────────────────────────────────────────

interface MediaCradle {
  providerSettingsService: ProviderSettingsService;
  providerFactory?: IProviderFactory;
  mediaQueryEngine: MediaQueryEngine;
  db?: DrizzleDb;
}

export interface MediaError {
  provider: string;
  error: string;
}

interface MovieSublist {
  providerId: number;
  providerName: string;
  movies: RadarrMovie[];
}

interface SeriesSublist {
  providerId: number;
  providerName: string;
  series: SonarrSeries[];
}

interface DecoratedTag extends RadarrTag {
  providerId: number;
  providerName: string;
}

interface DecoratedProfile extends RadarrProfile {
  providerId: number;
  providerName: string;
}

/** A raw provider row carrying which instance it came from — internal grouping state only. */
type Attributed<T> = T & { providerId: number };

/**
 * Groups matched raw rows by native primary id (fallback `providerId:id` when absent),
 * computed live per request — no DB join, no dependency on the identity job having run,
 * the same key `resolveGroup` uses so browse and persistence agree by construction.
 * Filter semantics are ANY: grouping happens after engine matching, so a title appears if
 * at least one of its copies matched. The representative is the first matched copy in the
 * current sort order; `sourceCount`/`sourceProviderIds` are additive — with one instance
 * every group is a singleton, so the row is byte-identical apart from these two fields.
 */
function groupByPrimaryId<T extends { id: number }>(
  sorted: Attributed<T>[],
  primaryIdOf: (row: T) => number | null | undefined
): Array<T & { sourceCount: number; sourceProviderIds: number[] }> {
  const groups = new Map<string, Attributed<T>[]>();
  for (const row of sorted) {
    const primaryId = primaryIdOf(row);
    const key = primaryId != null ? `primary:${primaryId}` : rawItemKey(row.providerId, row.id);
    const copies = groups.get(key);
    if (copies) copies.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()].map((copies) => {
    const { providerId: _providerId, ...representative } = copies[0];
    return {
      ...representative,
      sourceCount: copies.length,
      sourceProviderIds: copies.map((c) => c.providerId),
    } as unknown as T & { sourceCount: number; sourceProviderIds: number[] };
  });
}

function toMediaError(providerName: string, err: unknown): MediaError {
  return {
    provider: providerName,
    error: err instanceof Error ? err.message : 'Unknown error',
  };
}

export function createMediaHandlers(cradle: MediaCradle) {
  const { providerSettingsService, mediaQueryEngine } = cradle;
  const factory = cradle.providerFactory ?? new ProviderFactory();

  // Caches are owned by this factory invocation — same inputs produce isolated state.
  const moviesCache = new MediaCache<{ sublists: MovieSublist[]; errors: MediaError[] }>();
  const seriesCache = new MediaCache<{ sublists: SeriesSublist[]; errors: MediaError[] }>();
  const tagsCache = new MediaCache<{
    radarr: DecoratedTag[];
    sonarr: DecoratedTag[];
  }>();
  const qualityProfilesCache = new MediaCache<{
    radarr: DecoratedProfile[];
    sonarr: DecoratedProfile[];
  }>();
  const genresCache = new MediaCache<{ movies: string[]; series: string[] }>();
  const networksCache = new MediaCache<string[]>();
  const studioCache = new MediaCache<string[]>();
  const releaseGroupsCache = new MediaCache<string[]>();
  const collectionNamesCache = new MediaCache<string[]>();
  const fileContainerCache = new MediaCache<string[]>();
  const videoCodecCache = new MediaCache<string[]>();
  const audioCodecCache = new MediaCache<string[]>();
  const fileResolutionCache = new MediaCache<string[]>();
  const labelsCache = new MediaCache<string[]>();
  const plexItemsCache = new MediaCache<PlexMediaItem[]>();
  const jellyfinItemsCache = new MediaCache<JellyfinItem[]>();

  /** One active Radarr instance's library, kept separate so browse can attribute copies. */
  async function getMovies(): Promise<{ sublists: MovieSublist[]; errors: MediaError[] }> {
    return moviesCache.getOrFetch('movies', async () => {
      const errors: MediaError[] = [];
      const providers = await providerSettingsService.findActiveByTypes([
        MetadataProviderType.RADARR,
      ]);
      const sublists: MovieSublist[] = [];
      await Promise.all(
        providers.map(async (provider) => {
          try {
            const radarr = factory.create(provider, log) as RadarrProvider;
            const movies = await radarr.getMovies();
            sublists.push({ providerId: provider.id, providerName: provider.name, movies });
          } catch (err) {
            log.warn('Radarr fetch failed', { provider: provider.name, err });
            errors.push(toMediaError(provider.name, err));
          }
        })
      );
      return { sublists, errors };
    });
  }

  /** One active Sonarr instance's library, kept separate so browse can attribute copies. */
  async function getSeries(): Promise<{ sublists: SeriesSublist[]; errors: MediaError[] }> {
    return seriesCache.getOrFetch('series', async () => {
      const errors: MediaError[] = [];
      const providers = await providerSettingsService.findActiveByTypes([
        MetadataProviderType.SONARR,
      ]);
      const sublists: SeriesSublist[] = [];
      await Promise.all(
        providers.map(async (provider) => {
          try {
            const sonarr = factory.create(provider, log) as SonarrProvider;
            const series = await sonarr.getSeries();
            sublists.push({ providerId: provider.id, providerName: provider.name, series });
          } catch (err) {
            log.warn('Sonarr fetch failed', { provider: provider.name, err });
            errors.push(toMediaError(provider.name, err));
          }
        })
      );
      return { sublists, errors };
    });
  }

  /** Every active Plex instance's flattened library — shared by every Plex-sourced
   *  lookup (studio, file-tech fields, labels) so each fetches Plex once, not once
   *  per lookup route. */
  async function getPlexItems(): Promise<PlexMediaItem[]> {
    return plexItemsCache.getOrFetch('plexItems', async () => {
      const providers = await providerSettingsService.findActiveByTypes([
        MetadataProviderType.PLEX,
      ]);
      const all: PlexMediaItem[] = [];
      await Promise.all(
        providers.map(async (provider) => {
          try {
            const plex = factory.create(provider, log) as PlexProvider;
            all.push(...(await plex.getAllItems()));
          } catch (err) {
            log.warn('Plex fetch failed', { provider: provider.name, err });
          }
        })
      );
      return all;
    });
  }

  /** Every active Jellyfin instance's flattened library — shared by every
   *  Jellyfin-sourced lookup, same one-fetch-per-route-set shape as getPlexItems. */
  async function getJellyfinItems(): Promise<JellyfinItem[]> {
    return jellyfinItemsCache.getOrFetch('jellyfinItems', async () => {
      const providers = await providerSettingsService.findActiveByTypes([
        MetadataProviderType.JELLYFIN,
      ]);
      const all: JellyfinItem[] = [];
      await Promise.all(
        providers.map(async (provider) => {
          try {
            const jellyfin = factory.create(provider, log) as JellyfinProvider;
            all.push(...(await jellyfin.getAllItems()));
          } catch (err) {
            log.warn('Jellyfin fetch failed', { provider: provider.name, err });
          }
        })
      );
      return all;
    });
  }

  function values(v: string | string[] | undefined): string[] {
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  }

  /** Dedupe+sort a string projection over every fetched Plex and Jellyfin item —
   *  the shape every file-tech/studio/label lookup route shares. Per the spec,
   *  Jellyfin joins these rules as an additional producer alongside Plex, so
   *  every route aggregates both configured servers' already-fetched library
   *  data rather than just one. */
  function mediaServerStringLookup(
    cache: MediaCache<string[]>,
    cacheKey: string,
    pickPlex: (item: PlexMediaItem) => string | string[] | undefined,
    pickJellyfin: (item: JellyfinItem) => string | string[] | undefined
  ) {
    return () =>
      cache.getOrFetch(cacheKey, async () => {
        const [plexItems, jellyfinItems] = await Promise.all([getPlexItems(), getJellyfinItems()]);
        const all = [
          ...plexItems.flatMap((item) => values(pickPlex(item))),
          ...jellyfinItems.flatMap((item) => values(pickJellyfin(item))),
        ];
        return [...new Set(all)].sort();
      });
  }

  function invalidateMediaCaches(): void {
    moviesCache.invalidate('movies');
    seriesCache.invalidate('series');
    tagsCache.invalidate('tags');
    qualityProfilesCache.invalidate('qualityProfiles');
    genresCache.invalidate('genres');
    networksCache.invalidate('networks');
    studioCache.invalidate('studio');
    releaseGroupsCache.invalidate('releaseGroups');
    collectionNamesCache.invalidate('collectionNames');
    fileContainerCache.invalidate('fileContainer');
    videoCodecCache.invalidate('videoCodec');
    audioCodecCache.invalidate('audioCodec');
    fileResolutionCache.invalidate('fileResolution');
    labelsCache.invalidate('labels');
    plexItemsCache.invalidate('plexItems');
    jellyfinItemsCache.invalidate('jellyfinItems');
  }

  return {
    invalidateMediaCaches,

    listMovies: defineRoute({
      schemas: { query: moviesQuerySchema },
      handler: async ({ query }) => {
        const { sublists, errors } = await getMovies();
        const all = sublists.flatMap((s) => s.movies);

        const yearRange = computeYearRange(all);
        const source: MediaSource = {
          getMediaItems: async () =>
            sublists.flatMap(({ providerId, movies }) =>
              movies.map((m) => normalizeRadarrMovie(m, providerId))
            ),
          idOf: (item) => (item as NormalizedMovie)._sourceIds.radarr,
        };
        const matched = await mediaQueryEngine.evaluate({
          source,
          contentType: 'movie',
          sources: [{ filterValues: toFilterValues(query, MOVIE_PARAM_TO_KEY), role: 'include' }],
        });
        const matchedKeys = new Set(matched.map((m) => itemKey(m)));
        const matchedRaw: Attributed<RadarrMovie>[] = sublists.flatMap(({ providerId, movies }) =>
          movies
            .filter((m) => matchedKeys.has(rawItemKey(providerId, m.id)))
            .map((m) => ({ ...m, providerId }))
        );
        const sorted = sortMedia(matchedRaw, query.sort, (m) => m.hasFile);
        const grouped = groupByPrimaryId(sorted, (m) => m.tmdbId);
        return {
          ...paginateItems(grouped, { page: query.page, pageSize: query.pageSize }),
          yearRange,
          errors,
        };
      },
    }),

    listSeries: defineRoute({
      schemas: { query: seriesQuerySchema },
      handler: async ({ query }) => {
        const { sublists, errors } = await getSeries();
        const all = sublists.flatMap((s) => s.series);

        const yearRange = computeYearRange(all);
        const source: MediaSource = {
          getMediaItems: async () =>
            sublists.flatMap(({ providerId, series }) =>
              series.map((s) => normalizeSonarrSeries(s, providerId))
            ),
          idOf: (item) => (item as NormalizedShow)._sourceIds.sonarr,
        };
        const matched = await mediaQueryEngine.evaluate({
          source,
          contentType: 'show',
          sources: [{ filterValues: toFilterValues(query, SERIES_PARAM_TO_KEY), role: 'include' }],
        });
        const matchedKeys = new Set(matched.map((s) => itemKey(s)));
        const matchedRaw: Attributed<SonarrSeries>[] = sublists.flatMap(({ providerId, series }) =>
          series
            .filter((s) => matchedKeys.has(rawItemKey(providerId, s.id)))
            .map((s) => ({ ...s, providerId }))
        );
        const sorted = sortMedia(matchedRaw, query.sort, (s) => s.monitored);
        const grouped = groupByPrimaryId(sorted, (s) => s.tvdbId);
        return {
          ...paginateItems(grouped, { page: query.page, pageSize: query.pageSize }),
          yearRange,
          errors,
        };
      },
    }),

    listTags: defineRoute({
      handler: () =>
        tagsCache.getOrFetch('tags', async () => {
          const providers = await providerSettingsService.findActiveByTypes([
            MetadataProviderType.RADARR,
            MetadataProviderType.SONARR,
          ]);

          const radarrTags: DecoratedTag[] = [];
          const sonarrTags: DecoratedTag[] = [];

          await Promise.all(
            providers.map(async (provider) => {
              try {
                if (provider.type === MetadataProviderType.RADARR) {
                  const radarr = factory.create(provider, log) as RadarrProvider;
                  const tags = await radarr.getTags();
                  radarrTags.push(
                    ...tags.map((t) => ({
                      ...t,
                      providerId: provider.id,
                      providerName: provider.name,
                    }))
                  );
                } else if (provider.type === MetadataProviderType.SONARR) {
                  const sonarr = factory.create(provider, log) as SonarrProvider;
                  const tags = await sonarr.getTags();
                  sonarrTags.push(
                    ...tags.map((t) => ({
                      ...t,
                      providerId: provider.id,
                      providerName: provider.name,
                    }))
                  );
                }
              } catch (err) {
                log.warn('Tags fetch failed', { provider: provider.name, err });
              }
            })
          );

          return { radarr: radarrTags, sonarr: sonarrTags };
        }),
    }),

    listQualityProfiles: defineRoute({
      handler: () =>
        qualityProfilesCache.getOrFetch('qualityProfiles', async () => {
          const providers = await providerSettingsService.findActiveByTypes([
            MetadataProviderType.RADARR,
            MetadataProviderType.SONARR,
          ]);

          const radarrProfiles: DecoratedProfile[] = [];
          const sonarrProfiles: DecoratedProfile[] = [];

          await Promise.all(
            providers.map(async (provider) => {
              try {
                if (provider.type === MetadataProviderType.RADARR) {
                  const radarr = factory.create(provider, log) as RadarrProvider;
                  const profiles = await radarr.getProfiles();
                  radarrProfiles.push(
                    ...profiles.map((p) => ({
                      ...p,
                      providerId: provider.id,
                      providerName: provider.name,
                    }))
                  );
                } else if (provider.type === MetadataProviderType.SONARR) {
                  const sonarr = factory.create(provider, log) as SonarrProvider;
                  const profiles = await sonarr.getProfiles();
                  sonarrProfiles.push(
                    ...profiles.map((p) => ({
                      ...p,
                      providerId: provider.id,
                      providerName: provider.name,
                    }))
                  );
                }
              } catch (err) {
                log.warn('Quality profiles fetch failed', { provider: provider.name, err });
              }
            })
          );

          return { radarr: radarrProfiles, sonarr: sonarrProfiles };
        }),
    }),

    listGenres: defineRoute({
      handler: () =>
        genresCache.getOrFetch('genres', async () => {
          const [{ sublists: movieSublists }, { sublists: seriesSublists }] = await Promise.all([
            getMovies(),
            getSeries(),
          ]);
          const movies = movieSublists.flatMap((s) => s.movies);
          const series = seriesSublists.flatMap((s) => s.series);
          return {
            movies: [...new Set(movies.flatMap((m) => m.genres ?? []))].sort(),
            series: [...new Set(series.flatMap((s) => s.genres ?? []))].sort(),
          };
        }),
    }),

    listNetworks: defineRoute({
      handler: () =>
        networksCache.getOrFetch('networks', async () => {
          const { sublists } = await getSeries();
          const all = sublists.flatMap((s) => s.series);
          return [...new Set(all.map((s) => s.network).filter((n): n is string => !!n))].sort();
        }),
    }),

    listStudio: defineRoute({
      handler: mediaServerStringLookup(
        studioCache,
        'studio',
        (i) => i.studio,
        (i) => i.Studios?.map((s) => s.Name)
      ),
    }),

    listReleaseGroups: defineRoute({
      handler: () =>
        releaseGroupsCache.getOrFetch('releaseGroups', async () => {
          const { sublists } = await getMovies();
          const all = sublists.flatMap((s) => s.movies);
          return [...new Set(all.flatMap((m) => m.statistics?.releaseGroups ?? []))].sort();
        }),
    }),

    listCollectionNames: defineRoute({
      handler: () =>
        collectionNamesCache.getOrFetch('collectionNames', async () => {
          const { sublists } = await getMovies();
          const all = sublists.flatMap((s) => s.movies);
          return [
            ...new Set(all.map((m) => m.collection?.name).filter((n): n is string => !!n)),
          ].sort();
        }),
    }),

    listFileContainers: defineRoute({
      handler: mediaServerStringLookup(
        fileContainerCache,
        'fileContainer',
        (i) => i.Media?.[0]?.container,
        (i) => i.MediaSources?.[0]?.Container
      ),
    }),

    listVideoCodecs: defineRoute({
      handler: mediaServerStringLookup(
        videoCodecCache,
        'videoCodec',
        (i) => i.Media?.[0]?.videoCodec,
        (i) => i.MediaSources?.[0]?.MediaStreams?.find((s) => s.Type === 'Video')?.Codec
      ),
    }),

    listAudioCodecs: defineRoute({
      handler: mediaServerStringLookup(
        audioCodecCache,
        'audioCodec',
        (i) => i.Media?.[0]?.audioCodec,
        (i) => i.MediaSources?.[0]?.MediaStreams?.find((s) => s.Type === 'Audio')?.Codec
      ),
    }),

    listFileResolutions: defineRoute({
      handler: mediaServerStringLookup(
        fileResolutionCache,
        'fileResolution',
        (i) => i.Media?.[0]?.videoResolution,
        (i) =>
          resolutionTier(i.MediaSources?.[0]?.MediaStreams?.find((s) => s.Type === 'Video')?.Height)
      ),
    }),

    listLabels: defineRoute({
      handler: mediaServerStringLookup(
        labelsCache,
        'labels',
        (i) => i.Label?.map((l) => l.tag),
        (i) => i.Tags
      ),
    }),

    listSources: defineRoute({
      handler: async () => {
        const providers = await providerSettingsService.list();
        return sourceOwnership(providers.filter((p) => p.isActive));
      },
    }),

    resetMedia: defineRoute({
      schemas: { response: z.object({ deletedIdentities: z.number() }) },
      handler: async () => {
        if (!cradle.db) {
          throw new Error('resetMedia requires a database handle');
        }
        const result = await resetMediaData(cradle.db);
        log.warn('Media data reset', { deletedIdentities: result.deletedIdentities });
        return result;
      },
    }),
  };
}
