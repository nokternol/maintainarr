import { MetadataProviderType } from '../../database/schema';
import type { MediaKind } from '../providers';
import { fieldsByProviderType } from './activeFieldSet';
import type { EnrichmentFields } from './mediaFieldProvider';
import type { NormalizedMovie } from './movie';
import type { NormalizedShow } from './show';

export type { NormalizedMovie } from './movie';
export type { NormalizedShow } from './show';

export type ContentType = MediaKind;
export type RangeValue = { min?: number; max?: number };
export type FilterValue = string | number | boolean | RangeValue;

/**
 * One predicate application: a registry key paired with the value to test it against.
 * `providerId` qualifies which instance's namespace the value belongs to — set only on
 * `instanceScoped` rules; namespace qualification, not targeting (see `automations.providerId`
 * for that). Undefined means unqualified: the native id is interpreted in each item's own
 * instance namespace, today's behavior.
 */
export interface FilterValueEntry {
  key: string;
  value: FilterValue;
  providerId?: number;
}

export type Predicate<
  T extends NormalizedMovie | NormalizedShow = NormalizedMovie | NormalizedShow,
> = (item: T, value: FilterValue) => boolean;

export interface MediaRule<
  T extends NormalizedMovie | NormalizedShow = NormalizedMovie | NormalizedShow,
> {
  key: string;
  label: string;
  contentTypes: ContentType[];
  dataType: 'boolean' | 'number' | 'string' | 'csv-ids' | 'csv-strings' | 'range';
  sourceProviders: MetadataProviderType[];
  required: boolean;
  /** True for rules whose values are a provider-*defined* id space (a quality profile id is
   *  minted by one instance) — the client must qualify these per instance when more than one
   *  is active. Flows into `MediaRuleDescriptor` automatically; the client learns the class
   *  from the registry projection instead of keeping its own list. */
  instanceScoped?: boolean;
  predicate: Predicate<T>;
}

/** `MediaRule`'s JSON-honest transport projection — no `predicate`. */
export type MediaRuleDescriptor = Omit<MediaRule, 'predicate'>;

export function toDescriptor(rule: MediaRule): MediaRuleDescriptor {
  const { predicate: _predicate, ...descriptor } = rule;
  return descriptor;
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

/** Tests `actual` against a `{ min?, max? }` range value — either bound may be omitted. */
function inRange(actual: number, value: FilterValue): boolean {
  const { min, max } = value as RangeValue;
  if (min !== undefined && actual < min) return false;
  if (max !== undefined && actual > max) return false;
  return true;
}

/**
 * A rule's `sourceProviders` for a field `MediaFieldProvider`/`MediaFieldSource`
 * tracks — every provider type whose `fieldsByProviderType` entry includes it,
 * the inverse lookup of that declaration. Rules backed by a source-owned field
 * outside `EnrichmentFields` (most of `NormalizedMovie`/`NormalizedShow`) still
 * hand-list `sourceProviders` until `movie.ts`/`show.ts` derive from
 * `EnrichmentFields` too (see spec's Risks section).
 */
export function deriveSourceProviders(field: keyof EnrichmentFields): MetadataProviderType[] {
  return (Object.entries(fieldsByProviderType) as [MetadataProviderType, readonly string[]][])
    .filter(([, fields]) => fields.includes(field))
    .map(([type]) => type);
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const MEDIA_RULES: MediaRule[] = [
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
    predicate: (item, value) => item.title.toLowerCase().includes(String(value).toLowerCase()),
  },
  {
    key: 'year',
    label: 'Year',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
      MetadataProviderType.TMDB,
    ],
    required: false,
    predicate: (item, value) => item.year !== undefined && inRange(item.year, value),
  },
  {
    key: 'watched',
    label: 'Watched',
    contentTypes: ['movie', 'show'],
    dataType: 'boolean',
    sourceProviders: deriveSourceProviders('playCount'),
    required: false,
    predicate: (item, value) => {
      const watched = (item.playCount ?? 0) > 0;
      return watched === asBool(value);
    },
  },
  {
    key: 'addedDaysAgo',
    label: 'Added (days ago)',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.PLEX,
    ],
    required: false,
    predicate: (item, value) => {
      if (!item.addedDate) return false;
      return inRange(daysElapsed(item.addedDate), value);
    },
  },
  {
    key: 'sizeOnDiskGb',
    label: 'Size on disk (GB)',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: [MetadataProviderType.RADARR, MetadataProviderType.SONARR],
    required: false,
    predicate: (item, value) => {
      if (item.sizeOnDiskBytes === undefined) return false;
      return inRange(item.sizeOnDiskBytes / 1_073_741_824, value);
    },
  },
  {
    key: 'certification',
    label: 'Certification',
    contentTypes: ['movie', 'show'],
    dataType: 'csv-strings',
    sourceProviders: [
      MetadataProviderType.RADARR,
      MetadataProviderType.SONARR,
      MetadataProviderType.TMDB,
      MetadataProviderType.OMDB,
    ],
    required: false,
    predicate: (item, value) => {
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
    predicate: (item, value) => item.hasFile === asBool(value),
  },

  // ── Movie-only ─────────────────────────────────────────────────────────────
  {
    key: 'tagIds',
    label: 'Tags',
    contentTypes: ['movie'],
    dataType: 'csv-ids',
    sourceProviders: [MetadataProviderType.RADARR],
    required: false,
    instanceScoped: true,
    predicate: (item, value) => {
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
    instanceScoped: true,
    predicate: (item, value) => {
      const ids = parseCsvIds(value);
      return item.qualityProfileId !== undefined && ids.includes(item.qualityProfileId);
    },
  },
  {
    key: 'genres',
    label: 'Genres',
    contentTypes: ['movie'],
    dataType: 'csv-strings',
    sourceProviders: [MetadataProviderType.RADARR],
    required: false,
    predicate: (item, value) => {
      const genres = parseCsvStrings(value);
      return (item.genres ?? []).some((g) => genres.includes(g));
    },
  },
  {
    key: 'imdbRating',
    label: 'IMDB rating',
    contentTypes: ['movie'],
    dataType: 'range',
    sourceProviders: [MetadataProviderType.RADARR],
    required: false,
    predicate: (item, value) => {
      const movie = item as NormalizedMovie;
      if (movie.imdbRating === undefined) return false;
      return inRange(movie.imdbRating, value);
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
    predicate: (item, value) => item.monitored === asBool(value),
  },
  {
    key: 'seriesStatus',
    label: 'Series status',
    contentTypes: ['show'],
    dataType: 'string',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    predicate: (item, value) => {
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
    instanceScoped: true,
    predicate: (item, value) => {
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
    instanceScoped: true,
    predicate: (item, value) => {
      const ids = parseCsvIds(value);
      return item.qualityProfileId !== undefined && ids.includes(item.qualityProfileId);
    },
  },
  {
    key: 'genres',
    label: 'Genres',
    contentTypes: ['show'],
    dataType: 'csv-strings',
    sourceProviders: [MetadataProviderType.SONARR, MetadataProviderType.TMDB],
    required: false,
    predicate: (item, value) => {
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
    predicate: (item, value) => {
      const show = item as NormalizedShow;
      return show.seriesType === String(value);
    },
  },
  {
    key: 'network',
    label: 'Network',
    contentTypes: ['show'],
    dataType: 'csv-strings',
    sourceProviders: [MetadataProviderType.SONARR, MetadataProviderType.TVMAZE],
    required: false,
    predicate: (item, value) => {
      const show = item as NormalizedShow;
      if (!show.network) return false;
      return parseCsvStrings(value).includes(show.network);
    },
  },
  {
    key: 'communityRating',
    label: 'Community rating',
    contentTypes: ['show'],
    dataType: 'range',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    predicate: (item, value) => {
      const show = item as NormalizedShow;
      if (show.communityRating === undefined) return false;
      return inRange(show.communityRating, value);
    },
  },
  {
    key: 'ended',
    label: 'Ended',
    contentTypes: ['show'],
    dataType: 'boolean',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    predicate: (item, value) => {
      const show = item as NormalizedShow;
      return show.ended === asBool(value);
    },
  },
  {
    key: 'lastAiredDaysAgo',
    label: 'Last aired (days ago)',
    contentTypes: ['show'],
    dataType: 'range',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    predicate: (item, value) => {
      const show = item as NormalizedShow;
      if (!show.lastAiredAt) return false;
      return inRange(daysElapsed(show.lastAiredAt), value);
    },
  },
  {
    key: 'episodePercentage',
    label: 'Episode completion (%)',
    contentTypes: ['show'],
    dataType: 'range',
    sourceProviders: [MetadataProviderType.SONARR],
    required: false,
    predicate: (item, value) => {
      const show = item as NormalizedShow;
      if (show.episodePercentage === undefined) return false;
      return inRange(show.episodePercentage, value);
    },
  },
  {
    key: 'tmdbStatus',
    label: 'TMDB status',
    contentTypes: ['movie', 'show'],
    dataType: 'string',
    sourceProviders: deriveSourceProviders('tmdbStatus'),
    required: false,
    predicate: (item, value) => {
      if (!item.tmdbStatus) return false;
      return item.tmdbStatus === String(value);
    },
  },
  {
    key: 'overseerrRequestStatus',
    label: 'Overseerr request status',
    contentTypes: ['movie', 'show'],
    dataType: 'number',
    sourceProviders: deriveSourceProviders('overseerrRequestStatus'),
    required: false,
    predicate: (item, value) => {
      if (item.overseerrRequestStatus === undefined) return false;
      return item.overseerrRequestStatus === Number(value);
    },
  },
  {
    key: 'overseerrHasIssue',
    label: 'Overseerr has issue',
    contentTypes: ['movie', 'show'],
    dataType: 'boolean',
    sourceProviders: deriveSourceProviders('overseerrHasIssue'),
    required: false,
    // Truthy/falsy: "has issue" treats unknown (null/undefined) and false alike as "no issue".
    predicate: (item, value) => Boolean(item.overseerrHasIssue) === asBool(value),
  },
  {
    key: 'lastWatchedDaysAgo',
    label: 'Last watched (days ago)',
    contentTypes: ['movie', 'show'],
    dataType: 'range',
    sourceProviders: deriveSourceProviders('lastWatchedAt'),
    required: false,
    predicate: (item, value) => {
      if (!item.lastWatchedAt) return false;
      return inRange(daysElapsed(item.lastWatchedAt), value);
    },
  },
];

// ─── Lookup ───────────────────────────────────────────────────────────────────

export function getRule(key: string, contentType: ContentType): MediaRule | undefined {
  return MEDIA_RULES.find((d) => d.key === key && d.contentTypes.includes(contentType));
}
