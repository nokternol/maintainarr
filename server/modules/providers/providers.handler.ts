import type { AppConfig } from '@server/config';
import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { JellyfinProvider } from '@server/providers/jellyfinProvider';
import { OmdbProvider } from '@server/providers/omdbProvider';
import { OverseerrProvider } from '@server/providers/overseerrProvider';
import { PlexProvider } from '@server/providers/plexProvider';
import { RadarrProvider } from '@server/providers/radarrProvider';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import { TautulliProvider } from '@server/providers/tautulliProvider';
import { TmdbProvider } from '@server/providers/tmdbProvider';
import { TvMazeProvider } from '@server/providers/tvmazeProvider';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import { defineRoute } from '@server/utils/defineRoute';
import { resolveApiKey } from '@server/utils/keyResolver';
import { aggregateRatings } from '@server/utils/ratingsAggregation';
import { providersSchemas } from './providers.schemas';

const log = getChildLogger('ProvidersHandler');

interface ProvidersCradle {
  providerSettingsService: ProviderSettingsService;
  config: AppConfig;
}

export function createProvidersHandlers(cradle: ProvidersCradle) {
  const { providerSettingsService, config } = cradle;

  return {
    getMetadata: defineRoute({
      schemas: providersSchemas.getMetadata,
      handler: async ({ query }) => {
        const { type, url, apiKey, settings } = query;
        const config = { name: `adhoc-${type}`, url, apiKey, settings };

        log.debug('Fetching provider metadata', { type, url });

        switch (type) {
          case MetadataProviderType.SONARR: {
            const provider = new SonarrProvider(config, log);
            const [series, qualityProfiles, rootFolders, tags] = await Promise.all([
              provider.getSeries(),
              provider.getProfiles(),
              provider.getRootFolders(),
              provider.getTags(),
            ]);
            return { type, data: { series, qualityProfiles, rootFolders, tags } };
          }

          case MetadataProviderType.RADARR: {
            const provider = new RadarrProvider(config, log);
            const [movies, qualityProfiles, rootFolders, tags] = await Promise.all([
              provider.getMovies(),
              provider.getProfiles(),
              provider.getRootFolders(),
              provider.getTags(),
            ]);
            return { type, data: { movies, qualityProfiles, rootFolders, tags } };
          }

          case MetadataProviderType.PLEX: {
            const provider = new PlexProvider(config, log);
            const libraries = await provider.getLibraries();
            return { type, data: { libraries } };
          }

          case MetadataProviderType.JELLYFIN: {
            const provider = new JellyfinProvider(config, log);
            const libraries = await provider.getLibraries();
            return { type, data: { libraries } };
          }

          case MetadataProviderType.TAUTULLI: {
            const provider = new TautulliProvider(config, log);
            const [libraryStats, homeStats, recentHistory] = await Promise.all([
              provider.getLibraryStats(),
              provider.getHomeStats(),
              provider.getHistory(),
            ]);
            return { type, data: { libraryStats, homeStats, recentHistory } };
          }

          case MetadataProviderType.OVERSEERR:
          case MetadataProviderType.SEERR: {
            const provider = new OverseerrProvider(config, log);
            const requests = await provider.getRequests();
            return { type, data: { requests } };
          }
        }
      },
    }),

    getRatings: defineRoute({
      schemas: providersSchemas.getRatings,
      handler: async ({ query }) => {
        const { title, year, tmdbApiKey, omdbApiKey } = query;

        const dbProviders = await providerSettingsService.findActiveByTypes([
          MetadataProviderType.TMDB,
          MetadataProviderType.OMDB,
        ]);
        const dbTmdbKey =
          dbProviders.find((p) => p.type === MetadataProviderType.TMDB)?.apiKey ?? null;
        const dbOmdbKey =
          dbProviders.find((p) => p.type === MetadataProviderType.OMDB)?.apiKey ?? null;

        const { key: resolvedTmdbKey } = resolveApiKey(
          tmdbApiKey,
          dbTmdbKey,
          config.TMDB_API_KEY || undefined
        );
        const { key: resolvedOmdbKey } = resolveApiKey(omdbApiKey, dbOmdbKey, undefined);

        log.debug('Fetching aggregated ratings', { title, year, hasTmdb: !!resolvedTmdbKey });

        const [tmdbRating, omdbRating, tvmazeRating] = await Promise.all([
          resolvedTmdbKey
            ? (async () => {
                try {
                  const provider = new TmdbProvider(
                    {
                      name: 'tmdb',
                      url: 'https://api.themoviedb.org/3',
                      apiKey: resolvedTmdbKey,
                      settings: null,
                    },
                    log
                  );
                  return await provider.getRatings(title, year);
                } catch (error) {
                  log.warn('TMDB fetch failed', { error });
                  return { source: 'tmdb' as const, found: false };
                }
              })()
            : Promise.resolve(undefined),

          resolvedOmdbKey
            ? (async () => {
                try {
                  const provider = new OmdbProvider(
                    {
                      name: 'omdb',
                      url: 'https://www.omdbapi.com',
                      apiKey: resolvedOmdbKey,
                      settings: null,
                    },
                    log
                  );
                  return await provider.getRatings(title, year);
                } catch (error) {
                  log.warn('OMDB fetch failed', { error });
                  return { source: 'omdb' as const, found: false };
                }
              })()
            : Promise.resolve(undefined),

          (async () => {
            try {
              const provider = new TvMazeProvider(
                { name: 'tvmaze', url: 'https://api.tvmaze.com', apiKey: null, settings: null },
                log
              );
              return await provider.getRatings(title, year);
            } catch (error) {
              log.warn('TVMaze fetch failed', { error });
              return { source: 'tvmaze' as const, found: false };
            }
          })(),
        ]);

        const aggregated = aggregateRatings(title, year, tmdbRating, omdbRating, tvmazeRating);

        return aggregated;
      },
    }),
  };
}
