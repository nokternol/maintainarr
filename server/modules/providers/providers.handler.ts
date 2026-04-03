import { getConfig } from '@server/config';
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
import { RatingsAggregationService } from '@server/services/ratingsAggregationService';
import { defineRoute } from '@server/utils/defineRoute';
import { resolveApiKey } from '@server/utils/keyResolver';
import { providersSchemas } from './providers.schemas';

const log = getChildLogger('ProvidersHandler');

/**
 * Builds a minimal MetadataProvider-shaped entity from query params.
 * This lets us reuse the existing provider classes without touching the DB.
 */
function makeEntity(
  type: MetadataProviderType,
  url: string,
  apiKey: string,
  settings: Record<string, unknown>
) {
  return {
    id: 0,
    type,
    name: `adhoc-${type}`,
    url,
    apiKey,
    settings,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

interface ProvidersCradle {
  providerSettingsService: ProviderSettingsService;
}

export function createProvidersHandlers(cradle: ProvidersCradle) {
  const { providerSettingsService } = cradle;
  const ratingsService = new RatingsAggregationService();

  return {
    getMetadata: defineRoute({
      schemas: providersSchemas.getMetadata,
      handler: async ({ query }) => {
        const { type, url, apiKey, settings } = query;
        const entity = makeEntity(type, url, apiKey, settings);

        log.debug('Fetching provider metadata', { type, url });

        switch (type) {
          case MetadataProviderType.SONARR: {
            const provider = new SonarrProvider(entity, log);
            const [series, qualityProfiles, rootFolders, tags] = await Promise.all([
              provider.getSeries(),
              provider.getProfiles(),
              provider.getRootFolders(),
              provider.getTags(),
            ]);
            return { type, data: { series, qualityProfiles, rootFolders, tags } };
          }

          case MetadataProviderType.RADARR: {
            const provider = new RadarrProvider(entity, log);
            const [movies, qualityProfiles, rootFolders, tags] = await Promise.all([
              provider.getMovies(),
              provider.getProfiles(),
              provider.getRootFolders(),
              provider.getTags(),
            ]);
            return { type, data: { movies, qualityProfiles, rootFolders, tags } };
          }

          case MetadataProviderType.PLEX: {
            const provider = new PlexProvider(entity, log);
            const libraries = await provider.getLibraries();
            return { type, data: { libraries } };
          }

          case MetadataProviderType.JELLYFIN: {
            const provider = new JellyfinProvider(entity, log);
            const libraries = await provider.getLibraries();
            return { type, data: { libraries } };
          }

          case MetadataProviderType.TAUTULLI: {
            const provider = new TautulliProvider(entity, log);
            const [libraryStats, homeStats, recentHistory] = await Promise.all([
              provider.getLibraryStats(),
              provider.getHomeStats(),
              provider.getHistory(),
            ]);
            return { type, data: { libraryStats, homeStats, recentHistory } };
          }

          case MetadataProviderType.OVERSEERR:
          case MetadataProviderType.SEERR: {
            const provider = new OverseerrProvider(entity, log);
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

        // Fetch saved keys from DB (one query each, null when none saved)
        const [tmdbProviders, omdbProviders] = await Promise.all([
          providerSettingsService.findActiveByTypes([MetadataProviderType.TMDB]),
          providerSettingsService.findActiveByTypes([MetadataProviderType.OMDB]),
        ]);
        const dbTmdbKey = tmdbProviders[0]?.apiKey ?? null;
        const dbOmdbKey = omdbProviders[0]?.apiKey ?? null;

        // Resolve keys: explicit param → DB saved key → env/config → skip
        const { key: resolvedTmdbKey } = resolveApiKey(
          tmdbApiKey,
          dbTmdbKey,
          getConfig().TMDB_API_KEY || undefined
        );
        const { key: resolvedOmdbKey } = resolveApiKey(omdbApiKey, dbOmdbKey, undefined);

        log.debug('Fetching aggregated ratings', { title, year, hasTmdb: !!resolvedTmdbKey });

        // Fetch from all providers in parallel (gracefully handle failures)
        const [tmdbRating, omdbRating, tvmazeRating] = await Promise.all([
          // TMDB — uses form key, or falls back to server-configured key
          resolvedTmdbKey
            ? (async () => {
                try {
                  const provider = new TmdbProvider(
                    makeEntity(
                      MetadataProviderType.TMDB,
                      'https://api.themoviedb.org/3',
                      resolvedTmdbKey,
                      {}
                    ),
                    log
                  );
                  return await provider.getRatings(title, year);
                } catch (error) {
                  log.warn('TMDB fetch failed', { error });
                  return { source: 'tmdb' as const, found: false };
                }
              })()
            : Promise.resolve(undefined),

          // OMDB
          resolvedOmdbKey
            ? (async () => {
                try {
                  const provider = new OmdbProvider(
                    makeEntity(
                      MetadataProviderType.OMDB,
                      'https://www.omdbapi.com',
                      resolvedOmdbKey,
                      {}
                    ),
                    log
                  );
                  return await provider.getRatings(title, year);
                } catch (error) {
                  log.warn('OMDB fetch failed', { error });
                  return { source: 'omdb' as const, found: false };
                }
              })()
            : Promise.resolve(undefined),

          // TVMaze (no API key needed!)
          (async () => {
            try {
              const provider = new TvMazeProvider(
                makeEntity(MetadataProviderType.TVMAZE, 'https://api.tvmaze.com', '', {}),
                log
              );
              return await provider.getRatings(title, year);
            } catch (error) {
              log.warn('TVMaze fetch failed', { error });
              return { source: 'tvmaze' as const, found: false };
            }
          })(),
        ]);

        const aggregated = ratingsService.aggregate(
          title,
          year,
          tmdbRating,
          omdbRating,
          tvmazeRating
        );

        return aggregated;
      },
    }),
  };
}
