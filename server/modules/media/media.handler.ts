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
import type { MediaQueryEngine } from './mediaQueryEngine';
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

const moviesQuerySchema = paginationQuerySchema.extend({
  ...sharedFilterFields,
  hasFile: bool3(),
  movieTagIds: z.string().optional(),
  movieQualityProfileIds: z.string().optional(),
  movieGenres: z.string().optional(),
  radarrImdbRatingGte: num(),
  radarrImdbRatingLte: num(),
});

const seriesQuerySchema = paginationQuerySchema.extend({
  ...sharedFilterFields,
  monitored: bool3(),
  seriesStatus: z.string().optional(),
  seriesTagIds: z.string().optional(),
  seriesQualityProfileIds: z.string().optional(),
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
}

const MOVIE_PARAM_TO_KEY: Record<string, ParamMapping> = {
  title: { key: 'title' },
  yearMin: { key: 'year', bound: 'min' },
  yearMax: { key: 'year', bound: 'max' },
  hasFile: { key: 'hasFile' },
  movieTagIds: { key: 'tagIds' },
  movieQualityProfileIds: { key: 'qualityProfileIds' },
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
  seriesTagIds: { key: 'tagIds' },
  seriesQualityProfileIds: { key: 'qualityProfileIds' },
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

  for (const [param, { key, bound }] of Object.entries(paramMap)) {
    const raw = query[param];
    if (raw === undefined) continue;
    if (bound) {
      const range = ranges.get(key) ?? {};
      range[bound] = Number(raw);
      ranges.set(key, range);
    } else {
      entries.push({ key, value: raw as FilterValue });
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
  const moviesCache = new MediaCache<{ movies: RadarrMovie[]; errors: MediaError[] }>();
  const seriesCache = new MediaCache<{ series: SonarrSeries[]; errors: MediaError[] }>();
  const tagsCache = new MediaCache<{ radarr: RadarrTag[]; sonarr: SonarrTag[] }>();
  const qualityProfilesCache = new MediaCache<{
    radarr: RadarrProfile[];
    sonarr: SonarrProfile[];
  }>();
  const genresCache = new MediaCache<{ movies: string[]; series: string[] }>();
  const networksCache = new MediaCache<string[]>();

  async function getMovies(): Promise<{ movies: RadarrMovie[]; errors: MediaError[] }> {
    return moviesCache.getOrFetch('movies', async () => {
      const errors: MediaError[] = [];
      const providers = await providerSettingsService.findActiveByTypes([
        MetadataProviderType.RADARR,
      ]);
      const movies: RadarrMovie[] = [];
      await Promise.all(
        providers.map(async (provider) => {
          try {
            const radarr = factory.create(provider, log) as RadarrProvider;
            movies.push(...(await radarr.getMovies()));
          } catch (err) {
            log.warn('Radarr fetch failed', { provider: provider.name, err });
            errors.push(toMediaError(provider.name, err));
          }
        })
      );
      return { movies, errors };
    });
  }

  async function getSeries(): Promise<{ series: SonarrSeries[]; errors: MediaError[] }> {
    return seriesCache.getOrFetch('series', async () => {
      const errors: MediaError[] = [];
      const providers = await providerSettingsService.findActiveByTypes([
        MetadataProviderType.SONARR,
      ]);
      const series: SonarrSeries[] = [];
      await Promise.all(
        providers.map(async (provider) => {
          try {
            const sonarr = factory.create(provider, log) as SonarrProvider;
            series.push(...(await sonarr.getSeries()));
          } catch (err) {
            log.warn('Sonarr fetch failed', { provider: provider.name, err });
            errors.push(toMediaError(provider.name, err));
          }
        })
      );
      return { series, errors };
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
        const { movies: all, errors } = await getMovies();

        const yearRange = computeYearRange(all);
        const source: MediaSource = {
          getMediaItems: async () => all.map(normalizeRadarrMovie),
          idOf: (item) => (item as NormalizedMovie)._sourceIds.radarr,
          enrichmentSourceType: 'RADARR',
        };
        const matched = await mediaQueryEngine.evaluate({
          source,
          contentType: 'movie',
          sources: [{ filterValues: toFilterValues(query, MOVIE_PARAM_TO_KEY), role: 'include' }],
        });
        const matchedIds = new Set(matched.map((m) => source.idOf(m)));
        const filtered = all.filter((m) => matchedIds.has(m.id));
        const sorted = sortMedia(filtered, query.sort, (m) => m.hasFile);
        return {
          ...paginateItems(sorted, { page: query.page, pageSize: query.pageSize }),
          yearRange,
          errors,
        };
      },
    }),

    listSeries: defineRoute({
      schemas: { query: seriesQuerySchema },
      handler: async ({ query }) => {
        const { series: all, errors } = await getSeries();

        const yearRange = computeYearRange(all);
        const source: MediaSource = {
          getMediaItems: async () => all.map(normalizeSonarrSeries),
          idOf: (item) => (item as NormalizedShow)._sourceIds.sonarr,
          enrichmentSourceType: 'SONARR',
        };
        const matched = await mediaQueryEngine.evaluate({
          source,
          contentType: 'show',
          sources: [{ filterValues: toFilterValues(query, SERIES_PARAM_TO_KEY), role: 'include' }],
        });
        const matchedIds = new Set(matched.map((s) => source.idOf(s)));
        const filtered = all.filter((s) => matchedIds.has(s.id));
        const sorted = sortMedia(filtered, query.sort, (s) => s.monitored);
        return {
          ...paginateItems(sorted, { page: query.page, pageSize: query.pageSize }),
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

          const radarrTags: RadarrTag[] = [];
          const sonarrTags: SonarrTag[] = [];

          await Promise.all(
            providers.map(async (provider) => {
              try {
                if (provider.type === MetadataProviderType.RADARR) {
                  const radarr = factory.create(provider, log) as RadarrProvider;
                  radarrTags.push(...(await radarr.getTags()));
                } else if (provider.type === MetadataProviderType.SONARR) {
                  const sonarr = factory.create(provider, log) as SonarrProvider;
                  sonarrTags.push(...(await sonarr.getTags()));
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

          const radarrProfiles: RadarrProfile[] = [];
          const sonarrProfiles: SonarrProfile[] = [];

          await Promise.all(
            providers.map(async (provider) => {
              try {
                if (provider.type === MetadataProviderType.RADARR) {
                  const radarr = factory.create(provider, log) as RadarrProvider;
                  radarrProfiles.push(...(await radarr.getProfiles()));
                } else if (provider.type === MetadataProviderType.SONARR) {
                  const sonarr = factory.create(provider, log) as SonarrProvider;
                  sonarrProfiles.push(...(await sonarr.getProfiles()));
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
          const [{ movies }, { series }] = await Promise.all([getMovies(), getSeries()]);
          return {
            movies: [...new Set(movies.flatMap((m) => m.genres ?? []))].sort(),
            series: [...new Set(series.flatMap((s) => s.genres ?? []))].sort(),
          };
        }),
    }),

    listNetworks: defineRoute({
      handler: () =>
        networksCache.getOrFetch('networks', async () => {
          const { series: all } = await getSeries();
          return [...new Set(all.map((s) => s.network).filter((n): n is string => !!n))].sort();
        }),
    }),

    listSources: defineRoute({
      handler: async () => sourceOwnership(await providerSettingsService.activeTypes()),
    }),
  };
}
