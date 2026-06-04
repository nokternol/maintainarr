import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { MediaCache } from '@server/modules/media/media.cache';
import { paginateItems } from '@server/modules/media/media.pagination';
import { type IProviderFactory, ProviderFactory } from '@server/providers/providerFactory';
import type { RadarrProvider } from '@server/providers/radarrProvider';
import type { RadarrMovie, RadarrProfile, RadarrTag } from '@server/providers/radarrProvider';
import type { SonarrProvider } from '@server/providers/sonarrProvider';
import type { SonarrProfile, SonarrSeries, SonarrTag } from '@server/providers/sonarrProvider';
import { TautulliProvider } from '@server/providers/tautulliProvider';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import { defineRoute } from '@server/utils/defineRoute';
import { applyMovieFilters, applySeriesFilters } from '@server/utils/mediaFilters';
import { z } from 'zod';

const log = getChildLogger('MediaHandler');

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().optional().default(48),
});

const moviesQuerySchema = paginationQuerySchema.extend({
  title: z.string().optional(),
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  hasFile: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  movieTagIds: z.string().optional(),
  movieQualityProfileIds: z.string().optional(),
  movieGenres: z.string().optional(),
  sort: z
    .enum(['title_asc', 'title_desc', 'year_asc', 'year_desc', 'status_asc', 'status_desc'])
    .optional()
    .default('title_asc'),
  tautulliWatched: z.enum(['true', 'false']).optional(),
});

const seriesQuerySchema = paginationQuerySchema.extend({
  title: z.string().optional(),
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  monitored: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  seriesStatus: z.string().optional(),
  seriesTagIds: z.string().optional(),
  seriesQualityProfileIds: z.string().optional(),
  seriesGenres: z.string().optional(),
  seriesType: z.string().optional(),
  network: z.string().optional(),
  sort: z
    .enum(['title_asc', 'title_desc', 'year_asc', 'year_desc', 'status_asc', 'status_desc'])
    .optional()
    .default('title_asc'),
  tautulliWatched: z.enum(['true', 'false']).optional(),
});

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
  const { providerSettingsService } = cradle;
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
  // 5-minute TTL: watched-title sets change infrequently and fetching is expensive (1 000-row query)
  const watchedTitlesCache = new MediaCache<Set<string>>(300_000);

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

  async function fetchWatchedTitles(): Promise<Set<string>> {
    return watchedTitlesCache.getOrFetch('watchedTitles', async () => {
      const tautulliProviders = await providerSettingsService.findActiveByTypes([
        MetadataProviderType.TAUTULLI,
      ]);
      const allTitles = new Set<string>();
      await Promise.all(
        tautulliProviders.map(async (provider) => {
          try {
            const tautulli = new TautulliProvider(provider, log);
            const titles = await tautulli.getWatchedTitles();
            for (const t of titles) allTitles.add(t);
          } catch (err) {
            log.warn('Tautulli watched titles fetch failed', { provider: provider.name, err });
          }
        })
      );
      return allTitles;
    });
  }

  return {
    listMovies: defineRoute({
      schemas: { query: moviesQuerySchema },
      handler: async ({ query }) => {
        const { movies: all, errors } = await getMovies();

        const yearRange = computeYearRange(all);
        let filtered = applyMovieFilters(all, query);

        if (query.tautulliWatched !== undefined) {
          const watchedTitles = await fetchWatchedTitles();
          const want = query.tautulliWatched === 'true';
          filtered = filtered.filter((m) => watchedTitles.has(m.title.toLowerCase()) === want);
        }

        const sorted = (() => {
          const dir = query.sort.endsWith('_desc') ? -1 : 1;
          const field = query.sort.replace(/_(?:asc|desc)$/, '');
          return filtered.slice().sort((a, b) => {
            if (field === 'year') return dir * ((a.year ?? 0) - (b.year ?? 0));
            if (field === 'status') return dir * (Number(a.hasFile) - Number(b.hasFile));
            return dir * a.title.localeCompare(b.title);
          });
        })();
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
        let filtered = applySeriesFilters(all, query);

        if (query.tautulliWatched !== undefined) {
          const watchedTitles = await fetchWatchedTitles();
          const want = query.tautulliWatched === 'true';
          filtered = filtered.filter((s) => watchedTitles.has(s.title.toLowerCase()) === want);
        }

        const sorted = (() => {
          const dir = query.sort.endsWith('_desc') ? -1 : 1;
          const field = query.sort.replace(/_(?:asc|desc)$/, '');
          return filtered.slice().sort((a, b) => {
            if (field === 'year') return dir * ((a.year ?? 0) - (b.year ?? 0));
            if (field === 'status') return dir * (Number(a.monitored) - Number(b.monitored));
            return dir * a.title.localeCompare(b.title);
          });
        })();
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
  };
}
