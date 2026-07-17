import { MetadataProviderType } from '@server/database/schema';
import { MediaCache } from '@server/kernel/cache';
import type { DrizzleDb } from '@server/kernel/db';
import { defineRoute } from '@server/kernel/defineRoute';
import { getChildLogger } from '@server/kernel/logger';
import {
  type IProviderFactory,
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
  NormalizedMovie,
  NormalizedShow,
  RangeValue,
} from './filterRegistry';
import { paginateItems } from './media.pagination';
import { sortMedia } from './media.sort';
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

const MOVIE_PARAM_TO_KEY: Record<string, ParamMapping> = {
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
  overseerrRequestStatus: { key: 'overseerrRequestStatus' },
  overseerrHasIssue: { key: 'overseerrHasIssue' },
  tmdbStatus: { key: 'tmdbStatus' },
  lastWatchedDaysAgoGte: { key: 'lastWatchedDaysAgo', bound: 'min' },
  lastWatchedDaysAgoLte: { key: 'lastWatchedDaysAgo', bound: 'max' },
};

const SERIES_PARAM_TO_KEY: Record<string, ParamMapping> = {
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
};

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

  function invalidateMediaCaches(): void {
    moviesCache.invalidate('movies');
    seriesCache.invalidate('series');
    tagsCache.invalidate('tags');
    qualityProfilesCache.invalidate('qualityProfiles');
    genresCache.invalidate('genres');
    networksCache.invalidate('networks');
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
