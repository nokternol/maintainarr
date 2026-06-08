import { MetadataProviderType } from '../database/schema';
import type { NormalizedMovie } from '../domain/movie';
import type { NormalizedShow } from '../domain/show';

export type { NormalizedMovie } from '../domain/movie';
export type { NormalizedShow } from '../domain/show';

export type ContentType = 'movie' | 'show';
export type FilterValue = string | number | boolean;

export interface FilterDefinition<
  T extends NormalizedMovie | NormalizedShow = NormalizedMovie | NormalizedShow,
> {
  key: string;
  label: string;
  contentTypes: ContentType[];
  dataType: 'boolean' | 'number' | 'string' | 'csv-ids';
  sourceProviders: MetadataProviderType[];
  required: boolean;
  apply: (item: T, value: FilterValue) => boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCsvIds(value: FilterValue): number[] {
  const csv = String(value);
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function parseCsvStrings(value: FilterValue): string[] {
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function daysElapsed(isoDate: string): number {
  return Math.floor((Date.now() - Date.parse(isoDate)) / 86_400_000);
}

function asBool(value: FilterValue): boolean {
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const FILTER_REGISTRY: FilterDefinition[] = [
  // ── Shared: both content types ─────────────────────────────────────────────
  {
    key: 'title',
    label: 'Title',
    contentTypes: ['movie', 'show'],
    dataType: 'string',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
    ],
    required: false,
    apply: (item, value) => item.title.toLowerCase().includes(String(value).toLowerCase()),
  },
  {
    key: 'yearMin',
    label: 'Year (min)',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
      MetadataProviderType.TMDB,
    ],
    required: false,
    apply: (item, value) => item.year !== undefined && item.year >= Number(value),
  },
  {
    key: 'yearMax',
    label: 'Year (max)',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
      MetadataProviderType.TMDB,
    ],
    required: false,
    apply: (item, value) => item.year !== undefined && item.year <= Number(value),
  },
  {
    key: 'watched',
    label: 'Watched',
    contentTypes: ['movie', 'show'],
    dataType: 'boolean',
    sourceProviders: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX],
    required: false,
    apply: (item, value) => {
      const watched = (item.playCount ?? 0) > 0;
      return watched === asBool(value);
    },
  },
  {
    key: 'addedDaysAgoGte',
    label: 'Added (days ago, min)',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
    ],
    required: false,
    apply: (item, value) => {
      if (!item.addedDate) return false;
      return daysElapsed(item.addedDate) >= Number(value);
    },
  },
  {
    key: 'addedDaysAgoLte',
    label: 'Added (days ago, max)',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
    ],
    required: false,
    apply: (item, value) => {
      if (!item.addedDate) return false;
      return daysElapsed(item.addedDate) <= Number(value);
    },
  },
  {
    key: 'sizeOnDiskGbGte',
    label: 'Size on disk (GB, min)',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.RADARR, MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      if (item.sizeOnDiskBytes === undefined) return false;
      return item.sizeOnDiskBytes / 1_073_741_824 >= Number(value);
    },
  },
  {
    key: 'sizeOnDiskGbLte',
    label: 'Size on disk (GB, max)',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.RADARR, MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      if (item.sizeOnDiskBytes === undefined) return false;
      return item.sizeOnDiskBytes / 1_073_741_824 <= Number(value);
    },
  },
  {
    key: 'certification',
    label: 'Certification',
    contentTypes: ['movie', 'show'],
    dataType: 'csv-ids',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.TMDB,
      MetadataProviderType.OMDB,
    ],
    required: false,
    apply: (item, value) => {
      if (!item.certification) return false;
      const certs = parseCsvStrings(value).map((c) => c.toLowerCase());
      return certs.includes(item.certification.toLowerCase());
    },
  },
  {
    key: 'hasFile',
    label: 'Has file',
    contentTypes: ['movie', 'show'],
    dataType: 'boolean',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
    ],
    required: false,
    apply: (item, value) => item.hasFile === asBool(value),
  },

  // ── Movie-only ─────────────────────────────────────────────────────────────
  {
    key: 'tagIds',
    label: 'Tags',
    contentTypes: ['movie'],
    dataType: 'csv-ids',
    sourceProviders: [MetadataProviderType.RADARR],
    required: false,
    apply: (item, value) => {
      const ids = parseCsvIds(value);
      return ids.some((id) => (item.tags ?? []).includes(id));
    },
  },
  {
    key: 'qualityProfileIds',
    label: 'Quality profile',
    contentTypes: ['movie'],
    dataType: 'csv-ids',
    sourceProviders: [MetadataProviderType.RADARR],
    required: false,
    apply: (item, value) => {
      const ids = parseCsvIds(value);
      return item.qualityProfileId !== undefined && ids.includes(item.qualityProfileId);
    },
  },
  {
    key: 'genres',
    label: 'Genres',
    contentTypes: ['movie'],
    dataType: 'csv-ids',
    sourceProviders: [MetadataProviderType.RADARR, MetadataProviderType.TMDB],
    required: false,
    apply: (item, value) => {
      const genres = parseCsvStrings(value);
      return (item.genres ?? []).some((g) => genres.includes(g));
    },
  },
  {
    key: 'imdbRatingGte',
    label: 'IMDB rating (min)',
    contentTypes: ['movie'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.RADARR, MetadataProviderType.OMDB],
    required: false,
    apply: (item, value) => {
      const movie = item as NormalizedMovie;
      if (movie.imdbRating === undefined) return false;
      return movie.imdbRating >= Number(value);
    },
  },
  {
    key: 'imdbRatingLte',
    label: 'IMDB rating (max)',
    contentTypes: ['movie'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.RADARR, MetadataProviderType.OMDB],
    required: false,
    apply: (item, value) => {
      const movie = item as NormalizedMovie;
      if (movie.imdbRating === undefined) return false;
      return movie.imdbRating <= Number(value);
    },
  },

  // ── Show-only ──────────────────────────────────────────────────────────────
  {
    key: 'monitored',
    label: 'Monitored',
    contentTypes: ['show'],
    dataType: 'boolean',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => item.monitored === asBool(value),
  },
  {
    key: 'seriesStatus',
    label: 'Series status',
    contentTypes: ['show'],
    dataType: 'string',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      return show.status === String(value);
    },
  },
  {
    key: 'tagIds',
    label: 'Tags',
    contentTypes: ['show'],
    dataType: 'csv-ids',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const ids = parseCsvIds(value);
      return ids.some((id) => (item.tags ?? []).includes(id));
    },
  },
  {
    key: 'qualityProfileIds',
    label: 'Quality profile',
    contentTypes: ['show'],
    dataType: 'csv-ids',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const ids = parseCsvIds(value);
      return item.qualityProfileId !== undefined && ids.includes(item.qualityProfileId);
    },
  },
  {
    key: 'genres',
    label: 'Genres',
    contentTypes: ['show'],
    dataType: 'csv-ids',
    sourceProviders: [MetadataProviderType.SONARR, MetadataProviderType.TMDB],
    required: false,
    apply: (item, value) => {
      const genres = parseCsvStrings(value);
      return (item.genres ?? []).some((g) => genres.includes(g));
    },
  },
  {
    key: 'seriesType',
    label: 'Series type',
    contentTypes: ['show'],
    dataType: 'string',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      return show.seriesType === String(value);
    },
  },
  {
    key: 'network',
    label: 'Network',
    contentTypes: ['show'],
    dataType: 'csv-ids',
    sourceProviders: [MetadataProviderType.SONARR, MetadataProviderType.TVMAZE],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      if (!show.network) return false;
      return parseCsvStrings(value).includes(show.network);
    },
  },
  {
    key: 'communityRatingGte',
    label: 'Community rating (min)',
    contentTypes: ['show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.SONARR, MetadataProviderType.TMDB],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      if (show.communityRating === undefined) return false;
      return show.communityRating >= Number(value);
    },
  },
  {
    key: 'communityRatingLte',
    label: 'Community rating (max)',
    contentTypes: ['show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.SONARR, MetadataProviderType.TMDB],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      if (show.communityRating === undefined) return false;
      return show.communityRating <= Number(value);
    },
  },
  {
    key: 'ended',
    label: 'Ended',
    contentTypes: ['show'],
    dataType: 'boolean',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      return show.ended === asBool(value);
    },
  },
  {
    key: 'lastAiredDaysAgoGte',
    label: 'Last aired (days ago, min)',
    contentTypes: ['show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      if (!show.lastAiredAt) return false;
      return daysElapsed(show.lastAiredAt) >= Number(value);
    },
  },
  {
    key: 'lastAiredDaysAgoLte',
    label: 'Last aired (days ago, max)',
    contentTypes: ['show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      if (!show.lastAiredAt) return false;
      return daysElapsed(show.lastAiredAt) <= Number(value);
    },
  },
  {
    key: 'episodePercentageGte',
    label: 'Episode completion (%, min)',
    contentTypes: ['show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      if (show.episodePercentage === undefined) return false;
      return show.episodePercentage >= Number(value);
    },
  },
  {
    key: 'episodePercentageLte',
    label: 'Episode completion (%, max)',
    contentTypes: ['show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    apply: (item, value) => {
      const show = item as NormalizedShow;
      if (show.episodePercentage === undefined) return false;
      return show.episodePercentage <= Number(value);
    },
  },
  {
    key: 'tmdbStatus',
    label: 'TMDB status',
    contentTypes: ['movie', 'show'],
    dataType: 'string',
    sourceProviders: [MetadataProviderType.TMDB],
    required: false,
    apply: (item, value) => {
      if (!item.tmdbStatus) return false;
      return item.tmdbStatus === String(value);
    },
  },
  {
    key: 'overseerrRequestStatus',
    label: 'Overseerr request status',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.OVERSEERR],
    required: false,
    apply: (item, value) => {
      if (item.overseerrRequestStatus === undefined) return false;
      return item.overseerrRequestStatus === Number(value);
    },
  },
  {
    key: 'overseerrHasIssue',
    label: 'Overseerr has issue',
    contentTypes: ['movie', 'show'],
    dataType: 'boolean',
    sourceProviders: [MetadataProviderType.OVERSEERR],
    required: false,
    apply: (item, value) => {
      if (item.overseerrHasIssue === undefined) return false;
      return item.overseerrHasIssue === asBool(value);
    },
  },
  {
    key: 'lastWatchedDaysAgoGte',
    label: 'Last watched (days ago, min)',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX],
    required: false,
    apply: (item, value) => {
      if (!item.lastWatchedAt) return false;
      return daysElapsed(item.lastWatchedAt) >= Number(value);
    },
  },
  {
    key: 'lastWatchedDaysAgoLte',
    label: 'Last watched (days ago, max)',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: [MetadataProviderType.TAUTULLI, MetadataProviderType.PLEX],
    required: false,
    apply: (item, value) => {
      if (!item.lastWatchedAt) return false;
      return daysElapsed(item.lastWatchedAt) <= Number(value);
    },
  },
];

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getFilterDef(key: string, contentType: ContentType): FilterDefinition | undefined {
  return FILTER_REGISTRY.find((d) => d.key === key && d.contentTypes.includes(contentType));
}
