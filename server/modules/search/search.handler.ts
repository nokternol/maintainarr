import { isAuthenticated } from '@server/middleware/auth';
import { defineRoute } from '@server/utils/defineRoute';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import { MetadataProviderType } from '@server/database/schema';
import type { MetadataProvider } from '@server/database/schema';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import { RadarrProvider } from '@server/providers/radarrProvider';
import { PlexProvider } from '@server/providers/plexProvider';
import { JellyfinProvider } from '@server/providers/jellyfinProvider';
import { TautulliProvider } from '@server/providers/tautulliProvider';
import { OverseerrProvider } from '@server/providers/overseerrProvider';
import { getChildLogger } from '@server/logger';
import { searchMetadataQuery } from './search.schemas';

const log = getChildLogger('SearchHandler');

interface SearchCradle {
  providerSettingsService: ProviderSettingsService;
}

export interface SearchResult {
  providerId: number;
  name: string;
  type: string;
  status: 'ok' | 'error' | 'unavailable';
  data?: unknown;
  error?: string;
}

const SEARCHABLE_TYPES = [
  MetadataProviderType.SONARR,
  MetadataProviderType.RADARR,
  MetadataProviderType.PLEX,
  MetadataProviderType.JELLYFIN,
  MetadataProviderType.TAUTULLI,
  MetadataProviderType.OVERSEERR,
];

async function searchProvider(provider: MetadataProvider, title: string): Promise<SearchResult> {
  const base: Pick<SearchResult, 'providerId' | 'name' | 'type'> = {
    providerId: provider.id,
    name: provider.name,
    type: provider.type,
  };

  try {
    switch (provider.type) {
      case MetadataProviderType.SONARR: {
        const p = new SonarrProvider(provider, log);
        const data = await p.lookupSeries(title);
        return { ...base, status: 'ok', data };
      }
      case MetadataProviderType.RADARR: {
        const p = new RadarrProvider(provider, log);
        const data = await p.lookupMovies(title);
        return { ...base, status: 'ok', data };
      }
      case MetadataProviderType.PLEX: {
        const p = new PlexProvider(provider, log);
        const libraries = await p.getLibraries();
        const allItems = await Promise.all(libraries.map((lib) => p.getLibraryContents(lib.key)));
        const lowerTitle = title.toLowerCase();
        const data = allItems.flat().filter((item) => item.title.toLowerCase().includes(lowerTitle));
        return { ...base, status: 'ok', data };
      }
      case MetadataProviderType.JELLYFIN: {
        const p = new JellyfinProvider(provider, log);
        const libraries = await p.getLibraries();
        const allItems = await Promise.all(libraries.map((lib) => p.getLibraryContents(lib.ItemId)));
        const lowerTitle = title.toLowerCase();
        const data = allItems.flat().filter((item) => item.Name.toLowerCase().includes(lowerTitle));
        return { ...base, status: 'ok', data };
      }
      case MetadataProviderType.TAUTULLI: {
        const p = new TautulliProvider(provider, log);
        const history = await p.getHistory();
        const lowerTitle = title.toLowerCase();
        const data = history.filter((item) => item.title.toLowerCase().includes(lowerTitle));
        return { ...base, status: 'ok', data };
      }
      case MetadataProviderType.OVERSEERR: {
        const p = new OverseerrProvider(provider, log);
        const requests = await p.getRequests();
        const lowerTitle = title.toLowerCase();
        const data = requests.filter((req) => req.media?.title?.toLowerCase().includes(lowerTitle));
        return { ...base, status: 'ok', data };
      }
      default:
        return { ...base, status: 'unavailable' };
    }
  } catch (err) {
    log.warn(`Search failed for provider ${provider.name}`, { err });
    return { ...base, status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export function createSearchHandlers(cradle: SearchCradle) {
  const { providerSettingsService } = cradle;

  return {
    searchMetadata: [
      isAuthenticated(),
      defineRoute({
        schemas: { query: searchMetadataQuery },
        handler: async ({ query }) => {
          const providers = await providerSettingsService.findActiveByTypes(SEARCHABLE_TYPES);
          const results = await Promise.allSettled(
            providers.map((p) => searchProvider(p, query.title))
          );
          return results.map((r) =>
            r.status === 'fulfilled'
              ? r.value
              : { providerId: -1, name: 'unknown', type: 'unknown', status: 'error' as const, error: String(r.reason) }
          );
        },
      }),
    ],
  };
}
