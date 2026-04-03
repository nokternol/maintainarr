import { MetadataProviderType } from '@server/database/schema';
import { getChildLogger } from '@server/logger';
import { RadarrProvider } from '@server/providers/radarrProvider';
import type { RadarrMovie } from '@server/providers/radarrProvider';
import { SonarrProvider } from '@server/providers/sonarrProvider';
import type { SonarrSeries } from '@server/providers/sonarrProvider';
import type { ProviderSettingsService } from '@server/services/providerSettingsService';
import { defineRoute } from '@server/utils/defineRoute';

const log = getChildLogger('MediaHandler');

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
  };
}
