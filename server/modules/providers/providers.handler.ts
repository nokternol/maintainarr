import { MetadataProviderType } from '@server/database/entities/MetadataProvider';
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
import { RatingsAggregationService } from '@server/services/ratingsAggregationService';
import { defineRoute } from '@server/utils/defineRoute';
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

export function createProvidersHandlers(_cradle: object) {
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

        log.debug('Fetching aggregated ratings', { title, year });

        // Fetch from all providers in parallel (gracefully handle failures)
        const [tmdbRating, omdbRating, tvmazeRating] = await Promise.all([
          // TMDB
          tmdbApiKey
            ? (async () => {
                try {
                  const provider = new TmdbProvider(
                    makeEntity(
                      MetadataProviderType.TMDB,
                      'https://api.themoviedb.org/3',
                      tmdbApiKey,
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
          omdbApiKey
            ? (async () => {
                try {
                  const provider = new OmdbProvider(
                    makeEntity(
                      MetadataProviderType.OMDB,
                      'https://www.omdbapi.com',
                      omdbApiKey,
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
