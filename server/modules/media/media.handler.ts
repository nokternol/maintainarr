import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { MediaCache } from '@server/modules/media/media.cache';
import { paginateItems } from '@server/modules/media/media.pagination';
import { RadarrProvider } from '@server/providers/radarrProvider';
import type { RadarrMovie, RadarrProfile, RadarrTag } from '@server/providers/radarrProvider';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import type { SonarrProfile, SonarrSeries, SonarrTag } from '@server/providers/sonarrProvider';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import { defineRoute } from '@server/utils/defineRoute';
import { z } from 'zod';

const log = getChildLogger('MediaHandler');

const moviesCache = new MediaCache<RadarrMovie[]>();
const seriesCache = new MediaCache<SonarrSeries[]>();
const tagsCache = new MediaCache<{ radarr: RadarrTag[]; sonarr: SonarrTag[] }>();
const qualityProfilesCache = new MediaCache<{ radarr: RadarrProfile[]; sonarr: SonarrProfile[] }>();
const genresCache = new MediaCache<{ movies: string[]; series: string[] }>();
const networksCache = new MediaCache<string[]>();

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
  sort: z.enum(['title_asc', 'title_desc']).optional().default('title_asc'),
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
  sort: z.enum(['title_asc', 'title_desc']).optional().default('title_asc'),
});

// ─── Filter helpers ────────────────────────────────────────────────────────────

function parseIds(csv: string | undefined): number[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function parseCsvStrings(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}

function computeYearRange(items: Array<{ year?: number }>): { min: number | null; max: number | null } {
  const years = items.map((m) => m.year).filter((y): y is number => y !== undefined && y !== null && y >= 1888);
  if (years.length === 0) return { min: null, max: null };
  return { min: Math.min(...years), max: Math.max(...years) };
}

export function applyMovieFilters(
  all: RadarrMovie[],
  query: z.infer<typeof moviesQuerySchema>
): RadarrMovie[] {
  let filtered = all;

  if (query.title !== undefined) {
    const lower = query.title.toLowerCase();
    filtered = filtered.filter((m) => m.title.toLowerCase().includes(lower));
  }
  if (query.yearMin !== undefined) {
    filtered = filtered.filter((m) => m.year !== undefined && m.year >= query.yearMin!);
  }
  if (query.yearMax !== undefined) {
    filtered = filtered.filter((m) => m.year !== undefined && m.year <= query.yearMax!);
  }
  if (query.hasFile !== undefined) {
    filtered = filtered.filter((m) => m.hasFile === query.hasFile);
  }

  const tagIds = parseIds(query.movieTagIds);
  if (tagIds.length > 0) {
    filtered = filtered.filter((m) => tagIds.every((id) => m.tags.includes(id)));
  }

  const profileIds = parseIds(query.movieQualityProfileIds);
  if (profileIds.length > 0) {
    filtered = filtered.filter((m) => profileIds.includes(m.qualityProfileId));
  }

  const genres = parseCsvStrings(query.movieGenres);
  if (genres.length > 0) {
    filtered = filtered.filter((m) => m.genres?.some((g) => genres.includes(g)));
  }

  return filtered;
}

export function applySeriesFilters(
  all: SonarrSeries[],
  query: z.infer<typeof seriesQuerySchema>
): SonarrSeries[] {
  let filtered = all;

  if (query.title !== undefined) {
    const lower = query.title.toLowerCase();
    filtered = filtered.filter((s) => s.title.toLowerCase().includes(lower));
  }
  if (query.yearMin !== undefined) {
    filtered = filtered.filter((s) => s.year !== undefined && s.year >= query.yearMin!);
  }
  if (query.yearMax !== undefined) {
    filtered = filtered.filter((s) => s.year !== undefined && s.year <= query.yearMax!);
  }
  if (query.monitored !== undefined) {
    filtered = filtered.filter((s) => s.monitored === query.monitored);
  }
  if (query.seriesStatus !== undefined) {
    filtered = filtered.filter((s) => s.status === query.seriesStatus);
  }

  const tagIds = parseIds(query.seriesTagIds);
  if (tagIds.length > 0) {
    filtered = filtered.filter((s) => tagIds.every((id) => s.tags.includes(id)));
  }

  const profileIds = parseIds(query.seriesQualityProfileIds);
  if (profileIds.length > 0) {
    filtered = filtered.filter((s) => profileIds.includes(s.qualityProfileId));
  }

  const genres = parseCsvStrings(query.seriesGenres);
  if (genres.length > 0) {
    filtered = filtered.filter((s) => s.genres?.some((g) => genres.includes(g)));
  }

  if (query.seriesType !== undefined) {
    filtered = filtered.filter((s) => s.seriesType === query.seriesType);
  }

  const networks = parseCsvStrings(query.network);
  if (networks.length > 0) {
    filtered = filtered.filter((s) => s.network !== undefined && networks.includes(s.network));
  }

  return filtered;
}

// ─── Handler cradle ────────────────────────────────────────────────────────────

interface MediaCradle {
  providerSettingsService: ProviderSettingsService;
}

export interface MediaError {
  provider: string;
  error: string;
}

export interface MediaResult {
  movies: RadarrMovie[];
  series: SonarrSeries[];
  errors: MediaError[];
}

export function createMediaHandlers(cradle: MediaCradle) {
  const { providerSettingsService } = cradle;

  async function fetchAllMovies(): Promise<RadarrMovie[]> {
    const providers = await providerSettingsService.findActiveByTypes([
      MetadataProviderType.RADARR,
    ]);
    const all: RadarrMovie[] = [];
    await Promise.all(
      providers.map(async (provider) => {
        try {
          const radarr = new RadarrProvider(provider, log);
          const results = await radarr.getMovies();
          all.push(...results);
        } catch (err) {
          log.warn('Radarr fetch failed', { provider: provider.name, err });
        }
      })
    );
    moviesCache.set('movies', all);
    return all;
  }

  async function fetchAllSeries(): Promise<SonarrSeries[]> {
    const providers = await providerSettingsService.findActiveByTypes([
      MetadataProviderType.SONARR,
    ]);
    const all: SonarrSeries[] = [];
    await Promise.all(
      providers.map(async (provider) => {
        try {
          const sonarr = new SonarrProvider(provider, log);
          const results = await sonarr.getSeries();
          all.push(...results);
        } catch (err) {
          log.warn('Sonarr fetch failed', { provider: provider.name, err });
        }
      })
    );
    seriesCache.set('series', all);
    return all;
  }

  return {
    listMedia: defineRoute({
      handler: async () => {
        const providers = await providerSettingsService.findActiveByTypes([
          MetadataProviderType.RADARR,
          MetadataProviderType.SONARR,
        ]);

        const movies: RadarrMovie[] = [];
        const series: SonarrSeries[] = [];
        const errors: MediaError[] = [];

        await Promise.all(
          providers.map(async (provider) => {
            try {
              if (provider.type === MetadataProviderType.RADARR) {
                const radarr = new RadarrProvider(provider, log);
                const results = await radarr.getMovies();
                movies.push(...results);
              } else if (provider.type === MetadataProviderType.SONARR) {
                const sonarr = new SonarrProvider(provider, log);
                const results = await sonarr.getSeries();
                series.push(...results);
              }
            } catch (err) {
              log.warn('Provider fetch failed', { provider: provider.name, err });
              errors.push({
                provider: provider.name,
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            }
          })
        );

        return { movies, series, errors } satisfies MediaResult;
      },
    }),

    listMovies: defineRoute({
      schemas: { query: moviesQuerySchema },
      handler: async ({ query }) => {
        const all = moviesCache.get('movies') ?? await fetchAllMovies();

        const yearRange = computeYearRange(all);
        const filtered = applyMovieFilters(all, query);
        const sorted = filtered.slice().sort((a, b) =>
          query.sort === 'title_desc'
            ? b.title.localeCompare(a.title)
            : a.title.localeCompare(b.title)
        );
        return { ...paginateItems(sorted, { page: query.page, pageSize: query.pageSize }), yearRange };
      },
    }),

    listSeries: defineRoute({
      schemas: { query: seriesQuerySchema },
      handler: async ({ query }) => {
        const all = seriesCache.get('series') ?? await fetchAllSeries();

        const yearRange = computeYearRange(all);
        const filtered = applySeriesFilters(all, query);
        const sorted = filtered.slice().sort((a, b) =>
          query.sort === 'title_desc'
            ? b.title.localeCompare(a.title)
            : a.title.localeCompare(b.title)
        );
        return { ...paginateItems(sorted, { page: query.page, pageSize: query.pageSize }), yearRange };
      },
    }),

    listTags: defineRoute({
      handler: async () => {
        const cached = tagsCache.get('tags');
        if (cached) return cached;

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
                const radarr = new RadarrProvider(provider, log);
                radarrTags.push(...(await radarr.getTags()));
              } else if (provider.type === MetadataProviderType.SONARR) {
                const sonarr = new SonarrProvider(provider, log);
                sonarrTags.push(...(await sonarr.getTags()));
              }
            } catch (err) {
              log.warn('Tags fetch failed', { provider: provider.name, err });
            }
          })
        );

        const result = { radarr: radarrTags, sonarr: sonarrTags };
        tagsCache.set('tags', result);
        return result;
      },
    }),

    listQualityProfiles: defineRoute({
      handler: async () => {
        const cached = qualityProfilesCache.get('qualityProfiles');
        if (cached) return cached;

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
                const radarr = new RadarrProvider(provider, log);
                radarrProfiles.push(...(await radarr.getProfiles()));
              } else if (provider.type === MetadataProviderType.SONARR) {
                const sonarr = new SonarrProvider(provider, log);
                sonarrProfiles.push(...(await sonarr.getProfiles()));
              }
            } catch (err) {
              log.warn('Quality profiles fetch failed', { provider: provider.name, err });
            }
          })
        );

        const result = { radarr: radarrProfiles, sonarr: sonarrProfiles };
        qualityProfilesCache.set('qualityProfiles', result);
        return result;
      },
    }),

    listGenres: defineRoute({
      handler: async () => {
        const cached = genresCache.get('genres');
        if (cached) return cached;

        const [movies, series] = await Promise.all([
          moviesCache.get('movies') ?? fetchAllMovies(),
          seriesCache.get('series') ?? fetchAllSeries(),
        ]);

        const movieGenres = [...new Set(movies.flatMap((m) => m.genres ?? []))].sort();
        const seriesGenres = [...new Set(series.flatMap((s) => s.genres ?? []))].sort();

        const result = { movies: movieGenres, series: seriesGenres };
        genresCache.set('genres', result);
        return result;
      },
    }),

    listNetworks: defineRoute({
      handler: async () => {
        const cached = networksCache.get('networks');
        if (cached) return cached;

        const all = seriesCache.get('series') ?? await fetchAllSeries();
        const networks = [...new Set(all.map((s) => s.network).filter((n): n is string => !!n))].sort();

        networksCache.set('networks', networks);
        return networks;
      },
    }),
  };
}
