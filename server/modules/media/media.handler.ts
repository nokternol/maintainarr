import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { MediaCache } from '@server/modules/media/media.cache';
import { paginateItems } from '@server/modules/media/media.pagination';
import { RadarrProvider } from '@server/providers/radarrProvider';
import type { RadarrMovie } from '@server/providers/radarrProvider';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import type { SonarrSeries } from '@server/providers/sonarrProvider';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import { defineRoute } from '@server/utils/defineRoute';
import { z } from 'zod';

const log = getChildLogger('MediaHandler');

const moviesCache = new MediaCache<RadarrMovie[]>();
const seriesCache = new MediaCache<SonarrSeries[]>();

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().optional().default(48),
});

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
      schemas: { query: paginationQuerySchema },
      handler: async ({ query }) => {
        let all = moviesCache.get('movies');

        if (!all) {
          const providers = await providerSettingsService.findActiveByTypes([
            MetadataProviderType.RADARR,
          ]);
          all = [];
          await Promise.all(
            providers.map(async (provider) => {
              try {
                const radarr = new RadarrProvider(provider, log);
                const results = await radarr.getMovies();
                (all as RadarrMovie[]).push(...results);
              } catch (err) {
                log.warn('Radarr fetch failed', { provider: provider.name, err });
              }
            })
          );
          moviesCache.set('movies', all);
        }

        return paginateItems(all, { page: query.page, pageSize: query.pageSize });
      },
    }),

    listSeries: defineRoute({
      schemas: { query: paginationQuerySchema },
      handler: async ({ query }) => {
        let all = seriesCache.get('series');

        if (!all) {
          const providers = await providerSettingsService.findActiveByTypes([
            MetadataProviderType.SONARR,
          ]);
          all = [];
          await Promise.all(
            providers.map(async (provider) => {
              try {
                const sonarr = new SonarrProvider(provider, log);
                const results = await sonarr.getSeries();
                (all as SonarrSeries[]).push(...results);
              } catch (err) {
                log.warn('Sonarr fetch failed', { provider: provider.name, err });
              }
            })
          );
          seriesCache.set('series', all);
        }

        return paginateItems(all, { page: query.page, pageSize: query.pageSize });
      },
    }),
  };
}
