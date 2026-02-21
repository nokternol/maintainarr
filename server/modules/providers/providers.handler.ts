import { MetadataProviderType } from '@server/database/entities/MetadataProvider';
import { getChildLogger } from '@server/logger';
import { JellyfinProvider } from '@server/providers/jellyfinProvider';
import { OverseerrProvider } from '@server/providers/overseerrProvider';
import { PlexProvider } from '@server/providers/plexProvider';
import { RadarrProvider } from '@server/providers/radarrProvider';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import { TautulliProvider } from '@server/providers/tautulliProvider';
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
  };
}
