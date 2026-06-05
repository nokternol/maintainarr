/**
 * Pure filter functions for Radarr movies and Sonarr series.
 * These contain no handler or controller dependencies and may be imported
 * freely from any layer (services, utilities, etc.).
 */
import type { RadarrMovie } from '../providers/radarrProvider';
import type { SonarrSeries } from '../providers/sonarrProvider';

// ─── Query types ─────────────────────────────────────────────────────────────

export interface MovieFilterQuery {
  title?: string;
  yearMin?: number;
  yearMax?: number;
  hasFile?: boolean;
  movieTagIds?: string;
  movieQualityProfileIds?: string;
  movieGenres?: string;
  addedDaysAgoGte?: number;
  addedDaysAgoLte?: number;
  sizeOnDiskGbGte?: number;
  sizeOnDiskGbLte?: number;
  certification?: string;
  radarrImdbRatingGte?: number;
  radarrImdbRatingLte?: number;
}

export interface SeriesFilterQuery {
  title?: string;
  yearMin?: number;
  yearMax?: number;
  monitored?: boolean;
  seriesStatus?: string;
  seriesTagIds?: string;
  seriesQualityProfileIds?: string;
  seriesGenres?: string;
  seriesType?: string;
  network?: string;
  addedDaysAgoGte?: number;
  addedDaysAgoLte?: number;
  sizeOnDiskGbGte?: number;
  sizeOnDiskGbLte?: number;
  certification?: string;
  sonarrRatingGte?: number;
  sonarrRatingLte?: number;
  sonarrEnded?: boolean;
  sonarrLastAiredDaysAgoGte?: number;
  sonarrLastAiredDaysAgoLte?: number;
  sonarrPercentEpisodesGte?: number;
  sonarrPercentEpisodesLte?: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseIds(csv: string | undefined): number[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function daysElapsed(isoDate: string): number {
  return Math.floor((Date.now() - Date.parse(isoDate)) / 86_400_000);
}

function parseCsvStrings(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Filter functions ─────────────────────────────────────────────────────────

export function applyMovieFilters(all: RadarrMovie[], query: MovieFilterQuery): RadarrMovie[] {
  let filtered = all;

  if (query.title !== undefined) {
    const lower = query.title.toLowerCase();
    filtered = filtered.filter((m) => m.title.toLowerCase().includes(lower));
  }
  if (query.yearMin !== undefined) {
    filtered = filtered.filter((m) => m.year !== undefined && m.year >= query.yearMin!);
  }
  if (query.yearMax !== undefined) {
    filtered = filtered.filter((m) => m.year !== undefined && m.year <= query.yearMax!);
  }
  if (query.hasFile !== undefined) {
    filtered = filtered.filter((m) => m.hasFile === query.hasFile);
  }

  const tagIds = parseIds(query.movieTagIds);
  if (tagIds.length > 0) {
    filtered = filtered.filter((m) => tagIds.some((id) => m.tags.includes(id)));
  }

  const profileIds = parseIds(query.movieQualityProfileIds);
  if (profileIds.length > 0) {
    filtered = filtered.filter((m) => profileIds.includes(m.qualityProfileId));
  }

  const genres = parseCsvStrings(query.movieGenres);
  if (genres.length > 0) {
    filtered = filtered.filter((m) => m.genres?.some((g) => genres.includes(g)));
  }

  if (query.addedDaysAgoGte !== undefined || query.addedDaysAgoLte !== undefined) {
    filtered = filtered.filter((m) => {
      if (!m.added) return false;
      const days = daysElapsed(m.added);
      if (query.addedDaysAgoGte !== undefined && days < query.addedDaysAgoGte) return false;
      if (query.addedDaysAgoLte !== undefined && days > query.addedDaysAgoLte) return false;
      return true;
    });
  }

  if (query.sizeOnDiskGbGte !== undefined || query.sizeOnDiskGbLte !== undefined) {
    filtered = filtered.filter((m) => {
      if (!m.statistics) return false;
      const gb = m.statistics.sizeOnDisk / 1_073_741_824;
      if (query.sizeOnDiskGbGte !== undefined && gb < query.sizeOnDiskGbGte) return false;
      if (query.sizeOnDiskGbLte !== undefined && gb > query.sizeOnDiskGbLte) return false;
      return true;
    });
  }

  const certifications = parseCsvStrings(query.certification).map((c) => c.toLowerCase());
  if (certifications.length > 0) {
    filtered = filtered.filter(
      (m) => m.certification !== undefined && certifications.includes(m.certification.toLowerCase())
    );
  }

  if (query.radarrImdbRatingGte !== undefined || query.radarrImdbRatingLte !== undefined) {
    filtered = filtered.filter((m) => {
      const rating = m.ratings?.imdb?.value;
      if (rating === undefined) return false;
      if (query.radarrImdbRatingGte !== undefined && rating < query.radarrImdbRatingGte)
        return false;
      if (query.radarrImdbRatingLte !== undefined && rating > query.radarrImdbRatingLte)
        return false;
      return true;
    });
  }

  return filtered;
}

export function applySeriesFilters(all: SonarrSeries[], query: SeriesFilterQuery): SonarrSeries[] {
  let filtered = all;

  if (query.title !== undefined) {
    const lower = query.title.toLowerCase();
    filtered = filtered.filter((s) => s.title.toLowerCase().includes(lower));
  }
  if (query.yearMin !== undefined) {
    filtered = filtered.filter((s) => s.year !== undefined && s.year >= query.yearMin!);
  }
  if (query.yearMax !== undefined) {
    filtered = filtered.filter((s) => s.year !== undefined && s.year <= query.yearMax!);
  }
  if (query.monitored !== undefined) {
    filtered = filtered.filter((s) => s.monitored === query.monitored);
  }
  if (query.seriesStatus !== undefined) {
    filtered = filtered.filter((s) => s.status === query.seriesStatus);
  }

  const tagIds = parseIds(query.seriesTagIds);
  if (tagIds.length > 0) {
    filtered = filtered.filter((s) => tagIds.some((id) => s.tags.includes(id)));
  }

  const profileIds = parseIds(query.seriesQualityProfileIds);
  if (profileIds.length > 0) {
    filtered = filtered.filter((s) => profileIds.includes(s.qualityProfileId));
  }

  const genres = parseCsvStrings(query.seriesGenres);
  if (genres.length > 0) {
    filtered = filtered.filter((s) => s.genres?.some((g) => genres.includes(g)));
  }

  if (query.seriesType !== undefined) {
    filtered = filtered.filter((s) => s.seriesType === query.seriesType);
  }

  const networks = parseCsvStrings(query.network);
  if (networks.length > 0) {
    filtered = filtered.filter((s) => s.network !== undefined && networks.includes(s.network));
  }

  if (query.addedDaysAgoGte !== undefined || query.addedDaysAgoLte !== undefined) {
    filtered = filtered.filter((s) => {
      if (!s.added) return false;
      const days = daysElapsed(s.added);
      if (query.addedDaysAgoGte !== undefined && days < query.addedDaysAgoGte) return false;
      if (query.addedDaysAgoLte !== undefined && days > query.addedDaysAgoLte) return false;
      return true;
    });
  }

  if (query.sizeOnDiskGbGte !== undefined || query.sizeOnDiskGbLte !== undefined) {
    filtered = filtered.filter((s) => {
      if (!s.statistics) return false;
      const gb = s.statistics.sizeOnDisk / 1_073_741_824;
      if (query.sizeOnDiskGbGte !== undefined && gb < query.sizeOnDiskGbGte) return false;
      if (query.sizeOnDiskGbLte !== undefined && gb > query.sizeOnDiskGbLte) return false;
      return true;
    });
  }

  const certifications = parseCsvStrings(query.certification).map((c) => c.toLowerCase());
  if (certifications.length > 0) {
    filtered = filtered.filter(
      (s) => s.certification !== undefined && certifications.includes(s.certification.toLowerCase())
    );
  }

  if (query.sonarrRatingGte !== undefined || query.sonarrRatingLte !== undefined) {
    filtered = filtered.filter((s) => {
      const rating = s.ratings?.value;
      if (rating === undefined) return false;
      if (query.sonarrRatingGte !== undefined && rating < query.sonarrRatingGte) return false;
      if (query.sonarrRatingLte !== undefined && rating > query.sonarrRatingLte) return false;
      return true;
    });
  }

  if (query.sonarrEnded !== undefined) {
    filtered = filtered.filter((s) => s.ended !== undefined && s.ended === query.sonarrEnded);
  }

  if (
    query.sonarrLastAiredDaysAgoGte !== undefined ||
    query.sonarrLastAiredDaysAgoLte !== undefined
  ) {
    filtered = filtered.filter((s) => {
      if (!s.previousAiring) return false;
      const days = daysElapsed(s.previousAiring);
      if (query.sonarrLastAiredDaysAgoGte !== undefined && days < query.sonarrLastAiredDaysAgoGte)
        return false;
      if (query.sonarrLastAiredDaysAgoLte !== undefined && days > query.sonarrLastAiredDaysAgoLte)
        return false;
      return true;
    });
  }

  if (
    query.sonarrPercentEpisodesGte !== undefined ||
    query.sonarrPercentEpisodesLte !== undefined
  ) {
    filtered = filtered.filter((s) => {
      const pct = s.statistics?.percentOfEpisodes;
      if (pct === undefined) return false;
      if (query.sonarrPercentEpisodesGte !== undefined && pct < query.sonarrPercentEpisodesGte)
        return false;
      if (query.sonarrPercentEpisodesLte !== undefined && pct > query.sonarrPercentEpisodesLte)
        return false;
      return true;
    });
  }

  return filtered;
}
