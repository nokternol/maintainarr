import { RadarrProvider, type SonarrProvider } from '../providers';
import type { MediaSource } from './mediaSource';
import { normalizeRadarrMovie, normalizeSonarrSeries } from './normalizeMedia';

export function radarrMediaSource(radarr: RadarrProvider): MediaSource {
  return {
    getMediaItems: async () => (await radarr.getMovies()).map(normalizeRadarrMovie),
    idOf: (item) => (item._sourceIds as { radarr?: number }).radarr,
    enrichmentSourceType: 'RADARR',
  };
}

export function sonarrMediaSource(sonarr: SonarrProvider): MediaSource {
  return {
    getMediaItems: async () => (await sonarr.getSeries()).map(normalizeSonarrSeries),
    idOf: (item) => (item._sourceIds as { sonarr?: number }).sonarr,
    enrichmentSourceType: 'SONARR',
  };
}

export function mediaSourceFor(provider: RadarrProvider | SonarrProvider): MediaSource {
  return provider instanceof RadarrProvider
    ? radarrMediaSource(provider)
    : sonarrMediaSource(provider);
}
