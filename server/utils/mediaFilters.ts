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
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseIds(csv: string | undefined): number[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
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
    filtered = filtered.filter((m) => tagIds.every((id) => m.tags.includes(id)));
  }

  const profileIds = parseIds(query.movieQualityProfileIds);
  if (profileIds.length > 0) {
    filtered = filtered.filter((m) => profileIds.includes(m.qualityProfileId));
  }

  const genres = parseCsvStrings(query.movieGenres);
  if (genres.length > 0) {
    filtered = filtered.filter((m) => m.genres?.some((g) => genres.includes(g)));
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
    filtered = filtered.filter((s) => tagIds.every((id) => s.tags.includes(id)));
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

  return filtered;
}
