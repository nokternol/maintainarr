import { RadarrProvider, type SonarrProvider } from '../providers';
import type { MediaSource } from './mediaSource';
import { normalizeRadarrMovie, normalizeSonarrSeries } from './normalizeMedia';

export function radarrMediaSource(radarr: RadarrProvider, providerId: number): MediaSource {
  return {
    getMediaItems: async () =>
      (await radarr.getMovies()).map((m) => normalizeRadarrMovie(m, providerId)),
    idOf: (item) => (item._sourceIds as { radarr?: number }).radarr,
  };
}

export function sonarrMediaSource(sonarr: SonarrProvider, providerId: number): MediaSource {
  return {
    getMediaItems: async () =>
      (await sonarr.getSeries()).map((s) => normalizeSonarrSeries(s, providerId)),
    idOf: (item) => (item._sourceIds as { sonarr?: number }).sonarr,
  };
}

export function mediaSourceFor(
  provider: RadarrProvider | SonarrProvider,
  providerId: number
): MediaSource {
  return provider instanceof RadarrProvider
    ? radarrMediaSource(provider, providerId)
    : sonarrMediaSource(provider, providerId);
}
