import type {
  OverseerrIssue,
  OverseerrRequest,
  PlexMedia,
  PlexMediaItem,
  TautulliHistoryItem,
} from '../providers';

/**
 * The canonical fields any provider may contribute, whether by decorating an
 * existing item (`MediaFieldProvider`) or by constructing one from scratch
 * (`MediaFieldSource`). Hand-authored and type-only — never read or branched
 * on at runtime. Every adapter's `toEnrichmentFields` return is checked
 * against it, which is what catches a field-type disagreement between two
 * providers at compile time.
 */
export interface EnrichmentFields {
  tags: number[];
  playCount: number;
  lastWatchedAt: string;
  overseerrRequestStatus: number;
  overseerrHasIssue: boolean;
  tmdbStatus: string;
  plexAddedAt: string;
  studio: string;
  runtimeMinutes: number;
  fileSizeBytes: number;
  releaseDate: string;
  fileContainer: string;
  videoCodec: string;
  audioCodec: string;
  fileResolution: string;
  plexLabels: string[];
}

/**
 * A provider that builds an entire canonical item from one raw item, always
 * 1:1, with no existing item to decorate. `toEnrichmentFields` is the single
 * checked transform from the provider's own representation to `TFields`.
 */
export interface MediaFieldSource<TMediaField, TFields extends Partial<EnrichmentFields>> {
  toEnrichmentFields(native: TMediaField): TFields;
}

/**
 * A provider that decorates fields onto an already-existing item, joined by
 * key across a batch. `visit` maps raw provider data into the provider's own
 * native representation, keyed by the logical key the provider speaks;
 * `toEnrichmentFields` is the same checked transform `MediaFieldSource` uses,
 * applied per matched item.
 */
export interface MediaFieldProvider<
  TRaw,
  TMediaField,
  TFields extends Partial<EnrichmentFields>,
  TKey extends string | number = string,
> {
  visit(raw: TRaw): Map<TKey, TMediaField>;
  toEnrichmentFields(native: TMediaField): TFields;
}

/**
 * Both Radarr and Sonarr report tags as a native `number[]` with no
 * transform needed — the same `MediaFieldSource` shape, kept as two named
 * exports (not one shared constant) because callers care which provider's
 * adapter they're wiring, even though today's transform happens to be
 * identical.
 */
const tagsIdentitySource = (tags: number[]): Pick<EnrichmentFields, 'tags'> => ({ tags });

export const radarrTagsFieldSource: MediaFieldSource<number[], Pick<EnrichmentFields, 'tags'>> = {
  toEnrichmentFields: tagsIdentitySource,
};

export const sonarrTagsFieldSource: MediaFieldSource<number[], Pick<EnrichmentFields, 'tags'>> = {
  toEnrichmentFields: tagsIdentitySource,
};

/**
 * The play-history shape Tautulli and Plex both natively report: play count
 * plus the last play as a unix timestamp. Shared because it's genuinely the
 * same representation for both, not merely a coincidence of two adapters.
 */
interface PlayHistoryFields {
  playCount: number;
  lastPlayedUnix?: number;
}

const toIso = (unix: number): string => new Date(unix * 1000).toISOString();

/** The `toEnrichmentFields` transform every play-history provider shares. */
function playHistoryToEnrichmentFields(
  native: PlayHistoryFields
): Partial<Pick<EnrichmentFields, 'playCount' | 'lastWatchedAt'>> {
  return {
    playCount: native.playCount,
    ...(native.lastPlayedUnix !== undefined ? { lastWatchedAt: toIso(native.lastPlayedUnix) } : {}),
  };
}

export const tautulliFieldProvider: MediaFieldProvider<
  TautulliHistoryItem[],
  PlayHistoryFields,
  Partial<Pick<EnrichmentFields, 'playCount' | 'lastWatchedAt'>>
> = {
  visit: (history) => {
    const byKey = new Map<string, PlayHistoryFields>();
    for (const item of history) {
      const existing = byKey.get(item.rating_key);
      const playCount = (existing?.playCount ?? 0) + 1;
      const lastPlayedUnix =
        item.played_at !== undefined &&
        (existing?.lastPlayedUnix === undefined || item.played_at > existing.lastPlayedUnix)
          ? item.played_at
          : existing?.lastPlayedUnix;
      byKey.set(item.rating_key, { playCount, lastPlayedUnix });
    }
    return byKey;
  },
  toEnrichmentFields: playHistoryToEnrichmentFields,
};

export const tmdbFieldSource: MediaFieldSource<string, Pick<EnrichmentFields, 'tmdbStatus'>> = {
  toEnrichmentFields: (status) => ({ tmdbStatus: status }),
};

/** Overseerr's own representation: request status and whether an issue is open. */
interface OverseerrNativeFields {
  requestStatus?: number;
  hasIssue?: boolean;
}

export const overseerrFieldProvider: MediaFieldProvider<
  [OverseerrRequest[], OverseerrIssue[]],
  OverseerrNativeFields,
  Partial<Pick<EnrichmentFields, 'overseerrRequestStatus' | 'overseerrHasIssue'>>,
  number
> = {
  visit: ([requests, issues]) => {
    const byTmdbId = new Map<number, OverseerrNativeFields>();
    const get = (tmdbId: number): OverseerrNativeFields => {
      let f = byTmdbId.get(tmdbId);
      if (!f) {
        f = {};
        byTmdbId.set(tmdbId, f);
      }
      return f;
    };
    for (const req of requests) get(req.media.tmdbId).requestStatus = req.status;
    for (const issue of issues) get(issue.media.tmdbId).hasIssue = true;
    return byTmdbId;
  },
  toEnrichmentFields: (native) => ({
    ...(native.requestStatus !== undefined ? { overseerrRequestStatus: native.requestStatus } : {}),
    ...(native.hasIssue !== undefined ? { overseerrHasIssue: native.hasIssue } : {}),
  }),
};

/** The first `Media` entry's first `Part` — the file Plex actually plays, per item. */
function primaryPart(item: PlexMediaItem): { media?: PlexMedia; size?: number } {
  const media = item.Media?.[0];
  return { media, size: media?.Part?.[0]?.size };
}

/** Plex's own representation: play history plus its library-added timestamp and
 *  the rest of the item's directly-owned metadata (studio, runtime, file-tech,
 *  release date, labels). */
interface PlexNativeFields extends PlayHistoryFields {
  addedAtUnix?: number;
  studio?: string;
  durationMs?: number;
  fileSizeBytes?: number;
  releaseDate?: string;
  fileContainer?: string;
  videoCodec?: string;
  audioCodec?: string;
  fileResolution?: string;
  plexLabels?: string[];
}

export const plexFieldProvider: MediaFieldProvider<
  PlexMediaItem[],
  PlexNativeFields,
  Partial<
    Pick<
      EnrichmentFields,
      | 'playCount'
      | 'lastWatchedAt'
      | 'plexAddedAt'
      | 'studio'
      | 'runtimeMinutes'
      | 'fileSizeBytes'
      | 'releaseDate'
      | 'fileContainer'
      | 'videoCodec'
      | 'audioCodec'
      | 'fileResolution'
      | 'plexLabels'
    >
  >
> = {
  visit: (items) => {
    const byKey = new Map<string, PlexNativeFields>();
    for (const item of items) {
      const { media, size } = primaryPart(item);
      byKey.set(item.ratingKey, {
        playCount: item.viewCount ?? 0,
        lastPlayedUnix: item.lastViewedAt,
        addedAtUnix: item.addedAt,
        studio: item.studio,
        durationMs: item.duration,
        fileSizeBytes: size,
        releaseDate: item.originallyAvailableAt,
        fileContainer: media?.container,
        videoCodec: media?.videoCodec,
        audioCodec: media?.audioCodec,
        fileResolution: media?.videoResolution,
        plexLabels: item.Label?.map((l) => l.tag),
      });
    }
    return byKey;
  },
  toEnrichmentFields: (native) => ({
    ...playHistoryToEnrichmentFields(native),
    ...(native.addedAtUnix !== undefined ? { plexAddedAt: toIso(native.addedAtUnix) } : {}),
    ...(native.studio !== undefined ? { studio: native.studio } : {}),
    ...(native.durationMs !== undefined
      ? { runtimeMinutes: Math.round(native.durationMs / 60_000) }
      : {}),
    ...(native.fileSizeBytes !== undefined ? { fileSizeBytes: native.fileSizeBytes } : {}),
    ...(native.releaseDate !== undefined ? { releaseDate: native.releaseDate } : {}),
    ...(native.fileContainer !== undefined ? { fileContainer: native.fileContainer } : {}),
    ...(native.videoCodec !== undefined ? { videoCodec: native.videoCodec } : {}),
    ...(native.audioCodec !== undefined ? { audioCodec: native.audioCodec } : {}),
    ...(native.fileResolution !== undefined ? { fileResolution: native.fileResolution } : {}),
    ...(native.plexLabels !== undefined && native.plexLabels.length > 0
      ? { plexLabels: native.plexLabels }
      : {}),
  }),
};
