import type { NormalizedMovie } from '../domain/movie';
import type { NormalizedShow } from '../domain/show';
import type { RadarrMovie } from './radarrProvider';
import type { SonarrSeries } from './sonarrProvider';

/**
 * Translate provider DTOs into the canonical Normalized* domain shapes the
 * filterRegistry operates on. Shared by the automation executor and the media
 * browse handler so both filter against the same projection. `_sourceIds` keeps
 * the provider id so matched items can be mapped back to their raw DTO.
 */
export function normalizeRadarrMovie(m: RadarrMovie): NormalizedMovie {
  return {
    _sourceIds: { radarr: m.id },
    title: m.title,
    year: m.year,
    hasFile: m.hasFile,
    monitored: m.monitored,
    qualityProfileId: m.qualityProfileId,
    tags: m.tags,
    genres: m.genres,
    addedDate: m.added,
    sizeOnDiskBytes: m.statistics?.sizeOnDisk,
    certification: m.certification,
    imdbRating: m.ratings?.imdb?.value,
  };
}

export function normalizeSonarrSeries(s: SonarrSeries): NormalizedShow {
  return {
    _sourceIds: { sonarr: s.id },
    title: s.title,
    year: s.year,
    monitored: s.monitored,
    qualityProfileId: s.qualityProfileId,
    tags: s.tags,
    genres: s.genres,
    addedDate: s.added,
    sizeOnDiskBytes: s.statistics?.sizeOnDisk,
    certification: s.certification,
    seriesType: s.seriesType as NormalizedShow['seriesType'],
    network: s.network,
    status: s.status as NormalizedShow['status'],
    ended: s.ended,
    episodePercentage: s.statistics?.percentOfEpisodes,
    lastAiredAt: s.previousAiring,
    communityRating: s.ratings?.value,
  };
}
