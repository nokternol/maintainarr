import type { RadarrMovie, SonarrSeries } from '../providers';
import { radarrTagsFieldSource, sonarrTagsFieldSource } from './mediaFieldProvider';
import type { NormalizedMovie } from './movie';
import type { NormalizedShow } from './show';

/**
 * Translate provider DTOs into the canonical Normalized* domain shapes the
 * filterRegistry operates on. Shared by the automation executor and the media
 * browse handler so both filter against the same projection. `_sourceIds` keeps
 * the provider id so matched items can be mapped back to their raw DTO.
 */
export function normalizeRadarrMovie(m: RadarrMovie, providerId: number): NormalizedMovie {
  return {
    _sourceIds: { radarr: m.id, providerId, tmdb: m.tmdbId, imdb: m.imdbId },
    title: m.title,
    year: m.year,
    hasFile: m.hasFile,
    monitored: m.monitored,
    qualityProfileId: m.qualityProfileId,
    ...radarrTagsFieldSource.toEnrichmentFields(m.tags),
    genres: m.genres,
    addedDate: m.added,
    sizeOnDiskBytes: m.statistics?.sizeOnDisk,
    certification: m.certification,
    imdbRating: m.ratings?.imdb?.value,
  };
}

export function normalizeSonarrSeries(s: SonarrSeries, providerId: number): NormalizedShow {
  return {
    _sourceIds: { sonarr: s.id, providerId, tvdb: s.tvdbId, tmdb: s.tmdbId },
    title: s.title,
    year: s.year,
    monitored: s.monitored,
    qualityProfileId: s.qualityProfileId,
    ...sonarrTagsFieldSource.toEnrichmentFields(s.tags),
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
